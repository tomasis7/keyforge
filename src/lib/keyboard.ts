import { LAYOUTS, type LayoutId } from '../data/layouts';

export const KEY_U = 48;
export const KEY_PAD = 3;
export const CASE_PAD = 20;
export const KEY_R = 7;
export const TOP_R = 5;

export type Zone = 'alpha' | 'mod' | 'accent';

const ACCENT_KEYS = ['esc', 'enter', 'up', 'down', 'left', 'right', 'space'];
const MOD_KEYS = [
  'bksp', 'tab', 'caps', 'shift', 'ctrl', 'win', 'alt', 'fn', 'menu',
  'del', 'ins', 'home', 'end', 'pgup', 'pgdn', 'prt', 'scr', 'pse',
];

const DISPLAY: Record<string, string> = {
  bksp: '⌫',
  caps: '⇪',
  shift: '⇧',
  enter: '↵',
  tab: '⇥',
  win: '⌘',
  space: '',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export function zoneOf(label: string): Zone {
  if (ACCENT_KEYS.includes(label)) return 'accent';
  if (MOD_KEYS.includes(label) || /^f\d+$/.test(label)) return 'mod';
  return 'alpha';
}

export function displayLabel(label: string): string {
  if (label in DISPLAY) return DISPLAY[label];
  return label.toUpperCase();
}

export interface KeyRect {
  keyId: string;
  label: string;
  zone: Zone;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  tx: number;
  ty: number;
  tw: number;
  th: number;
}

export interface Board {
  name: string;
  widthU: number;
  widthPx: number;
  heightPx: number;
  keys: KeyRect[];
}

export function buildBoard(layoutId: LayoutId): Board {
  const layout = LAYOUTS.find((l) => l.id === layoutId);
  if (!layout) throw new Error(`Unknown layout: ${layoutId}`);

  const rowsU = layout.rows.map((row) => row.reduce((sum, item) => sum + (item.w ?? 1), 0));
  const widthU = Math.max(...rowsU);

  const keys: KeyRect[] = [];
  // Key identity is semantic (label + occurrence), not positional. React
  // reconciles on keyId, so a key that exists in both layouts keeps its DOM
  // node and Flip animates it travelling to its new home — the board reads as
  // reconfiguring rather than as a grid resizing under static contents.
  const seen = new Map<string, number>();
  layout.rows.forEach((row, rowIndex) => {
    let x = CASE_PAD;
    for (const item of row) {
      if (item.t === 'gap') {
        x += item.w * KEY_U;
        continue;
      }
      const w = (item.w ?? 1) * KEY_U;
      const y = CASE_PAD + rowIndex * KEY_U;
      const zone = zoneOf(item.l);
      const occurrence = seen.get(item.l) ?? 0;
      seen.set(item.l, occurrence + 1);
      keys.push({
        keyId: `${item.l}-${occurrence}`,
        label: item.l === 'space' ? '' : displayLabel(item.l),
        zone,
        bx: x + KEY_PAD,
        by: y + KEY_PAD,
        bw: w - 2 * KEY_PAD,
        bh: KEY_U - 2 * KEY_PAD,
        tx: x + KEY_PAD + 4,
        ty: y + KEY_PAD + 3,
        tw: w - 2 * (KEY_PAD + 4),
        th: KEY_U - (KEY_PAD + 3) - (KEY_PAD + 10),
      });
      x += w;
    }
  });

  return {
    name: layout.name,
    widthU,
    widthPx: widthU * KEY_U + 2 * CASE_PAD,
    heightPx: layout.rows.length * KEY_U + 2 * CASE_PAD,
    keys,
  };
}
