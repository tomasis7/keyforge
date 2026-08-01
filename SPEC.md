# KEYFORGE — Implementation Spec

> **Orchestrator → Implementer handoff document.**
> Implement this exactly. If something is ambiguous, prefer the simpler
> interpretation and note the decision in your milestone report.
> Orchestrator reviews each milestone against §10 before you proceed.

---

## 1. What we are building

**KEYFORGE** — a single-page, dark-theme, premium mechanical-keyboard
configurator. Portfolio piece. The visitor configures a custom keyboard
(layout, case finish, keycap colorway, switches, plate, extras) and sees
it rendered **live as a procedurally generated SVG** — the keyboard is
computed from layout data, not a static image.

**Killer feature (must work flawlessly):** switching layout
(65% → 75% → TKL) re-renders a different keyboard with a GSAP Flip
animation; switching colorway sends a ripple of recoloring across the keys.

**Secondary feature:** the whole configuration is encoded in the URL →
"Copy build link" produces a shareable link that restores the exact build.

---

## 2. Stack & hard constraints

| Concern | Decision |
|---|---|
| Build tool | Vite |
| Framework | React 18 + TypeScript (**strict mode**) |
| State | `zustand` |
| Animation | `gsap` (≥3.13; ScrollTrigger + Flip — both free, register from `gsap/all` or `gsap/ScrollTrigger`, `gsap/Flip`) |
| Styling | **Plain CSS. No Tailwind, no CSS-in-JS, no UI libraries.** Design tokens already provided at `src/styles/tokens.css` — use the variables, do not invent new hex values. |
| Fonts | Loaded in `tokens.css` (Space Grotesk + IBM Plex Mono) |
| Icons | None needed (text labels + CSS shapes only) |
| Images | None — everything is SVG/CSS |

Scaffold **in place** in the project root (this directory), e.g.
`npm create vite@latest . -- --template react-ts`, then
`npm i zustand gsap`.

---

## 3. File tree to produce

```
.
├── SPEC.md                     (this file — do not edit)
├── index.html
├── package.json / tsconfig.json / vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles/
    │   ├── tokens.css          (PROVIDED — do not edit)
    │   └── global.css          (reset, base elements, layout shells)
    ├── data/
    │   ├── layouts.ts          (§5.2 matrices)
    │   ├── options.ts          (§5.3 cases/colorways/switches/plates/extras)
    │   └── pricing.ts          (§5.4 base prices + price calculator)
    ├── lib/
    │   ├── keyboard.ts         (matrix → key geometry, zone classifier §5.5)
    │   └── url.ts              (state <-> search params §7.2)
    ├── store/
    │   └── configurator.ts     (zustand store §7.1)
    ├── animations/
    │   ├── motion.ts           (reduced-motion guard + shared easings)
    │   ├── hero.ts             (entrance timeline)
    │   ├── keyboard.ts         (recolor ripple + layout Flip)
    │   ├── price.ts            (count-up)
    │   └── scroll.ts           (ScrollTrigger reveals)
    └── components/
        ├── Hero.tsx
        ├── Configurator.tsx    (section shell: viewer + panel + PriceBar)
        ├── KeyboardSVG.tsx
        ├── OptionsPanel.tsx
        ├── SwatchGroup.tsx     (case finishes, colorways, cable colors)
        ├── ChoiceGroup.tsx     (layout, switches, plate — radio cards)
        ├── ExtrasGroup.tsx     (cable toggle+color, wrist rest)
        ├── PriceBar.tsx
        ├── BuildSummary.tsx    (modal drawer + copy-link)
        └── sections/
            ├── Materials.tsx
            ├── SwitchFeel.tsx
            ├── Specs.tsx
            └── Footer.tsx
```

---

## 4. Page structure (top → bottom)

1. **Hero** — full viewport. Kicker `CUSTOM MECHANICAL KEYBOARDS`,
   headline `Build your endgame.`, sub-copy (one sentence), CTA button
   `Start building` (smooth-scrolls to configurator), and the
   `KeyboardSVG` (current store state) as the visual centerpiece.
2. **Configurator** (`#configurator`) — heading `Configure yours`,
   two-column layout: `KeyboardSVG` (viewer) + `OptionsPanel`,
   then a sticky `PriceBar` at the bottom of the section.
3. **Materials** — 3 cards: CNC aluminum case / PBT dye-sub keycaps /
   gasket-mounted plate. Each: mono label, title, 2-sentence copy.
