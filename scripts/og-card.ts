/**
 * The Open Graph card's markup, kept separate from the browser that rasterises
 * it so it can be imported (and fingerprinted) without launching Chrome.
 *
 * The board is built from the same `buildBoard` geometry and the same colorway
 * data the app renders, so the card shows the real product rather than a
 * mock-up that can drift from it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CASE_OPTIONS, COLORWAYS } from '../src/data/options';
import { keyBaseColor } from '../src/lib/color';
import { buildBoard, KEY_R, TOP_R } from '../src/lib/keyboard';

export const WIDTH = 1200;
export const HEIGHT = 630;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Mirrors KeyboardSVG, as a string. Geometry and colours are shared, markup is not. */
export function boardSvg(layout: '65' | '75' | 'tkl', caseHex: string, colorwayId: string): string {
  const board = buildBoard(layout);
  const cw = COLORWAYS.find((c) => c.id === colorwayId) ?? COLORWAYS[0];
  const cap = { alpha: cw.alpha, mod: cw.mod, accent: cw.accent };
  const ink = { alpha: cw.onAlpha, mod: cw.onMod, accent: cw.onAccent };

  const keys = board.keys
    .map((k) => {
      const fill = cap[k.zone];
      const label =
        k.label === ''
          ? ''
          : `<text x="${k.tx + k.tw / 2}" y="${k.ty + k.th / 2}" text-anchor="middle" dominant-baseline="central" fill="${ink[k.zone]}" font-family="'IBM Plex Mono', monospace" font-size="13">${esc(k.label)}</text>`;
      return (
        `<g>` +
        `<rect x="${k.bx}" y="${k.by}" width="${k.bw}" height="${k.bh}" rx="${KEY_R}" fill="${keyBaseColor(fill)}"/>` +
        `<rect x="${k.tx}" y="${k.ty}" width="${k.tw}" height="${k.th}" rx="${TOP_R}" fill="${fill}"/>` +
        `<rect x="${k.tx}" y="${k.ty}" width="${k.tw}" height="${k.th}" rx="${TOP_R}" fill="url(#sheen)"/>` +
        label +
        `</g>`
      );
    })
    .join('');

  return `<svg viewBox="0 0 ${board.widthPx} ${board.heightPx}" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity="0.08"/>
      <stop offset="0.45" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${board.widthPx}" height="${board.heightPx}" rx="18" fill="${caseHex}" stroke="rgba(255,255,255,0.10)"/>
  ${keys}
</svg>`;
}

/**
 * The site's own woff2 files, inlined as data URIs.
 *
 * The card used to link the Google Fonts stylesheet, which meant it needed
 * network access to render and — now that the site self-hosts — was not
 * guaranteed to use the same binaries the site ships. Inlining the local files
 * makes `npm run og` work offline and makes the preview's type identical to the
 * page's by construction. It also folds the fonts into the fingerprint, so
 * swapping a typeface is caught like any other card input.
 */
function fontFaces(): string {
  const dir = resolve(process.cwd(), 'src/styles/fonts');
  const css = readFileSync(resolve(process.cwd(), 'src/styles/fonts.css'), 'utf8');
  // Rewrite each url('./fonts/x.woff2') to the file's base64 contents.
  return css.replace(/url\('\.\/fonts\/([^']+)'\)/g, (_match, file: string) => {
    const data = readFileSync(resolve(dir, file)).toString('base64');
    return `url('data:font/woff2;base64,${data}')`;
  });
}

export function page(): string {
  const caseOption = CASE_OPTIONS.find((c) => c.id === 'black') ?? CASE_OPTIONS[0];
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
${fontFaces()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    background: #0B0B0D; color: #F2F0EA;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    position: relative;
  }
  .glow {
    position: absolute; inset: -20% -10% auto -10%; height: 90%;
    background: radial-gradient(ellipse at 30% 0%, rgba(228,87,46,0.20), transparent 60%);
  }
  .pad { position: relative; padding: 64px 72px; }
  .wordmark {
    font-size: 22px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  }
  .wordmark span { color: #E4572E; }
  .kicker {
    margin-top: 44px;
    font-family: 'IBM Plex Mono', monospace; font-size: 15px;
    letter-spacing: 0.22em; text-transform: uppercase; color: #E4572E;
  }
  h1 {
    margin-top: 14px; font-size: 82px; font-weight: 700;
    letter-spacing: -0.03em; line-height: 0.98;
  }
  h1 span { color: #E4572E; }
  p {
    margin-top: 18px; font-size: 22px; line-height: 1.45;
    color: rgba(242,240,234,0.62); max-width: 620px;
  }
  /* Tilted like the hero board, cropped at the bottom edge for depth. */
  .board {
    position: absolute; left: 50%; bottom: -132px; width: 1180px;
    transform: translateX(-50%) perspective(1400px) rotateX(34deg);
    transform-origin: 50% 100%;
    filter: drop-shadow(0 40px 60px rgba(0,0,0,0.65));
  }
</style></head>
<body>
  <div class="glow"></div>
  <div class="pad">
    <div class="wordmark">Keyforge<span>.</span></div>
    <div class="kicker">Custom Mechanical Keyboards</div>
    <h1>Build your endgame<span>.</span></h1>
    <p>Layout, case, keycaps, switches and plate — priced live, shareable in one link.</p>
  </div>
  <div class="board">${boardSvg('75', caseOption.hex, 'carbon')}</div>
</body></html>`;
}

/**
 * A hash of everything the rendered card depends on: the template above plus,
 * through it, the layout geometry and every colour in the palette. The
 * committed value is asserted in a test, so changing the palette without
 * regenerating the card fails the build instead of silently shipping a stale
 * preview.
 */
export function ogFingerprint(): string {
  return createHash('sha256').update(page()).digest('hex').slice(0, 16);
}
