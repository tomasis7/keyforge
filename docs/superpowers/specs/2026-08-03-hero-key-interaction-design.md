# Hero key interaction

Hovering the 3D board highlights the key under the cursor and pulses it.
Clicking presses that key down and springs it back. Dragging still rotates the
board and fires no key.

## Constraints that shape it

**Caps are instanced.** One `InstancedMesh` per (zone, size), sharing a material.
A single key cannot be given its own colour by setting a material property, so
per-key state has to travel as a per-instance attribute — the mechanism
`aLegend` already uses.

**Cap geometries are cached by size and shared across zones.** Instance
attributes live on the *geometry*, so two buckets sharing one geometry would
share their per-key state. The cache key gains the zone.

**Legends are separate planes.** A pressed cap whose legend stays put leaves its
lettering floating. Legend meshes carry the same attribute, and their instance
order differs from the caps' because legends filter out `label === ''`. So state
is keyed by *board key index*, and written into both cap and legend buckets.

**Press direction differs per mesh.** A cap's local +Y is up. A legend plane's
local +Z is up, because it is rotated `-PI/2` about X to lie on the cap. Cap
presses offset local −Y; legends offset local −Z.

## Design

`src/three/keyInteraction.ts` owns:

- `press` and `glow`, one float per board key
- a registry of buckets: `{ attr, keyIndices }`, cap and legend alike
- a registry of raycast targets: `{ mesh, keyIndices }`
- `pick(raycaster)` → board key index or null
- `update(time, reducedMotion)` → advances animations, writes attributes
- `dispose()`

`heroScene` wires it: registers buckets as it builds them, exposes
`hoverAt(x, y)` / `clickAt(x, y)` taking canvas-relative NDC, and calls
`update` from the render loop.

`HeroBoard3D` maps pointer events to canvas NDC. On `pointerup`, under 5px of
movement and 400ms it is a click; otherwise it was a rotate.

## Behaviour

- Hover: tint toward the accent, pulsing. One key at a time.
- Click: down 1.5mm over ~60ms, back over ~140ms, brighter on the way down.
- Reduced motion: static highlight, no pulse. The press still runs — it is
  user-initiated, not motion played at the viewer.

## Out of scope

Sound, key repeat, physical-keyboard input, latching keys, and any change to the
SVG configurator board. This is the hero only.
