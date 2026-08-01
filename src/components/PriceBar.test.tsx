import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../data/options';
import { calcPrice } from '../data/pricing';
import { useConfigurator } from '../store/configurator';
import { PriceBar } from './PriceBar';

beforeEach(() => {
  useConfigurator.getState().applyFromUrl({ ...DEFAULT_CONFIG });
});

describe('PriceBar', () => {
  it('renders the current total', async () => {
    const { container } = render(<PriceBar onReview={() => {}} />);
    const expected = `$${calcPrice(DEFAULT_CONFIG).total}`;
    await waitFor(() =>
      expect(container.querySelector('.price-total-value')).toHaveTextContent(expected),
    );
  });

  /**
   * The regression this pins: the total sat in an aria-live region that GSAP
   * updated once per animation frame, so a screen reader announced the whole
   * count-up. The visible number is now aria-hidden and a separate live region
   * carries only the settled value.
   */
  it('announces only the settled total, not the animation', async () => {
    const { container } = render(<PriceBar onReview={() => {}} />);

    const visible = container.querySelector('.price-total');
    expect(visible).toHaveAttribute('aria-hidden', 'true');

    const live = container.querySelector('[aria-live]');
    expect(live).toBeInTheDocument();
    expect(live).not.toBe(visible);
    expect(visible?.contains(live!)).toBe(false);

    await waitFor(() =>
      expect(live).toHaveTextContent(`Total $${calcPrice(DEFAULT_CONFIG).total}`),
    );
  });

  it('keeps exactly one live region so announcements are not duplicated', () => {
    const { container } = render(<PriceBar onReview={() => {}} />);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('updates when the configuration changes', async () => {
    const { container } = render(<PriceBar onReview={() => {}} />);
    const before = calcPrice(DEFAULT_CONFIG).total;

    useConfigurator.getState().set('plate', 'brass');
    const after = calcPrice({ ...DEFAULT_CONFIG, plate: 'brass' }).total;
    expect(after).not.toBe(before);

    await waitFor(() =>
      expect(container.querySelector('[aria-live]')).toHaveTextContent(`Total $${after}`),
    );
  });

  it('calls onReview when the review button is pressed', async () => {
    const onReview = vi.fn();
    const { getByRole } = render(<PriceBar onReview={onReview} />);
    getByRole('button', { name: 'Review build' }).click();
    expect(onReview).toHaveBeenCalledOnce();
  });
});
