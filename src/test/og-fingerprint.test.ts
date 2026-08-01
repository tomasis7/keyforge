import { describe, expect, it } from 'vitest';
import { ogFingerprint, page } from '../../scripts/og-card';
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

  /**
   * The card must render from local files alone. It used to link the Google
   * Fonts stylesheet, which meant `npm run og` needed network access and the
   * preview's type was not guaranteed to match the binaries the site ships.
   */
  it('is self-contained, with no external references', () => {
    const html = page();
    const external = html.match(/https?:\/\/[^"')\s]+/g) ?? [];
    // The SVG namespace is a identifier, not a fetch.
    const fetched = external.filter((url) => url !== 'http://www.w3.org/2000/svg');
    expect(fetched).toEqual([]);
  });

  it('embeds the same fonts the site serves', () => {
    const html = page();
    expect(html).toContain("font-family: 'Space Grotesk'");
    expect(html).toContain("font-family: 'IBM Plex Mono'");
    expect(html).toContain('data:font/woff2;base64,');
  });
});
