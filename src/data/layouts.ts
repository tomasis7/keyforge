export type LayoutId = '65' | '75' | 'tkl';

export type KeyItem =
  | { t: 'key'; l: string; w?: number }
  | { t: 'gap'; w: number };

export interface KeyboardLayout {
  id: LayoutId;
  name: string;
  rows: KeyItem[][];
}

const k = (l: string, w?: number): KeyItem => ({ t: 'key', l, w });
const gap = (w: number): KeyItem => ({ t: 'gap', w });

const NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const QROW = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'];
const AROW = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];
const ZROW = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];
const F1_4 = ['f1', 'f2', 'f3', 'f4'];
const F5_8 = ['f5', 'f6', 'f7', 'f8'];
const F9_12 = ['f9', 'f10', 'f11', 'f12'];

const MAIN_ROWS: KeyItem[][] = [
  [k('esc'), ...NUM.map((n) => k(n)), k('bksp', 2), k('del')],
  [k('tab', 1.5), ...QROW.map((q) => k(q)), k('\\', 1.5), k('pgup')],
  [k('caps', 1.75), ...AROW.map((a) => k(a)), k('enter', 2.25), k('pgdn')],
  [k('shift', 2.25), ...ZROW.map((z) => k(z)), k('shift', 1.75), k('up'), k('end')],
  [k('ctrl', 1.25), k('win', 1.25), k('alt', 1.25), k('space', 6.25), k('alt'), k('fn'), k('ctrl'), k('left'), k('down'), k('right')],
];

const TKL_ROWS: KeyItem[][] = [
  [k('esc'), gap(0.5), ...F1_4.map((n) => k(n)), gap(0.5), ...F5_8.map((n) => k(n)), gap(0.5), ...F9_12.map((n) => k(n)), gap(1), k('prt'), k('scr'), k('pse')],
  [k('`'), ...NUM.map((n) => k(n)), k('bksp', 2), gap(0.5), k('ins'), k('home'), k('pgup')],
  [k('tab', 1.5), ...QROW.map((q) => k(q)), k('\\', 1.5), gap(0.5), k('del'), k('end'), k('pgdn')],
  [k('caps', 1.75), ...AROW.map((a) => k(a)), k('enter', 2.25)],
  [k('shift', 2.25), ...ZROW.map((z) => k(z)), k('shift', 2.75), gap(0.5), gap(1), k('up'), gap(1)],
  [k('ctrl', 1.25), k('win', 1.25), k('alt', 1.25), k('space', 6.25), k('alt', 1.25), k('win', 1.25), k('menu', 1.25), k('ctrl', 1.25), gap(0.5), k('left'), k('down'), k('right')],
];

export const LAYOUTS: KeyboardLayout[] = [
  { id: '65', name: '65%', rows: MAIN_ROWS },
  {
    id: '75',
    name: '75%',
    rows: [
      [k('esc'), gap(0.25), ...F1_4.map((n) => k(n)), gap(0.25), ...F5_8.map((n) => k(n)), gap(0.25), ...F9_12.map((n) => k(n)), gap(0.25), k('prt'), k('del')],
      // Spec amendment (orchestrator-approved): number row starts with ` —
      // MAIN_ROWS[0] has esc in this position, which would duplicate esc.
      [k('`'), ...NUM.map((n) => k(n)), k('bksp', 2), k('del')],
      ...MAIN_ROWS.slice(1),
    ],
  },
  { id: 'tkl', name: 'TKL', rows: TKL_ROWS },
];
