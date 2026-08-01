/**
 * WCAG relative luminance and contrast, used to keep keycap legends legible.
 *
 * The legends are text rendered inside an SVG, which WCAG 1.4.3 treats as text
 * — the surrounding `role="img"` only affects what assistive tech announces, not
 * whether a sighted low-vision user can read the key.
 */

const channel = (v: number): number =>
  v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

export function relativeLuminance(hex: string): number {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(full.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal-size text. Keycap legends render at 13px. */
export const AA_NORMAL = 4.5;
