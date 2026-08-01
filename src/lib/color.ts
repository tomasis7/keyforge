/**
 * The keycap side wall is a darkened version of the cap face. This used to be
 * expressed as `color-mix(in srgb, <cap> 68%, black)` directly in the SVG, but
 * GSAP cannot tween a color-mix() string, so the side wall snapped to its new
 * value while the face tweened. Resolving the mix to a real hex here lets both
 * animate together.
 */
export const KEY_BASE_SHADE = 0.68;

const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

const toChannels = (hex: string): [number, number, number] => {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

/**
 * Mix `hex` toward black, keeping `keep` of the original. Operates in
 * gamma-encoded sRGB so the result is identical to `color-mix(in srgb, ...)`.
 */
export function mixWithBlack(hex: string, keep: number): string {
  const channels = toChannels(hex);
  if (channels.some(Number.isNaN)) return hex;
  return `#${channels
    .map((c) => clampByte(c * keep).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The side-wall colour for a keycap whose face is `hex`. */
export const keyBaseColor = (hex: string): string => mixWithBlack(hex, KEY_BASE_SHADE);
