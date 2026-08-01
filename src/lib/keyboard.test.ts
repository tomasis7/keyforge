import { describe, expect, it } from 'vitest';
import { LAYOUTS, type LayoutId } from '../data/layouts';
import { boardSpecs, buildBoard, displayLabel, zoneOf } from './keyboard';

const ids = LAYOUTS.map((l) => l.id);

/**
 * These are the invariants that fail *silently*: a mis-summed row or a
 * duplicated keyId still renders a plausible-looking keyboard, just a wrong
 * one, with no error anywhere.
 */
describe('layout geometry', () => {
  const EXPECTED_WIDTH_U: Record<LayoutId, number> = { '65': 16, '75': 16, tkl: 18.5 };

  it.each(ids)('%s rows all sum to the board width', (id) => {
    const layout = LAYOUTS.find((l) => l.id === id)!;
    const board = buildBoard(id);
    const sums = layout.rows.map((row) =>
      row.reduce((total, item) => total + (item.w ?? 1), 0),
    );
    for (const sum of sums) {
      expect(sum).toBeLessThanOrEqual(board.widthU);
    }
    // At least one row must actually reach the full width, otherwise widthU is
    // being set by nothing and the case would be mis-sized.
    expect(Math.max(...sums)).toBe(board.widthU);
  });

  it.each(ids)('%s has the expected width in units', (id) => {
    expect(buildBoard(id).widthU).toBe(EXPECTED_WIDTH_U[id]);
  });

  it.each(ids)('%s produces unique key ids', (id) => {
    const keyIds = buildBoard(id).keys.map((k) => k.keyId);
    expect(new Set(keyIds).size).toBe(keyIds.length);
  });

  it.each(ids)('%s keeps every key inside the case', (id) => {
    const board = buildBoard(id);
    for (const key of board.keys) {
      expect(key.bx).toBeGreaterThanOrEqual(0);
      expect(key.by).toBeGreaterThanOrEqual(0);
      expect(key.bx + key.bw).toBeLessThanOrEqual(board.widthPx);
      expect(key.by + key.bh).toBeLessThanOrEqual(board.heightPx);
    }
  });

  it('rejects an unknown layout', () => {
    expect(() => buildBoard('ergo' as LayoutId)).toThrow(/Unknown layout/);
  });

  it('does not duplicate esc on 75%', () => {
    const escapes = buildBoard('75').keys.filter((k) => k.label === 'ESC');
    expect(escapes).toHaveLength(1);
  });
});

describe('key identity is semantic', () => {
  it('reuses the same id for a key that survives a layout change', () => {
    const on65 = new Set(buildBoard('65').keys.map((k) => k.keyId));
    const on75 = new Set(buildBoard('75').keys.map((k) => k.keyId));
    // Every 65% key exists on 75%, so that transition adds keys but removes
    // none — this is what lets Flip morph rather than cross-fade.
    for (const id of on65) {
      expect(on75.has(id)).toBe(true);
    }
  });

  it('distinguishes repeated labels by occurrence', () => {
    const shifts = buildBoard('65').keys.filter((k) => k.keyId.startsWith('shift-'));
    expect(shifts.map((k) => k.keyId)).toEqual(['shift-0', 'shift-1']);
  });
});

describe('boardSpecs', () => {
  it('reproduces the 65% figures the spec table already quoted', () => {
    expect(boardSpecs('65')).toMatchObject({ widthMm: 322, depthMm: 124 });
  });

  it('gives boards of equal width in units the same width in mm', () => {
    // 65% and 75% are both 16u; only their row count differs.
    expect(buildBoard('65').widthU).toBe(buildBoard('75').widthU);
    expect(boardSpecs('65').widthMm).toBe(boardSpecs('75').widthMm);
  });

  it('makes TKL wider than 75%, matching 18.5u vs 16u', () => {
    expect(boardSpecs('tkl').widthMm).toBeGreaterThan(boardSpecs('75').widthMm);
  });

  it('gives boards with equal row counts the same depth', () => {
    expect(boardSpecs('75').depthMm).toBe(boardSpecs('tkl').depthMm);
    expect(boardSpecs('65').depthMm).toBeLessThan(boardSpecs('75').depthMm);
  });

  it('scales weight with plate area, never quoting one figure for all', () => {
    const weights = LAYOUTS.map((l) => boardSpecs(l.id).weightKg);
    expect(new Set(weights).size).toBe(LAYOUTS.length);
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
  });
});

describe('zone classification', () => {
  it('routes accents, mods and alphas', () => {
    expect(zoneOf('esc')).toBe('accent');
    expect(zoneOf('enter')).toBe('accent');
    expect(zoneOf('shift')).toBe('mod');
    expect(zoneOf('f7')).toBe('mod');
    expect(zoneOf('q')).toBe('alpha');
  });
});

describe('display labels', () => {
  it('maps glyphs and uppercases the rest', () => {
    expect(displayLabel('bksp')).toBe('⌫');
    expect(displayLabel('space')).toBe('');
    expect(displayLabel('q')).toBe('Q');
  });
});
