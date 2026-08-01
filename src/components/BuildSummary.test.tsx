import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BuildSummary } from './BuildSummary';

/**
 * A harness with a real trigger button, because the interesting part of the
 * modal is what it does to focus *outside* itself.
 */
/** Lets a test re-render the parent while the modal is open. */
let forceParentRerender: () => void = () => {};

function Harness() {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  // onClose is a fresh closure on every parent render, so bumping this makes
  // the modal's effect deps change and the effect tear down and re-run.
  // Published from an effect rather than during render, which would be a
  // render-phase side effect.
  useEffect(() => {
    forceParentRerender = () => setTick((t) => t + 1);
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Review build
      </button>
      <BuildSummary open={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe('BuildSummary', () => {
  it('is not rendered until opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('locks body scroll while open and releases it on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('closes on Escape and returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Review build' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('still restores focus after the parent re-renders while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Review build' });
    await user.click(trigger);

    // The modal's effect depends on onClose, which the parent recreates on
    // every render, so this tears the effect down and sets it up again with
    // the dialog already focused. The restore target must survive that.
    act(() => forceParentRerender());
    act(() => forceParentRerender());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));
    const dialog = screen.getByRole('dialog');

    // Tab through more times than there are focusables; focus must never escape.
    const focusables = dialog.querySelectorAll('a[href], button:not([disabled])');
    for (let i = 0; i < focusables.length + 3; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('shifts focus backwards without escaping', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));
    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 4; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes when the overlay behind the dialog is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));

    const overlay = container.querySelector('.modal-overlay')!;
    await user.pointer({ target: overlay, keys: '[MouseLeft>]' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not close when the dialog itself is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));

    await user.click(screen.getByRole('heading', { name: 'Your build' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lists the priced line items and a total', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));

    expect(screen.getByText(/^Base ·/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('confirms a copy and reverts the label afterwards', async () => {
    const user = userEvent.setup();
    // Two things fight over navigator.clipboard: jsdom exposes it getter-only
    // so it must be redefined rather than assigned, and userEvent.setup()
    // installs its own stub — so ours has to be installed *after* setup().
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));
    await user.click(screen.getByRole('button', { name: 'Copy build link' }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    // Real timers rather than fake ones: userEvent drives its own scheduling,
    // and the two fight. One 2s wait is cheaper than the flakiness.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Copy build link' })).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it('cancels the copy confirmation timer when the modal closes', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const clearSpy = vi.spyOn(window, 'clearTimeout');

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Review build' }));
    await user.click(screen.getByRole('button', { name: 'Copy build link' }));
    await screen.findByRole('button', { name: 'Copied!' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
