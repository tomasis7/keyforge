import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type Config } from '../data/options';
import {
  HISTORY_COALESCE_MS,
  historyMethod,
  parseSearch,
  serializeParams,
} from './url';

describe('parseSearch', () => {
  it('accepts known ids', () => {
    expect(parseSearch('?l=tkl&k=retro')).toEqual({ layout: 'tkl', colorway: 'retro' });
  });

  it('drops unknown ids rather than trusting the URL', () => {
    expect(parseSearch('?l=ergo&k=<script>')).toEqual({});
  });

  it('drops known ids assigned to the wrong param', () => {
    // 'retro' is a colorway, not a layout.
    expect(parseSearch('?l=retro')).toEqual({});
  });

  it('ignores unrelated params', () => {
    expect(parseSearch('?utm_source=x&l=65')).toEqual({ layout: '65' });
  });

  it('returns nothing for an empty search', () => {
    expect(parseSearch('')).toEqual({});
  });
});

describe('serializeParams', () => {
  it('omits defaults so shared links stay short', () => {
    expect(serializeParams(DEFAULT_CONFIG)).toBe('');
  });

  it('writes only what differs from the default', () => {
    const config: Config = { ...DEFAULT_CONFIG, layout: 'tkl', wrist: 'walnut' };
    expect(serializeParams(config)).toBe('l=tkl&wr=walnut');
  });
});

describe('historyMethod', () => {
  it('collapses rapid successive edits into one entry', () => {
    expect(historyMethod(0)).toBe('replaceState');
    expect(historyMethod(HISTORY_COALESCE_MS - 1)).toBe('replaceState');
  });

  it('gives a deliberate, spaced-out edit its own entry', () => {
    expect(historyMethod(HISTORY_COALESCE_MS)).toBe('pushState');
    expect(historyMethod(5000)).toBe('pushState');
  });

  it('pushes on the very first write', () => {
    // lastWrite starts at -Infinity, so the first change is always undoable.
    expect(historyMethod(Number.POSITIVE_INFINITY)).toBe('pushState');
  });
});

describe('round trip', () => {
  it('recovers every non-default field', () => {
    const config: Config = {
      layout: 'tkl',
      case: 'burgundy',
      colorway: 'botanical',
      switches: 'bluejay',
      plate: 'brass',
      cable: 'ember',
      wrist: 'resin',
    };
    expect({ ...DEFAULT_CONFIG, ...parseSearch(`?${serializeParams(config)}`) }).toEqual(
      config,
    );
  });
});
