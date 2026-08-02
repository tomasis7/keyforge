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

### Two boards, two registers

The page shows the keyboard twice, so the two are deliberately different things
rather than the same drawing at two sizes.

The **hero** is a product shot: a real-time WebGPU render (Three.js, TSL node
materials) under a studio rig — warm key light for form, a kicker behind-right
to separate the case from the page, a weak front fill for the one face neither
of those addresses, and a contact shadow so it sits on the page rather than
floating. Drag it to turn it; the pose you leave it in is the pose it keeps.

Its legends come from a canvas atlas, drawn on their own planes above the caps
rather than textured onto them: `RoundedBoxGeometry` does not give the top face
clean 0..1 UVs, and a cap-mapped legend would stretch along a 6.25u space bar.
Separate uniformly-scaled planes keep every legend the same size on every key,
which is how real keycaps work.

The atlas is **mipmapped**, which matters more than its resolution. A legend
covers roughly 25 screen pixels at hero distance against a 192px cell — about
8x minification — and point-sampling a linear filter that far down makes thin
strokes alias in and out between frames. That shimmer, not the size, is what
made the lettering read as faint. Glyphs are also fitted to their cell by
`measureText` rather than by a per-length guess at what would fit, which is
what had been holding the short legends — the alphas and digits, most of the
board — well below the size they could have been.

### Why the case is not black

`caseMaterial` looks over-engineered for a box, and each value is load-bearing.

The case is lit almost entirely by **reflection**, not by the studio rig. It
originally used `metalness = 0.86` with nothing in `scene.environment`, and a
metal has essentially no diffuse response — `diffuse *= (1 - metalness)` — so
only the faces catching a light's specular lobe showed anything at all. The
result was a grey lid on a black box, and no amount of extra light fixes it,
because at that metalness there is barely any diffuse for a light to land on.
It is a material problem wearing a lighting problem's clothes.

So there is a `studioEnv` — a painted equirectangular gradient rather than an
imported HDRI or three's `RoomEnvironment` (which is a furnished room, and
needs `PMREMGenerator`, typed against `WebGLRenderer`). What a product shot
wants is a softbox above and a dark floor below, so the gradient *is* the
studio. Its horizon band is the single most important stop in it: a vertical
wall's normal is horizontal, so the case's sides sample only that band while
its top face samples the ceiling. The *range* of that gradient is the ratio
between them.

The `clearcoat` (0.45) is what carries the dark cases. A clearcoat is a
transparent lacquer, so its reflectance does not depend on the base colour,
whereas both the diffuse and the metal F0 of Anodized Black (`#1C1C1E`) are
near zero. On a black case the clearcoat is effectively the only thing putting
light on a wall that faces away from the key light.

### The camera refits every frame

`distanceForYaw` is solved for the board's *current* rotation and eased toward,
rather than fixed once at the worst case. Fitting the diagonal — the pose at 45
degrees — does keep every rotation on screen, and it is genuinely free on the
width axis, where `caseW` already dwarfs `caseD`. It is not free on the depth
axis: the rotated footprint goes from 11.2 deep at rest to 18.2 at the diagonal,
and depth drives the *vertical* fit, so a fixed worst-case fit pushes the camera
about 50% further back and shrinks the board — legends included — in the shot
almost every viewer actually sees. So the resting pose is framed tightly and the
camera dollies back only as the board is turned.

`PADDING` must stay **above 1.0**. It multiplies an exact fit, so anything below
1 is a crop rather than a tighter shot. It sat at 0.95 undetected for a while
because the inflated vertical term was masking it; the moment width became the
binding axis, it cut the board off at both edges.

### Case height is set in millimetres

One scene unit is one key unit, which is the **19.05mm keycap pitch**. `CASE_H`
is written against that, not chosen by eye, because it once drifted to 13.6 — a
case a quarter of a metre tall — while chasing a case that "looked thin". It
never was thin. It looked thin because it was black with nothing to reflect, so
its walls fell to the page colour and the only thing left to see was its lid.
That was the material bug above. Geometry cannot fix a lighting problem.

### The chamfer is an edge, so it needs two axes

`chamferColor` ramps on height *and* on distance in from the outer wall. Ramping
on height alone puts the whole top face at the top of the ramp — every point on
it shares the same y — so instead of lining the rim it washes the entire bezel
toward white. On an 18mm case the bezel is most of the case you can see, which
made Anodized Black render as silver. Measured, that one ramp was worth ~82 of
the bezel's 146 luminance: more than the environment and every light combined.

### Backdrop

