import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

const CELL = 128;
/** Legend glyphs sit well inside the cell so neighbours cannot bleed in. */
const INSET = 0.72;

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

  unique.forEach((label, i) => {
    const cx = i % cols;
    const cy = Math.floor(i / cols);

    // Long legends (PGUP, BKSP) have to come down in size or they clip.
    const size = CELL * INSET * (label.length > 2 ? 0.42 : label.length > 1 ? 0.58 : 0.78);
    ctx.font = `500 ${size}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.fillText(label, cx * CELL + CELL / 2, cy * CELL + CELL / 2);

    // Canvas y runs down, UV runs up.
    cell.set(label, [cx / cols, (rows - 1 - cy) / rows]);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return {
    texture,
    cell,
    size: [1 / cols, 1 / rows],
    dispose: () => texture.dispose(),
  };
}
