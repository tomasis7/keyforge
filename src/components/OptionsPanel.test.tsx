import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../data/options';
import { useConfigurator } from '../store/configurator';
import { OptionsPanel } from './OptionsPanel';

beforeEach(() => {
  useConfigurator.getState().applyFromUrl({ ...DEFAULT_CONFIG });
});

describe('OptionsPanel', () => {
  it('groups options as fieldsets with a legend, not bare divs', () => {
    render(<OptionsPanel />);
    for (const legend of ['Layout', 'Case finish', 'Keycaps', 'Switches', 'Plate']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
  });

  it('exposes choices as real radios with the current one checked', () => {
    render(<OptionsPanel />);
    const layout = screen.getByRole('group', { name: 'Layout' });
    const radios = within(layout).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(within(layout).getByRole('radio', { name: /75%/ })).toBeChecked();
  });

  it('writes the chosen option into the store', async () => {
    const user = userEvent.setup();
    render(<OptionsPanel />);

    await user.click(screen.getByRole('radio', { name: /TKL/ }));
    expect(useConfigurator.getState().layout).toBe('tkl');
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<OptionsPanel />);
    const layout = screen.getByRole('group', { name: 'Layout' });

    // Start from the checked radio, not the first one: arrowing off the first
    // radio lands on 75%, which is already the default, so it would assert
    // nothing.
    within(layout).getByRole('radio', { name: /75%/ }).focus();
    // Arrow keys move within a radio group. This is the behaviour that would be
    // lost if these were styled divs with click handlers.
    await user.keyboard('{ArrowDown}');
    expect(useConfigurator.getState().layout).toBe('tkl');

    await user.keyboard('{ArrowUp}');
    expect(useConfigurator.getState().layout).toBe('75');
  });

  it('reflects a store change made elsewhere', () => {
    const { rerender } = render(<OptionsPanel />);
    useConfigurator.getState().set('plate', 'brass');
    rerender(<OptionsPanel />);
    expect(screen.getByRole('radio', { name: /Brass/ })).toBeChecked();
  });

  it('randomize produces a valid configuration', async () => {
    const user = userEvent.setup();
    render(<OptionsPanel />);
    await user.click(screen.getByRole('button', { name: 'Surprise me' }));

    const state = useConfigurator.getState();
    expect(['65', '75', 'tkl']).toContain(state.layout);
    // Every group must still have exactly one checked radio.
    for (const name of ['Layout', 'Case finish', 'Keycaps', 'Switches', 'Plate']) {
      const group = screen.getByRole('group', { name });
      expect(within(group).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked))
        .toHaveLength(1);
    }
  });

  it('reset returns every option to its default', async () => {
    const user = userEvent.setup();
    render(<OptionsPanel />);
    await user.click(screen.getByRole('radio', { name: /TKL/ }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    const { layout, case: caseId, colorway, switches, plate } = useConfigurator.getState();
    expect({ layout, case: caseId, colorway, switches, plate }).toEqual({
      layout: DEFAULT_CONFIG.layout,
      case: DEFAULT_CONFIG.case,
      colorway: DEFAULT_CONFIG.colorway,
      switches: DEFAULT_CONFIG.switches,
      plate: DEFAULT_CONFIG.plate,
    });
  });
});