4. **SwitchFeel** — 3 columns (one per switch): name, feel descriptor,
   sound descriptor, actuation force. (Static content, not interactive.)
5. **Specs** — simple spec table (dimensions per layout, weight,
   connectivity: USB-C / BT5.1 / 2.4 GHz, battery 4000 mAh, hot-swap: yes).
6. **Footer** — big line `This configurator was designed & built by
   <Your Name>.`, sub `Want one for your product?`, mailto CTA.

Every content section below the hero animates in on scroll (§8.4).

---

## 5. Data contracts

### 5.1 Types (`data/`, `store/`)

```ts
export type LayoutId   = '65' | '75' | 'tkl';
export type CaseId     = 'black' | 'silver' | 'navy' | 'burgundy' | 'forest';
export type ColorwayId = 'mono' | 'carbon' | 'botanical' | 'midnight' | 'retro';
export type SwitchId   = 'redline' | 'brownfield' | 'bluejay';
export type PlateId    = 'alu' | 'brass' | 'pc';
export type CableId    = 'none' | 'ember' | 'sage' | 'ivory' | 'noir';
export type WristId    = 'none' | 'walnut' | 'resin';

export interface Config {
  layout: LayoutId; case: CaseId; colorway: ColorwayId;
  switches: SwitchId; plate: PlateId; cable: CableId; wrist: WristId;
}

export const DEFAULT_CONFIG: Config = {
  layout: '75', case: 'black', colorway: 'carbon',
  switches: 'redline', plate: 'alu', cable: 'none', wrist: 'none',
};
```

### 5.2 Keyboard layout matrices (`data/layouts.ts`)

Compact row format — the parser lives in `lib/keyboard.ts`:

```ts
export type KeyItem =
  | { t: 'key'; l: string; w?: number }  // key, label, width in u (default 1)
  | { t: 'gap'; w: number };             // horizontal gap, width in u

export interface KeyboardLayout { id: LayoutId; name: string; rows: KeyItem[][] }
```

**65%** — every row sums to 16u:

```ts
rows: [
  k('esc'), ...['1','2','3','4','5','6','7','8','9','0','-','='].map(k), k('bksp', 2), k('del'),
  k('tab', 1.5), ...['q','w','e','r','t','y','u','i','o','p','[',']'].map(k), k('\\', 1.5), k('pgup'),
  k('caps', 1.75), ...['a','s','d','f','g','h','j','k','l',';','\''].map(k), k('enter', 2.25), k('pgdn'),
  k('shift', 2.25), ...['z','x','c','v','b','n','m',',','.','/'].map(k), k('shift', 1.75), k('up'), k('end'),
  k('ctrl', 1.25), k('win', 1.25), k('alt', 1.25), k('space', 6.25), k('alt'), k('fn'), k('ctrl'), k('left'), k('down'), k('right'),
]
```

**75%** — F-row + the five 65% rows:

```ts
row0: [k('esc'), gap(0.25), k('f1'), k('f2'), k('f3'), k('f4'),
       gap(0.25), k('f5'), k('f6'), k('f7'), k('f8'),
       gap(0.25), k('f9'), k('f10'), k('f11'), k('f12'),
       gap(0.25), k('prt'), k('del')]   // sums to 16u
```

**TKL** — rows sum to 18.5u (caps row is 15u, left-aligned):

```ts
row0: [k('esc'), gap(0.5), f1..f4, gap(0.5), f5..f8, gap(0.5), f9..f12, gap(1), k('prt'), k('scr'), k('pse')]
row1: [k('`'), 1..0, '-', '=', k('bksp',2), gap(0.5), k('ins'), k('home'), k('pgup')]
row2: [k('tab',1.5), q..p, '[', ']', k('\\',1.5), gap(0.5), k('del'), k('end'), k('pgdn')]
row3: [k('caps',1.75), a..l, ';', '\'', k('enter',2.25)]                       // 15u
row4: [k('shift',2.25), z..m, ',', '.', '/', k('shift',2.75), gap(0.5), gap(1), k('up'), gap(1)]
row5: [k('ctrl',1.25), k('win',1.25), k('alt',1.25), k('space',6.25),
       k('alt',1.25), k('win',1.25), k('menu',1.25), k('ctrl',1.25),
       gap(0.5), k('left'), k('down'), k('right')]
