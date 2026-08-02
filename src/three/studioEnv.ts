import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  SRGBColorSpace,
} from 'three';

/**
 * The room the case reflects.
 *
 * A half-metal is mostly reflection: `diffuse *= (1 - metalness)`, so most of
 * what you see on the case is whatever the environment hands back. With no
 * environment, only the faces catching a light's specular lobe show anything
 * and every other face renders black — which is what made the case read as a
 * grey lid on a black box no matter how the lights were tuned.
 *
 * Painted rather than imported. Three ships `RoomEnvironment`, but it is a
 * furnished room, and it needs `PMREMGenerator`, which is typed against
 * `WebGLRenderer`. What a product shot wants is a softbox above and a dark
 * floor below — the gradient *is* the studio, so painting it directly is both
 * smaller and more controllable than filtering a scene down to the same thing.
 */
export function studioEnvironment(): CanvasTexture {
  const canvas = document.createElement('canvas');
  // Equirectangular: x is azimuth, y is elevation with 0 at the zenith. Small
  // on purpose — this is only ever sampled as a blurry reflection, so detail
  // here would cost memory to produce something no one can resolve.
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Ceiling to floor. The horizon band matters more than it looks: a vertical
  // wall's normal is horizontal, so the case's sides sample *only* this band,
  // while its top face samples the ceiling. On a near-black case (#1C1C1E)
  // there is almost no diffuse response to fall back on, so that one gradient
  // stop is the entire difference between "one milled block" and "a grey lid
  // on a black box". It is kept bright and close to the ceiling's value for
  // that reason, with the fall to dark pushed well below the horizon.
  const sweep = ctx.createLinearGradient(0, 0, 0, canvas.height);
  // Compressed rather than a full white-to-black ramp. The top face samples the
  // ceiling and the walls sample the horizon, so the *range* of this gradient
  // is the ratio between them: a pure white ceiling over a dark horizon is what
  // made the case read as two different materials rather than one shaded block.
  //
  // Warm, and light all the way to the floor. This room is reflected by a board
  // standing on a blush page, so its lower half is bounce off a lit surface,
  // not the black void a dark-page scene could assume. Leaving the floor dark
  // puts a hard dark band across the underside of every cap and along the case
  // wall, which reads as dirt rather than as shading.
  sweep.addColorStop(0, '#fffaf6');
  sweep.addColorStop(0.3, '#fbeade');
  sweep.addColorStop(0.52, '#f0d9cc');
  sweep.addColorStop(0.76, '#cfb0a0');
  sweep.addColorStop(1, '#8d6f61');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Two soft overhead panels. A perfectly smooth gradient gives the case an
  // even wash and no highlight to travel across it as the board turns; the
  // panels are what make the metal look like it is being *lit* rather than
  // tinted, and they are what slides along the chamfer on rotation.
  const panel = (cx: number, cy: number, r: number, alpha: number) => {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  // Front-left, matching the key light, and back-right for the cool kicker.
  panel(canvas.width * 0.18, canvas.height * 0.2, 130, 0.6);
  panel(canvas.width * 0.68, canvas.height * 0.28, 100, 0.35);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
