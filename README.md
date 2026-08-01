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
DOM dependency, which is why the bulk of the test suite is aimed there.

Component tests cover what the pure functions cannot: the modal's focus trap
and focus restore, the option groups being real radios that arrow keys operate,
and the price bar announcing one settled total rather than every frame of the
count-up.

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
- Keys that a layout change drops are replayed from a clone taken *before* the
  store update, in a layer the animation code creates and destroys itself. Flip
  cannot do this: by the time its `onLeave` fires, React has detached those nodes
  and they have no box to animate.
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

Keycap legends are text inside an SVG, so WCAG 1.4.3 applies to them — the
`role="img"` wrapper changes what assistive tech announces, not whether a
low-vision user can read a key. Every legend/cap pair is asserted to clear AA
(4.5:1) in `contrast.test.ts`, which is the guard that stops a palette tweak
from quietly dropping one below the line.

### URL and history

The whole configuration lives in the query string, so a build is a link. Back
and Forward step through the configuration rather than off the site, which
means the store has to be writable *from* the URL as well as to it — hence
`applyFromUrl`, and a `syncUrl` that no-ops when the URL already matches, so
applying a popstate cannot write an entry straight back.

History entries are coalesced by time (`HISTORY_COALESCE_MS`): changes closer
together than the window replace the current entry, spaced-out ones push a new
one. Pushing on every change would bury the referring page under an entry per
click; replacing on every change — the original behaviour — meant Back left the
site and took the build with it.

### Physical specs

The numbers in the spec table are derived from the same layout matrices the
board is drawn from (`boardSpecs`), not transcribed. They previously quoted one
weight for all three boards and the same width for 75% and TKL, which cannot
both be right — those layouts are 16u and 18.5u wide.

### Type

Fonts are self-hosted (`src/styles/fonts.css`, regenerate with
`scripts/fetch-fonts.sh`). They were previously an `@import` of the Google
Fonts stylesheet from inside `tokens.css`, which made the font CSS a *child*
request of our own: a trace showed the browser could not even ask for it until
`index.css` had downloaded and parsed, with the font files another hop after
that. Self-hosting collapses that chain and drops two third-party DNS/TLS
handshakes.

Space Grotesk is a variable font — Google serves the same file for every
requested weight — so it is declared once with a `font-weight: 400 700` range
rather than four times. Only the latin subset is kept.

### Share card

`npm run og` renders `public/og.png` by building the board from the same
`buildBoard` geometry and colorway data the app uses, so the preview shows the
real product rather than a mock-up that can drift from it. It rasterises in a
real browser (via `puppeteer-core`, driving whatever Chrome is already
installed) because the type is Google-hosted — an SVG rasteriser would silently
substitute a fallback face.

The PNG is committed, so neither CI nor a deploy needs a browser. Regenerate it
when the palette or board design changes.

## Known gaps

- The share card is generated on demand, not in CI, so it can fall out of date
  with the palette until someone runs `npm run og`.
- Component tests run in jsdom with `prefers-reduced-motion` forced on, so the
  animation layer short-circuits. jsdom has no layout engine, so Flip and the
  exit ghosts can only be verified against a real browser.
