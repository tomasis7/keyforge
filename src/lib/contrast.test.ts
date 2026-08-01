import { describe, expect, it } from 'vitest';
import { COLORWAYS, type ColorwayOption } from '../data/options';
import { AA_NORMAL, contrastRatio, relativeLuminance } from './contrast';

describe('contrastRatio', () => {
  it('matches the known extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#E4572E', '#1A1A1E')).toBeCloseTo(
      contrastRatio('#1A1A1E', '#E4572E'),
      10,
    );
  });

  it('handles shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 10);
  });
});

/**
 * Every legend on every cap must clear AA. This is the regression guard for a
 * palette change: three combinations were below the line (Carbon's accent at
 * 3.23:1 on the *default* colorway, Retro's accent at 3.05:1, Botanical's mod
 * at 4.20:1) and nothing in the build would have said so.
 */
describe('keycap legend contrast', () => {
  const zones: [string, keyof ColorwayOption, keyof ColorwayOption][] = [
    ['alpha', 'alpha', 'onAlpha'],
    ['mod', 'mod', 'onMod'],
    ['accent', 'accent', 'onAccent'],
  ];

  for (const colorway of COLORWAYS) {
    for (const [zone, capKey, legendKey] of zones) {
      it(`${colorway.name} ${zone} legend clears AA`, () => {
        const ratio = contrastRatio(
          colorway[capKey] as string,
          colorway[legendKey] as string,
        );
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});