```

Display-label mapping (render these glyphs, keep data labels as above):
`bksp→⌫  caps→⇪  shift→⇧  enter→↵  tab→⇥  win→⌘  space→'' (blank)
up→↑  down→↓  left→←  right→→` — all others render their label uppercased.

### 5.3 Options (`data/options.ts`)

```ts
interface CaseOption     { id: CaseId;     name: string; hex: string; price: number }
interface ColorwayOption { id: ColorwayId; name: string;
  alpha: string; mod: string; accent: string;              // keycap colors per zone
  onAlpha: string; onMod: string; onAccent: string;        // label colors
  price: number }
interface SwitchOption   { id: SwitchId; name: string; type: 'Linear'|'Tactile'|'Clicky';
  desc: string; sound: string; force: string; price: number }
interface PlateOption    { id: PlateId; name: string; desc: string; price: number }
```

Concrete data:

| Cases | hex | +$ |
|---|---|---|
| Anodized Black `black` | `#1C1C1E` | 0 |
| Silver `silver` | `#C9CCD1` | 40 |
| Navy `navy` | `#2B3A55` | 40 |
| Burgundy `burgundy` | `#5E2B35` | 60 |
| Forest `forest` | `#2E4235` | 60 |

| Colorway | alpha | mod | accent | +$ |
|---|---|---|---|---|
| Mono `mono` | `#E8E6E1` | `#B8B5AE` | `#2A2A2E` | 40 |
| Carbon `carbon` | `#3A3D42` | `#232528` | `#E4572E` | 55 |
| Botanical `botanical` | `#F2EDE4` | `#5B7A5E` | `#D9A441` | 65 |
| Midnight `midnight` | `#4A5A7A` | `#1E2430` | `#8FB8DE` | 65 |
| Retro `retro` | `#F4E9D8` | `#C97B5A` | `#4E6E58` | 80 |

Label colors per colorway (on light keys `#1A1A1E`, on dark keys `#F2F0EA`):
- mono: onAlpha dark, onMod dark, onAccent light
- carbon: all light
- botanical: onAlpha dark, onMod light, onAccent dark
- midnight: onAlpha light, onMod light, onAccent dark
- retro: all dark

| Switches | type | desc | sound | force | +$ |
|---|---|---|---|---|---|
| `redline` | Linear | Smooth, consistent press top to bottom | Deep, muted thock | 45 gf | 35 |
| `brownfield` | Tactile | Noticeable bump at actuation, no click | Soft, rounded thud | 55 gf | 45 |
| `bluejay` | Clicky | Sharp bump with audible click | Crisp, bright snap | 60 gf | 55 |

| Plates | desc | +$ |
|---|---|---|
| `alu` Aluminum | Balanced flex, neutral sound | 0 |
| `brass` Brass | Firm, higher-pitched, premium weight | 25 |
| `pc` Polycarbonate | Softer, deeper, more flex | 15 |

| Extras | +$ |
|---|---|
| Coiled cable `none`/`ember #E4572E`/`sage #7A9E7E`/`ivory #EFE9DC`/`noir #232528` | 0 / 25 |
| Wrist rest `none`/`walnut`/`resin` | 0 / 45 / 45 |

### 5.4 Pricing (`data/pricing.ts`)

Base price per layout: `65 → 289`, `75 → 309`, `tkl → 329`.
`calcPrice(config): { total: number; items: { label: string; amount: number }[] }`
— `items` is the itemized list used by `BuildSummary`.

### 5.5 Zone classifier (`lib/keyboard.ts`)

```ts
const ACCENT_KEYS = ['esc', 'enter', 'up', 'down', 'left', 'right', 'space'];
const MOD_KEYS = ['bksp','tab','caps','shift','ctrl','win','alt','fn','menu',
  'del','ins','home','end','pgup','pgdn','prt','scr','pse'];
export function zoneOf(label: string): 'alpha' | 'mod' | 'accent'
// accent if in ACCENT_KEYS; mod if in MOD_KEYS or matches /^f\d+$/; else alpha
```

---

## 6. Keyboard rendering (`KeyboardSVG.tsx` + `lib/keyboard.ts`)

**Geometry constants:** `U = 48` (1u pitch, px), `KEY_PAD = 3`,
`CASE_PAD = 20`, `KEY_R = 7` (outer radius), `TOP_R = 5` (top-surface radius).

