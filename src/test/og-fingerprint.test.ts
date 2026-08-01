import { describe, expect, it } from 'vitest';
import { ogFingerprint } from '../../scripts/og-card';
import committed from './og-fingerprint.json';

/**
 * The share card is a committed PNG, generated on demand rather than in CI so
 * that neither CI nor a deploy needs a browser. The cost of that choice is that
 * it can go stale: change a colorway and the card still shows the old one, and
 * nothing would say so.
 *
 * This closes that gap without putting a browser in CI. The fingerprint covers
 * the card template and, through it, the board geometry and every colour in the
 * palette — so the inputs to the image are checked even though the image itself
 * is not re-rendered.
 */
describe('Open Graph card', () => {
  it('is up to date with the palette and geometry it is generated from', () => {
    expect(ogFingerprint()).toBe(committed.fingerprint);
  });
});
