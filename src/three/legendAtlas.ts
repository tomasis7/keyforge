import { CanvasTexture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace } from 'three';

/**
 * Cell size in the atlas. Generous relative to the ~25 screen pixels a legend
 * covers at hero camera distance, because the mip chain built from this is what
 * actually gets sampled: detail here survives two or three levels down.
 */
const CELL = 192;
/** Legend glyphs sit well inside the cell so neighbours cannot bleed in. */
const INSET = 0.72;
/**
 * Heavier than the SVG board's legends. At hero distance a 500 weight puts too
 * few lit pixels into each stroke and the lettering reads as grey haze rather
 * than as characters.
 */
const WEIGHT = 700;
const FONT_STACK = `'IBM Plex Mono', ui-monospace, monospace`;

export interface LegendAtlas {
  texture: CanvasTexture;
  /** Bottom-left UV of each label's cell. */
  cell: Map<string, [number, number]>;
  /** Size of one cell in UV space, on each axis. The grid is rarely square. */
  size: [number, number];
  dispose: () => void;
}

/**
 * Draws every distinct legend once into a grid, so the whole board's lettering
 * is a single texture and every keycap is still one instanced draw call.
 *
 * The glyph set is wider than the latin subset we self-host — the arrows and
 * modifier symbols live in ranges those files do not cover — so the font stack
 * keeps its fallbacks and canvas resolves them per glyph, exactly as the SVG
 * board already does.
 */
export function buildLegendAtlas(labels: string[]): LegendAtlas {
  const unique = [...new Set(labels.filter((l) => l !== ''))].sort();
  const cols = Math.max(1, Math.ceil(Math.sqrt(unique.length)));
  const rows = Math.max(1, Math.ceil(unique.length / cols));

  const canvas = document.createElement('canvas');
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d')!;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  const cell = new Map<string, [number, number]>();

  // The budget a glyph may occupy, on both axes.
  const box = CELL * INSET;

  unique.forEach((label, i) => {
    const cx = i % cols;
    const cy = Math.floor(i / cols);

    // Fit to the box by measurement rather than by a per-length guess. The old
    // fixed multipliers (0.78 / 0.58 / 0.42 of the box) were sized for the
    // worst case at each length, which left every short legend — the alphas and
    // digits, most of the board — rendering far smaller than it could.
    // Only width ever binds here: the font stack is monospaced, so advance
    // width grows with the label while cap height does not.
    ctx.font = `${WEIGHT} ${box}px ${FONT_STACK}`;
    const width = ctx.measureText(label).width;
    const size = width > box ? box * (box / width) : box;

    ctx.font = `${WEIGHT} ${size}px ${FONT_STACK}`;
    ctx.fillText(label, cx * CELL + CELL / 2, cy * CELL + CELL / 2);

    // Canvas y runs down, UV runs up.
    cell.set(label, [cx / cols, (rows - 1 - cy) / rows]);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Mipmapped, which the atlas previously was not. A legend covers roughly 25
  // screen pixels at hero distance against a 192px cell — about 8x minification.
  // Point-sampling a linear filter that far down makes thin strokes alias in and
  // out between frames, which is most of why the lettering read as faint rather
  // than small. The mip chain resolves the stroke instead of gambling on it.
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  // The legends sit on caps raked away from the camera by the row tilt, so the
  // sampling footprint is markedly anisotropic.
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return {
    texture,
    cell,
    size: [1 / cols, 1 / rows],
    dispose: () => texture.dispose(),
  };
}