1. Parse the active layout matrix into absolute key rects: walk each row
   with an `x` cursor; keys and gaps advance `x += w * U`; row `y = rowIndex * U`.
2. `viewBox = "0 0 (maxRowWidth + 2*CASE_PAD) (rowCount*U + 2*CASE_PAD)"`,
   `<svg width="100%">` — the board scales itself responsively. No JS resize.
3. Per key render a `<g class="key" data-key-id="r{row}k{index}">`:
   - **Base rect** (keycap sides): `KEY_PAD` inset, `rx=KEY_R`,
     fill = zone color darkened: `style={{ fill: 'color-mix(in srgb, {zone} 68%, black)' }}`.
   - **Top rect** (keycap face): inset `KEY_PAD+4` on x, `KEY_PAD+3` top /
     `KEY_PAD+10` bottom on y, `rx=TOP_R`, fill = zone color.
   - **Label** `<text>` centered in the top rect, `font-family: var(--font-mono)`,
     `font-size: 13`, fill = the colorway's label color for that zone.
     Skip label for `space`.
4. **Case**: one `<rect>` behind all keys, full viewBox, `rx=18`,
   fill = case hex, `stroke: var(--line-strong)`.
5. Expose keys in **row-major DOM order** — the ripple animation depends
   on it (§8.2). Re-renders must preserve `data-key-id` stability per
   (row, index) so Flip can match keys across layout changes.

Zones are colored from the **active colorway**: `alpha` / `mod` / `accent`.

---

## 7. State

### 7.1 Store (`store/configurator.ts`, zustand)

```ts
interface ConfigStore extends Config {
  set: <K extends keyof Config>(key: K, value: Config[K]) => void;
  randomize: () => void;   // pick a random valid value for every axis
  reset: () => void;       // back to DEFAULT_CONFIG
}
```
Selectors: `useConfig()` (whole config), `usePrice()` → `calcPrice(config)`.

### 7.2 URL sync (`lib/url.ts`)

- On store init: read `window.location.search`, map params onto
  `DEFAULT_CONFIG` (ignore/validate unknown values).
- On every config change: `history.replaceState` with encoded params.
- Param names: `l, c, k, s, p, cab, wr`. **Omit params equal to defaults.**
- Example: `?l=tkl&c=navy&k=retro&s=bluejay&cab=ember&wr=walnut`
- "Copy build link" = copy `location.href` after sync.

---

## 8. Animation spec (GSAP)

All easings/durations mirror `tokens.css`. Everything runs through
`animations/motion.ts`:

```ts
export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```
If reduced: **skip every animation** — content must render in its final
state with no motion (render visible by default; animate with
`gsap.from`/`timeline.from` so skipping is safe).

### 8.1 Hero entrance (`animations/hero.ts`, runs once on mount)

Timeline (defaults `ease: 'expo.out'`):
1. Kicker: `y: 16, opacity: 0 → visible`, 0.5s
2. Headline (split into words, each in overflow-hidden wrapper):
   `yPercent: 110 → 0`, stagger 0.06, 0.9s
3. Keyboard keys: `scale: 0 → 1`, `transformOrigin: 'center'`,
   `stagger: { each: 0.006, from: 'random' }`, 0.5s, `ease: 'back.out(1.7)'`
4. Sub-copy + CTA: fade-up 0.5s
Overlap each step with the previous by ~0.15s (`position: '-=0.35'` etc.).

### 8.2 Keyboard reactions (`animations/keyboard.ts`)

- **Colorway change** → *ripple*: tween the **top rects'** fill to new
  zone colors + labels' fill, DOM order, `stagger: 0.005`, 0.3s per key,
  `ease: 'power2.out'`. Trigger via store subscription, not React re-render
  of fills (React renders the new state; GSAP tweens from old — implement
  by tweening then letting React commit, or set final fills in the tween
  `onComplete`; pick the simpler reliable approach).
- **Case change** → tween case rect fill, 0.3s.
- **Layout change** → *Flip*:
  in the layout option handler, `const state = Flip.getState('.key')`
  **before** dispatching the store update; then in `useLayoutEffect` after
  React commits the new matrix:
  `Flip.from(state, { duration: 0.6, ease: 'expo.out', absolute: true,
  scale: true, stagger: 0.004, onEnter: el => gsap.fromTo(el,
  { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4 }),
  onLeave: el => gsap.to(el, { opacity: 0, scale: 0.6, duration: 0.3 }) })`.