A pool of light on a sweep behind the board, which is where the depth in the
shot comes from. Case *height* does not produce depth — it adds a large area of
uniform colour, which is the opposite of a depth cue. Value separation between
planes does.

Its falloff is **two ramps, not one**. Colour closes early and alpha closes
later, and the gap between them prints a deep-rose ring — which is what a
studio vignette actually is. On a dark page one ramp is enough, because the
falloff runs into black and black is already the darkest thing available; on a
light page there is nothing below the page colour to fall off *into*, so a lone
ramp lands somewhere between blush and white and reads as bland however it is
tuned. The range has to be manufactured.

Two things about it are computed per frame rather than written as constants,
both because a constant was wrong:

- **Its size** comes from the frustum at the plane's depth. The pool has to
  reach zero inside the *canvas*, and the canvas edge is set by the viewport,
  not by the scene. A plane large enough for one aspect ratio leaves the sweep
  still bright where the canvas stops, drawing a visible rectangle on the page.
- **Its height** follows the view axis to where it crosses the plane. The
  camera looks down, so on a plane that far back the centre of frame sits some
  20 units *below* the board — a pool centred near the board's own height lands
  entirely above the top of the picture.

Its falloff ramps outward and is inverted, never `smoothstep(hi, lo, x)`: a
reversed edge pair is undefined in GLSL, and it showed, clipping the pool to a
hard rectangle instead of fading.

The **configurator** board stays SVG: a flat spec drawing that does carry the
legends, morphs between layouts, and is the thing you are actually editing. It
sits below the options rather than beside them.

It is not sticky, and `position: sticky` cannot make it so from there. Sticky
only holds an element inside its own containing block, and a trailing element
has no travel left to hold it against — so keeping the board in view while the
options scroll means putting it back above them, not adding a sticky rule.

Both are built from the same `buildBoard` matrices, so the 3D board cannot drift
into showing a keyboard the product does not make.

The 3D is progressive enhancement, not a dependency. The SVG paints first and
the Three chunk (~230 kB gzip, code-split so it never touches first paint) loads
after, cross-fading in when ready. It is skipped entirely below 900px — where
the board is small, the chunk is expensive and the GPU budget is tightest — and
the render loop pauses via `IntersectionObserver` once you scroll past the hero.
If WebGPU is unavailable or the chunk fails, the SVG simply stays.

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
installed) because an SVG rasteriser has no webfont support and would silently
substitute a fallback face for every legend.

The site's own woff2 files are inlined into the card as data URIs, so it renders
with no network access and its type is identical to the page's by construction.

The PNG is committed, so neither CI nor a deploy needs a browser. The cost of
that is staleness — change a colorway and the card still shows the old one. So
`generate-og.ts` also writes a fingerprint of the card's inputs (the template,
and through it the board geometry and every colour in the palette), and a test
asserts the committed value still matches. Changing the palette without running
`npm run og` fails the build rather than silently shipping a stale preview.

## Known gaps

- **Anodized Black renders lighter than its swatch.** The hero puts the bezel
  around luminance 64 against the swatch's 28.6, because a lit dark surface
  under a studio environment is not the flat colour on a chip. It reads as one
  dark charcoal block rather than as silver, which is what the chamfer fix
  bought back, but the 3D and SVG boards will never agree exactly here. Pushing
  `clearcoat` down further closes the gap and starts costing the case its form
  again.

- The hero's lighting is soft and diffuse, matching the light blush theme. It
  is deliberately *not* the hard-rim, deep-falloff product-shot treatment: that
  look wants a dark ground to fall off into. Adding it would also want a real
  planar reflection, which is a second full scene render per frame — a cost the
  hero budget has not been asked to carry.

- The 3D legends are drawn at weight 700, but `fonts.css` self-hosts IBM Plex
  Mono only at 400 and 500, so canvas is applying *synthetic* bold rather than a
  real face. It looks right and costs no bytes, but it depends on the browser
  emboldening for us. A real 600 via `fetch-fonts.sh` would cost ~15 kB.

- The footer's "Get in touch" address is a placeholder on a fictional domain and
  receives no mail. It is demo copy; the site is a portfolio piece rather than a
  storefront.

- The share card's fingerprint covers everything in the card template, which
  includes its CSS and copy. It does not cover the screenshot options in
  `generate-og.ts` (the device scale factor), since those sit outside the
  hashed string.
- Component tests run in jsdom with `prefers-reduced-motion` forced on, so the
  animation layer short-circuits. jsdom has no layout engine, so Flip and the
  exit ghosts can only be verified against a real browser.
