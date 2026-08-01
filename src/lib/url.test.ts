import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type Config } from '../data/options';
import { parseSearch, serializeParams } from './url';

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