### 8.3 Price count-up (`animations/price.ts`)

On total change: tween a `{ val }` object old → new, 0.5s, `snap: { val: 1 }`,
render as `$ {Math.round(val)}`. Respect reduced motion (set instantly).

### 8.4 Scroll reveals (`animations/scroll.ts`)

Register `ScrollTrigger`. For every `[data-reveal]` element:
`from { y: 40, opacity: 0 }`, 0.8s, `ease: 'expo.out'`,
`stagger: 0.08` among siblings sharing `data-reveal-group`,
`scrollTrigger: { trigger: el, start: 'top 85%', once: true }`.

### 8.5 Micro-interactions

- Selected swatch: scale `1 → 0.88 → 1` (0.35s, spring ease) + accent ring.
- Buttons: hover lift `y: -2` via CSS transitions (`--d-fast`).
- Randomize ("Surprise me" button in `OptionsPanel` header): calls
  `store.randomize()` — ripple/Flip fire naturally from the state change.

---

## 9. Accessibility & responsiveness

- Every option group is a real `<fieldset>` + `<legend>`; swatches and
  choices are `<input type="radio">` (visually hidden but focusable) or
  native `<button>` with `aria-pressed` — pick one pattern, keep it
  consistent and **keyboard operable** (Tab + arrows/Space).
- `:focus-visible` → 2px outline `var(--accent)`, offset 2px.
- `KeyboardSVG`: `role="img"`, dynamic `aria-label` e.g.
  `"75% keyboard, navy case, retro keycaps"`.
- `PriceBar` total: `aria-live="polite"`.
- Text contrast ≥ 4.5:1 against `--bg-*` (token colors already comply).
- Layout: ≥1024px two-column configurator (viewer 7fr / panel 5fr,
  gap `--space-12`); <1024px stacked, viewer first. Container
  `max-width: var(--container)`, gutters `var(--gutter)`.
- `BuildSummary` modal: trap focus, `Esc` closes, backdrop click closes.

---

## 10. Milestones & acceptance criteria

### M1 — Scaffold + tokens + static procedural renderer
- [ ] Vite react-ts app runs; `tokens.css` + `global.css` imported; strict TS clean
- [ ] All three matrices (§5.2) parse to correct geometry; rows sum as specified
- [ ] `KeyboardSVG` renders any config statically: case, two-tone keycaps, labels, zones
- [ ] Switching layout via a temporary `<select>` shows all 3 boards correctly
- [ ] `npm run build` passes, zero console errors/warnings

### M2 — Store + options panel + URL sync + price
- [ ] zustand store with `set/randomize/reset`; all 7 axes wired to UI
- [ ] Fieldset/legend semantics; keyboard-operable options
- [ ] URL round-trip: configure → reload → identical build; defaults omitted
- [ ] `PriceBar` shows correct itemized total for ≥5 hand-checked configs
- [ ] `BuildSummary` modal lists items + total + working copy-link (clipboard)

### M3 — Animation layer
- [ ] Hero timeline matches §8.1 (order, staggers, overlaps)
- [ ] Colorway ripple visibly sweeps row-major across the board
- [ ] Layout Flip animates keys to new positions (no jump-cut)
- [ ] Price count-up tweens; scroll reveals fire once per section
- [ ] `prefers-reduced-motion`: zero motion, correct final states

### M4 — Polish + content sections
- [ ] Materials / SwitchFeel / Specs / Footer content in place (§4)
- [ ] Randomize works; selected swatch micro-interaction; hover states
- [ ] Responsive: 1440 / 1024 / 768 / 390 all clean (no overflow, no overlap)
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95
- [ ] `npm run build` + preview passes; zero console errors

---

## 11. Orchestrator review checklist (what I verify per milestone)

1. Spec fidelity — every box in §10 ticked with evidence (screenshot/GIF
   or described manual test).
2. Token discipline — no hardcoded hex/px outside `tokens.css` except
   the keyboard-geometry constants (§6) and option data (§5.3).
3. Type safety — `strict` clean, no `any` unless justified in a comment.
4. Simplicity — no extra dependencies; no speculative features beyond spec.
5. Git hygiene (if repo initialized): one commit per milestone, clear messages.

*Deviations require orchestrator sign-off before continuing to the next
milestone.*
