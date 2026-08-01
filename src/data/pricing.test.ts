import { describe, expect, it } from 'vitest';
import { keyBaseColor, mixWithBlack } from '../lib/color';
import { CASE_OPTIONS, COLORWAYS, DEFAULT_CONFIG, type Config } from './options';
import { calcPrice } from './pricing';

describe('calcPrice', () => {
  it('always includes a base line for the layout', () => {
    const { items } = calcPrice(DEFAULT_CONFIG);
    expect(items[0].label).toBe('Base · 75%');
    expect(items[0].amount).toBe(309);
  });

  it('total equals the sum of the line items', () => {
    const config: Config = {
      layout: 'tkl',
      case: 'burgundy',
      colorway: 'retro',
      switches: 'bluejay',
      plate: 'brass',
      cable: 'ember',
      wrist: 'walnut',
    };
    const { total, items } = calcPrice(config);
    expect(total).toBe(items.reduce((sum, i) => sum + i.amount, 0));
  });

  it('omits zero-cost options from the breakdown', () => {
    const free = CASE_OPTIONS.find((c) => c.price === 0)!;
    const { items } = calcPrice({ ...DEFAULT_CONFIG, case: free.id });
    expect(items.map((i) => i.label)).not.toContain(free.name);
  });

  it('charges the difference when swapping one option', () => {
    const cheap = COLORWAYS.find((c) => c.id === 'mono')!;
    const dear = COLORWAYS.find((c) => c.id === 'retro')!;
    const a = calcPrice({ ...DEFAULT_CONFIG, colorway: cheap.id }).total;
    const b = calcPrice({ ...DEFAULT_CONFIG, colorway: dear.id }).total;
    expect(b - a).toBe(dear.price - cheap.price);
  });
});

describe('keycap side-wall colour', () => {
  // These must stay identical to the color-mix() they replaced, or every
  // keycap silently changes shade.
  it('matches color-mix(in srgb, hex 68%, black)', () => {
    expect(keyBaseColor('#ffffff')).toBe('#adadad'); // 255 * 0.68 = 173.4 -> 173
    expect(keyBaseColor('#000000')).toBe('#000000');
    expect(keyBaseColor('#3A3D42')).toBe('#27292d');
  });

  it('accepts shorthand hex', () => {
    expect(mixWithBlack('#fff', 0.5)).toBe(mixWithBlack('#ffffff', 0.5));
  });

  it('returns the input unchanged if it cannot be parsed', () => {
    expect(mixWithBlack('var(--accent)', 0.68)).toBe('var(--accent)');
  });
});
