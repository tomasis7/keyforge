# KEYFORGE

A custom mechanical keyboard configurator. Pick a layout, case, keycap colorway,
switches, plate and extras; the board is drawn procedurally as SVG from real
layout matrices, the price updates live, and the whole build round-trips through
the URL so a configuration is shareable as a link.

## Commands

```bash
npm install
npm run dev        # vite dev server
npm run verify     # typecheck + lint + test + build
```

Individually: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Architecture

```
data/          layout matrices, option catalogues, pricing tables
  ↓
lib/           pure functions: keyboard geometry, URL (de)serialisation, colour
  ↓
store/         zustand store, subscribed to the URL
  ↓
components/    SVG viewer, option controls, sections, modal
animations/    GSAP: hero, Flip + recolour, price count-up, scroll reveals
```

The layering is the point: changing a colorway or adding a layout means editing
`data/`, not hunting through CSS or hand-drawn SVG. `lib/` has no React and no
DOM dependency, which is why it is where the test suite is aimed.

### Keyboard geometry

`data/layouts.ts` describes each board as rows of `{ t: 'key', l, w }` and
`{ t: 'gap', w }` items measured in **units** (1u = one alpha key). `buildBoard`
turns a layout into absolute pixel rectangles. Every row must sum to the same
width in units, or the board renders subtly wrong with no error — hence the
row-sum tests.

### Key identity

`keyId` is `<label>-<occurrence>`, not a row/column position. React reconciles on
that key, so a key present in two layouts keeps its DOM node across a layout
change and GSAP Flip animates it travelling to its new home. Positional ids would
make the same transition read as grid cells resizing while their labels swap.

### Who owns the DOM

The animation layer writes styles imperatively while React owns the same
elements. The rule used here: **any node GSAP animates has no React children and
no React-managed value for the property being animated.**

- The price count-up target is a childless `<span>` — React never writes text to it.
- Keycap fills are set by React on render and then tweened by GSAP; React's style
  diffing compares previous props, not the DOM, so it does not clobber a running
  tween. The tweens use `overwrite: true` so overlapping colorway switches cannot
  fight each other.
- Scroll reveals live in a `gsap.context` so a single `revert()` cleans up tweens
  and ScrollTriggers together.

### Motion and accessibility

`prefers-reduced-motion` is honoured in every animation entry point, checked at
call time rather than cached, plus a CSS opt-out for the one keyframe animation.
Option groups are real `fieldset`/`radio` markup rather than styled divs. The
price is announced once per settled total, not once per animation frame.

## Known gaps

- Keys that leave a layout (75% → 65% drops the 15 F-row keys) disappear without
  an exit animation. React unmounts them before Flip runs, so Flip receives
  detached nodes and cannot animate them.
- The Specs table lists one weight for all three layouts.
