/**
 * The hero board as a real-time studio product shot.
 *
 * Rendered with WebGPU (falling back to WebGL2 inside WebGPURenderer when the
 * adapter is unavailable) and TSL node materials. The geometry comes from the
 * same `buildBoard` matrices the SVG uses, so the 3D board is the same board —
 * not a model that can drift from the product.
 *
 * Legends come from a canvas atlas so the whole board's lettering is a single
 * texture and each zone of keycaps stays one instanced draw call.
 */
import type { BufferGeometry } from 'three';
import {
  Color,
  DirectionalLight,
  InstancedBufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnvironment } from './studioEnv';
import { attribute, color, float, min, mix, positionLocal, screenUV, smoothstep, texture, uv, vec2 } from 'three/tsl';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, WebGPURenderer } from 'three/webgpu';
import type { LayoutId } from '../data/layouts';
import type { CaseOption, ColorwayOption } from '../data/options';
import { buildBoard, KEY_U, type Zone } from '../lib/keyboard';
import { keycapGeometry } from './keycap';
import { buildLegendAtlas } from './legendAtlas';

/** Which ink colour each zone's legends use. */
const LEGEND_KEY: Record<Zone, 'onAlpha' | 'onMod' | 'onAccent'> = {
  alpha: 'onAlpha',
  mod: 'onMod',
  accent: 'onAccent',
};

/** How far the caps sit down into the case tray. */
const SEAT = 0.1;
/** Above this width a key is a modifier, and takes a left-aligned legend. */
const WIDE_KEY_U = 1.4;
/** Rendered width of a legend quad, and its inset from a wide cap's edge. */
const LEGEND_W = 0.6;
const LEGEND_INSET = 0.12;
/**
 * Row sculpting. Far rows lean back and near rows lean forward, which is why a
 * real board's rows catch the light at different angles rather than reading as
 * one flat field.
 */
const rowTilt = (z: number, depth: number): number => (z / depth) * -0.5;

/** SVG pixels to scene units. One key unit (48px) becomes 1. */
const S = 1 / KEY_U;
/** Keycap height, and how far the cap sits above the case top. */
const CAP_H = 0.42;
/**
 * Case height — and the one number here with a real-world answer, so it is set
 * from millimetres rather than by eye.
 *
 * One scene unit is one key unit, which is the 19.05mm keycap pitch. That makes
 * this 18mm, in the range a real 60-65% case occupies. Worth stating because
 * the number drifted badly upward once — as far as 13.6, a case a quarter of a
 * metre tall — while chasing a case that "looked thin". It did not look thin
 * because it was thin. It looked thin because it was black and had nothing to
 * reflect, so its walls fell to the page background and the only thing left to
 * see was the lid. That was a material bug; see `caseMaterial`. Geometry cannot
 * fix a lighting problem, and thickening the case to compensate only produced a
 * plinth with keys on top.
 *
 * Nearly everything else derives from this — cap seating, legend lift, the
 * chamfer ramp, the backdrop, the shadow catcher and the camera fit. The two
 * things that do *not*, and so must be kept in step by hand, are the light rig's
 * distance and the shadow camera's frustum; see STAGE_DISTANCE.
 */
const CASE_H = 0.95;
/** Extra case beyond the key field, on every side: the frame around the keys. */
const BEZEL = 0.3;
/**
 * Width of the bright turn-over along the case's top edge, in world units.
 * Absolute rather than a fraction of case height: a chamfer is a machined edge
 * of fixed size, so it must not grow when the case gets deeper.
 */
const CHAMFER = 0.08;

/** Thickness of the grey slab, and how far it oversails the case on each side. */
const SURFACE_H = 0.5;
const SURFACE_MARGIN = 1.35;


export interface HeroScene {
  resize: (width: number, height: number) => void;
  setPointer: (x: number, y: number) => void;
  /** Adds to the board's held rotation, in radians. Used by drag-to-turn. */
  rotateBy: (yaw: number, pitch: number) => void;
  /** While dragging, the hover-follow and idle drift stand down. */
  setDragging: (dragging: boolean) => void;
  setColors: (caseOption: CaseOption, colorway: ColorwayOption) => void;
  /** Stops the render loop when the board is off-screen. */
  setActive: (active: boolean) => void;
  dispose: () => void;
}

/**
 * The bright line where a milled case's top face turns over. Both ends of the
 * ramp are computed in JS so the shader only has to interpolate between two
 * constants.
 *
 * Needs the case footprint, because a chamfer is an *edge*, and an edge is a
 * position in two axes. Ramping on height alone — which this did — puts the
 * whole top face at the top of the ramp, since every point on it shares the
 * same y. That painted the entire bezel toward white rather than lining its
 * rim, and on a case only 18mm tall the bezel is most of the case you see, so
 * a black case came out silver. Measured: it was worth ~82 of the bezel's 146
 * luminance, more than the environment and every light put together.
 */
function chamferColor(hex: string, caseW: number, caseD: number) {
  const body = new Color(hex);
  const edge = body.clone().lerp(new Color(0xffffff), 0.22);

  // Near the top face: positionLocal.y runs -CASE_H/2..CASE_H/2.
  const nearTop = smoothstep(
    float(CASE_H / 2 - CHAMFER),
    float(CASE_H / 2),
    positionLocal.y,
  );
  // Near the outer wall: distance in from whichever side is closest. Ramped
  // outward then inverted rather than written as smoothstep(hi, lo, x), which
  // is undefined in GLSL.
  const inset = min(
    float(caseW / 2).sub(positionLocal.x.abs()),
    float(caseD / 2).sub(positionLocal.z.abs()),
  );
  const nearEdge = smoothstep(float(0), float(CHAMFER), inset).oneMinus();

  return mix(color(body), color(edge), nearTop.mul(nearEdge));
}

/**
 * Anodised aluminium. The chamfer along the top edge is what actually sells a
 * milled case: a bright, narrow highlight where the top face turns over. TSL
 * gives it to us from local position rather than a texture.
 */
function caseMaterial(hex: string, caseW: number, caseD: number): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial();
  // 0.55, not the 0.86 this used to be. A metal has almost no diffuse response
  // — `diffuse *= (1 - metalness)` — so at 0.86 only 14% of the case colour
  // survived and the block's appearance was carried entirely by reflection.
  // With nothing in `scene.environment` to reflect, that meant exactly one face
  // (the one catching the key light's specular lobe) read as grey and every
  // other face rendered black. Adding lights cannot fix that; it is a material
  // problem. Anodising is a dielectric oxide layer over aluminium in any case,
  // so a half-metal is the more honest description of it.
  material.metalness = 0.4;
  material.roughness = 0.38;
  // A clearcoat's reflectance does not depend on the base colour — it is a
  // transparent lacquer over the top — whereas both the diffuse and the metal
  // F0 of Anodized Black (#1C1C1E) are nearly zero. So on a dark case the
  // clearcoat is most of what puts light on a wall facing away from the key
  // light, and it is the knob that trades swatch fidelity against how much the
  // case's form is visible at all.
  //
  // Moderate rather than the 0.85 first tried here. That value was tuned when
  // the case was 8cm of wall; at 18mm you are looking almost entirely at the
  // top bezel, which is the face that takes the most clearcoat sheen, and it
  // pushed Anodized Black all the way to silver. The lower value keeps the
  // case a dark charcoal. It does not reintroduce the black-box failure —
  // that was `metalness = 0.86` with an unset `scene.environment`, and both
  // of those remain fixed.
  material.clearcoat = 0.45;
  material.clearcoatRoughness = 0.28;

  material.colorNode = chamferColor(hex, caseW, caseD);
  return material;
}

/** Top face lit, sides in shadow. Both ends mixed in JS; the shader lerps. */
function capColor(face: Color) {
  const side = face.clone().multiplyScalar(0.78);
  const top = smoothstep(float(CAP_H * 0.1), float(CAP_H * 0.5), positionLocal.y);
  return mix(color(side), color(face), top);
}

/**
 * PBT keycaps: matte, no metal. The top face is lifted slightly so caps catch
 * the key light and read as separate objects against the case rather than a
 * flat grid of colour.
 */
function capMaterial(hex: string): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial();
  material.metalness = 0;
  material.roughness = 0.78;
  material.sheen = 0.3;

  material.colorNode = capColor(new Color(hex));
  return material;
}

export async function createHeroScene(
  canvas: HTMLCanvasElement,
  layout: LayoutId,
  caseOption: CaseOption,
  colorway: ColorwayOption,
  reducedMotion: boolean,
): Promise<HeroScene> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
  await renderer.init();
  // 1.5 rather than 2: this is a full-frame lit scene with shadows, and the
  // fragment cost scales with the square of this number for no visible gain on
  // a board made of flat-shaded boxes.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Opaque. The scene paints a full set — wall and table — rather than floating
  // a board over the page, so there is nothing left for the page to show
  // through, and a transparent clear would only leak page colour into any gap
  // the wall plane failed to cover.
  renderer.setClearAlpha(1);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  // Backstop behind the wall plane. The wall is sized to the frustum and should
  // cover the frame on its own, but it is a finite quad being fitted to a
  // camera that moves with the board — a clear colour behind it means a gap can
  // never show as a transparent hole.
  scene.background = new Color(0x8fcbe8);
  // Far enough to clear the backdrop, which sits well behind the board.
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);

  // Something for the case metal to actually reflect. Three directional lights
  // give a half-metal only a few narrow specular lobes, which is why the case
  // read as a grey lid on a black box: the faces pointing away from the key
  // light had nothing to return. A pre-filtered room gives every face broad,
  // soft grey reflection, so the block reads as one continuous anodised surface
  // whichever way it points. This is the fix for "the case isn't all one grey";
  // the light rig is not.
  const env = studioEnvironment();
  scene.environment = env;
  // Below 1 so the room lifts the walls without washing out the studio rig's
  // directional modelling, which is what gives the case its form.
  scene.environmentIntensity = 0.34;

  const board = buildBoard(layout);
  const boardW = board.widthPx * S;
  const boardD = board.heightPx * S;
  // Outer dimensions of the case. The camera has to frame these, not the key
  // field: the bezel is wide enough now that fitting the keys alone would run
  // the case off the edge of the canvas.
  const caseW = boardW + BEZEL * 2;
  const caseD = boardD + BEZEL * 2;

  const root = new Group();
  scene.add(root);

  // --- case -----------------------------------------------------------------
  // The case runs wider than the key field so there is a substantial frame
  // around the keys, and deep enough to read as a milled block rather than a
  // tray the caps are sitting on.
  const caseGeom = new RoundedBoxGeometry(caseW, CASE_H, caseD, 4, 0.14);
  const caseMat = caseMaterial(caseOption.hex, caseW, caseD);
  const caseMesh = new Mesh(caseGeom, caseMat);
  caseMesh.castShadow = true;
  caseMesh.receiveShadow = true;
  root.add(caseMesh);

  // --- keycaps --------------------------------------------------------------
  // Grouped by zone *and* size. Each distinct cap size gets its own geometry,
  // built at true size, so no cap is ever scaled: scaling stretches corner
  // radii and shoulder angles with the key, which is what made the spacebar
  // and enter cap read as lozenges rather than long keycaps.
  const zones: Zone[] = ['alpha', 'mod', 'accent'];
  const capGeoms = new Map<string, BufferGeometry>();
  const capMaterials = new Map<Zone, MeshPhysicalNodeMaterial>();
  const dummy = new Object3D();

  const sizeKey = (w: number, d: number) => `${w.toFixed(3)}x${d.toFixed(3)}`;
  const capGeometryFor = (w: number, d: number): BufferGeometry => {
    const id = sizeKey(w, d);
    let geometry = capGeoms.get(id);
    if (!geometry) {
      geometry = keycapGeometry(w, d, CAP_H);
      capGeoms.set(id, geometry);
    }
    return geometry;
  };

  for (const zone of zones) {
    const material = capMaterial(colorway[zone]);
    capMaterials.set(zone, material);

    // One instanced mesh per (zone, size) pair — a handful of extra draw calls
    // in exchange for every cap keeping its proper profile.
    const bySize = new Map<string, typeof board.keys>();
    for (const key of board.keys) {
      if (key.zone !== zone) continue;
      const id = sizeKey(key.bw * S, key.bh * S);
      const bucket = bySize.get(id);
      if (bucket) bucket.push(key);
      else bySize.set(id, [key]);
    }

    for (const keys of bySize.values()) {
      const geometry = capGeometryFor(keys[0].bw * S, keys[0].bh * S);
      const mesh = new InstancedMesh(geometry, material, keys.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      keys.forEach((key, i) => {
        // SVG space is y-down and origin top-left; the scene is y-up, centred.
        const z = (key.by + key.bh / 2) * S - boardD / 2;
        dummy.position.set(
          (key.bx + key.bw / 2) * S - boardW / 2,
          // Seated *into* the tray rather than resting on a slab, so the case
          // rim rises past the base of the caps as it does on a real board.
          CASE_H / 2 + CAP_H / 2 - SEAT,
          z,
        );
        dummy.rotation.set(rowTilt(z, boardD), 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      dummy.rotation.set(0, 0, 0);
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }
  }

  // --- legends --------------------------------------------------------------
  // On their own planes rather than textured onto the caps, for two reasons:
  // RoundedBoxGeometry does not give the top face clean 0..1 UVs, and the caps
  // are scaled non-uniformly (the space bar is 6.25u wide), which would stretch
  // a cap-mapped legend badly. A separately scaled plane keeps every legend the
  // same size on every key, which is how real keycaps work.
  await document.fonts.ready;
  const atlas = buildLegendAtlas(board.keys.map((k) => k.label));
  const legendGeoms: PlaneGeometry[] = [];
  const legendMats: MeshBasicNodeMaterial[] = [];

  for (const zone of zones) {
    const keys = board.keys.filter((k) => k.zone === zone && k.label !== '');
    if (keys.length === 0) continue;

    const geometry = new PlaneGeometry(1, 1);
    const offsets = new Float32Array(keys.length * 2);
    keys.forEach((k, i) => {
      const [u, v] = atlas.cell.get(k.label) ?? [0, 0];
      offsets[i * 2] = u;
      offsets[i * 2 + 1] = v;
    });
    geometry.setAttribute('aLegend', new InstancedBufferAttribute(offsets, 2));
    legendGeoms.push(geometry);

    const material = new MeshBasicNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    const sampled = texture(
      atlas.texture,
      uv().mul(vec2(atlas.size[0], atlas.size[1])).add(attribute('aLegend', 'vec2')),
    );
    material.colorNode = color(new Color(colorway[LEGEND_KEY[zone]]));
    material.opacityNode = sampled.a;
    legendMats.push(material);

    const mesh = new InstancedMesh(geometry, material, keys.length);
    keys.forEach((k, i) => {
      const z = (k.by + k.bh / 2) * S - boardD / 2;
      const tilt = rowTilt(z, boardD);
      // Placed on the cap's actual top surface rather than at a fixed height:
      // the caps are both seated into the tray and tilted per row, so a fixed
      // Y buries the legend inside the cap it belongs to.
      // Clears the *rim*, not the dish floor. The dish curves the cap surface
      // up toward its edges, so a legend placed at the dish floor is swallowed
      // by the cap everywhere except dead centre.
      const lift = CAP_H / 2 + 0.01;
      // Wide modifiers carry their legend at the left, the way tab, caps and
      // shift do on a real board; alphas stay centred. Without this every wide
      // key has a lonely glyph floating in the middle of a long cap.
      const capW = k.bw * S;
      const shift =
        capW > WIDE_KEY_U ? -(capW / 2) + LEGEND_W / 2 + LEGEND_INSET : 0;
      dummy.position.set(
        (k.bx + k.bw / 2) * S - boardW / 2 + shift,
        CASE_H / 2 + CAP_H / 2 - SEAT + lift * Math.cos(tilt),
        z + lift * Math.sin(tilt),
      );
      // Lies on the cap's sloped top, not flat on the board.
      dummy.rotation.set(-Math.PI / 2 + tilt, 0, 0);
      // Uniform, so a 6.25u space bar gets the same lettering as a 1u alpha.
      dummy.scale.set(LEGEND_W, LEGEND_W, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    dummy.rotation.set(0, 0, 0);
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }

  // --- studio rig -----------------------------------------------------------
  // Key light front-left gives the form; the cool kicker behind-right is what
  // separates the case from a dark page and reads as "studio" rather than "lit".
  // A directional light is parallel, so its *direction* is all that sets the
  // lighting angle — these vectors are unit directions, scaled out to a staging
  // distance. That distance is not cosmetic: the shadow camera is placed at the
  // light, and a case this tall has a half-diagonal of ~11 units, so a rig at
  // the old distance of ~10 sat *inside* the case's bounding volume and the
  // shadow map degenerated. Stage well outside the whole board.
  const STAGE_DISTANCE = 34;
  const stage = (x: number, y: number, z: number) =>
    new Vector3(x, y, z).normalize().multiplyScalar(STAGE_DISTANCE);

  // Raked low deliberately. Shadow length is set by the light's elevation, and
  // the board is only 18mm tall — from up near 45 degrees a case that thin drops
  // its shadow underneath itself, where the board then hides it and the whole
  // thing reads as floating. Low and to the side throws the shadow clear across
  // the table, which on a light set is the strongest depth cue available.
  const keyPos = stage(-6.2, 3.5, 2.6);
  const key = new DirectionalLight(0xfff1e2, 5.2);
  key.position.copy(keyPos);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = STAGE_DISTANCE * 2.2;
  // Half-extent of the board as seen from the light. Derived from the case so a
  // future height change cannot silently crop the shadow.
// Generous, and it has to be. A raking light stretches the board's shadow well
  // past the board's own footprint, and if that shadow reaches the edge of the
  // ortho box the map clamps to its edge texel — which still holds an occluder,
  // so everything beyond smears into one hard rectangle of false shadow across
  // the table. Sized for the shadow, not for the caster.
  const shadowExtent = Math.max(caseW, caseD) * 1.7 + SURFACE_MARGIN * 2;
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.bias = -0.002;
  key.shadow.radius = 2;
  scene.add(key);

  const kicker = new DirectionalLight(0xffd7bd, 3.2);
  kicker.position.copy(stage(6.5, 1.1, -6.5));
  scene.add(kicker);

  // Front fill, roughly along the camera axis and deliberately weak. The key
  // and kicker are both high and raking, so the one surface neither of them
  // addresses is the case's front wall — the face the viewer looks straight at
  // and the one that reads as the case's thickness. Without this the wall is
  // carried entirely by the environment's horizon band. No shadow: this is
  // filling shadow, not making more of it.
  const fillFront = new DirectionalLight(0xf3e2d8, 0.55);
  fillFront.position.copy(stage(0.5, 1.6, 6));
  scene.add(fillFront);

  // Ground colour was 0x0b0b0d — the old page background, copied in as a
  // literal. On a blush page the board is standing on a lit surface, so the
  // bounce coming back up at it is warm and bright, not black.
  // Cut hard. On a lit table the shadow is only as dark as the ambient that
  // fills it, so shadow density is set here rather than by any shadow setting —
  // the key light carries the lit surfaces and this decides how far the shadow
  // falls below them.
  const fill = new HemisphereLight(0xf2fbff, 0xe8e2d6, 0.22);
  scene.add(fill);

  // --- backdrop -------------------------------------------------------------
  // A studio sweep behind the board: a pool of light falling off into the dark.
  // This is what actually produces depth. Height did not — a tall case adds
  // uniform bulk, whereas depth is read from value separation between planes,
  // so a lit background the board is silhouetted against does the work.
  //
  // Unlit on purpose. It is a background *light source*, not a surface being
  // lit, so it should not take part in the studio rig or pick up the board's
  // shadow. That keeps it stable no matter how the rig is retuned.
  // Unit plane; `placeCamera` scales it to the frustum. The size cannot be a
  // constant: the pool has to reach zero *inside the canvas*, and the canvas
  // edge is set by the viewport, not by the scene. A fixed plane large enough
  // for one aspect ratio leaves the sweep still bright where the canvas stops,
  // which draws a visible rectangle on the page.
  const backdropGeom = new PlaneGeometry(1, 1);
  const backdropMat = new MeshBasicNodeMaterial();
  backdropMat.transparent = true;
  // Never occludes the board, and never writes depth the case has to fight.
  backdropMat.depthWrite = false;
  {
    // Graded in *screen* space, not in the plane's UVs. The plane is scaled to
    // the frustum and follows a camera that moves with the board, so its UVs do
    // not map to anything stable on screen; `screenUV` does, which is what lets
    // the top of the gradient be pinned to the top of the canvas.
    //
    // And it has to be pinned there: the stage is full bleed, so the wall butts
    // straight onto the page and whatever value it takes at that join must
    // equal `--bg-0` or the join draws a band across the hero. So the top stop
    // is the page colour exactly, and the wall is free to travel away from it
    // going down, where nothing is adjacent to give the game away.
    // Flipped: `screenUV.y` runs 0 at the *top* of the frame, so reading it
    // directly puts the top stop of the gradient along the bottom edge — which
    // is exactly where the floor covers it, so the sky never appeared at all
    // and the wall graded rose-to-grey downward instead of sky-to-rose.
    const up = screenUV.y.oneMinus();
    // Spread over the whole frame now the floor is gone and the backdrop is
    // seamless. While a floor covered the lower two thirds these had to be
    // crammed into the top third, or grey and rose landed under the horizon
    // where nothing could see them.
    const toGrey = smoothstep(float(0.34), float(0.78), up).oneMinus();
    const toRose = smoothstep(float(0.02), float(0.44), up).oneMinus();
    backdropMat.colorNode = mix(
      mix(color(0x7fd4f7), color(0xb9c3ca), toGrey),
      color(0xefb3a8),
      toRose,
    );
    // Opaque. Everything below is a real set now rather than a glow composited
    // over the page, so there is nothing to blend into and nothing to hide.
    backdropMat.opacityNode = float(1);
    backdropMat.transparent = false;
  }
  const BACKDROP_Z = -30;
  const backdrop = new Mesh(backdropGeom, backdropMat);
  // Y is set by `frameCamera`, from where the view axis actually crosses this
  // plane. It cannot be a constant tied to the board: the camera looks *down*,
  // so on a plane this far back the centre of frame sits some 20 units below
  // the board, and a wall centred near the board's own height would leave the
  // bottom of the picture empty.
  backdrop.position.set(0, 0, BACKDROP_Z);
  scene.add(backdrop);

  // --- surface ---------------------------------------------------------------
  // A grey slab, and it is an *object* rather than a background: it has
  // thickness, it takes the light, and it is parented to `root` so it turns
  // with the board.
  //
  // It replaced a ground plane, which could not do this job. A floor that
  // defines a horizon has to be short behind the subject and long in front of
  // it, and a shape like that cannot be rotated — turn it about Y and the
  // horizon swings across the frame. Worse, a *static* floor and a board that
  // pitches about the origin means the board's front edge drops through it: a
  // fifth of a radian of tilt was enough to cut the case in half. A slab that
  // travels with the board is in permanent contact with it, at any rotation,
  // because it is part of the same object.
  const surfaceMat = new MeshPhysicalNodeMaterial();
// Mid grey, not light grey. Under a 5.2-intensity key light a value this
  // close to white renders as white — which is what the slab did at 0xC2CACF,
  // and white under a dark product is exactly the competing brightness this
  // surface was meant to lose.
  surfaceMat.color = new Color(0x8e99a2);
  surfaceMat.roughness = 0.62;
  surfaceMat.metalness = 0;
  surfaceMat.clearcoat = 0.2;
  const surfaceGeom = new RoundedBoxGeometry(
    caseW + SURFACE_MARGIN * 2,
    SURFACE_H,
    caseD + SURFACE_MARGIN * 2,
    3,
    0.06,
  );
  const surface = new Mesh(surfaceGeom, surfaceMat);
  // Top face flush under the case, so the board stands on it rather than
  // hovering over it.
  surface.position.y = -CASE_H / 2 - SURFACE_H / 2;
  surface.castShadow = true;
  // Receives too: with no floor left, the board's shadow lands here.
  surface.receiveShadow = true;
  root.add(surface);

  // One surface, and it is the floor. There was a white plinth here that turned
  // with the board; it is gone because a second, brighter slab under a dark
  // product competes with it — four value steps in a shot whose subject is a
  // keyboard, not a pedestal. The board stands straight on the grey now, which
  // is quieter and lets the case's own edge be the brightest line in the frame.

  // --- camera and interaction ----------------------------------------------
  const pointer = new Vector2(0, 0);
  const targetPointer = new Vector2(0, 0);
  const focus = new Vector3(0, 0, 0);

  /**
   * Elevation of the camera above the desk, in radians. A 3/4 product angle,
   * a little lower than the original 0.68 so the case wall is visibly part of
   * the subject rather than a sliver under the keys — but not so low that the
   * key field foreshortens away and the chamfer highlight along the front edge
   * stops catching, which is what sells the case as milled.
   */
  const ELEVATION = 0.55;
  /**
   * Breathing room around the board inside the frame. Above 1.0, because the
   * fit it multiplies is not quite exact: it solves for the board's *centre*
   * depth, while the near corner sits half a case-depth closer to the camera
   * and so projects wider than the solve allows for. The margin covers that.
   * Well above 1.0, because anything below 1 is a crop, not a tighter shot.
   * It read as safe only while the old worst-case diagonal fit was inflating
   * the vertical term enough to hide it — once the width became the binding
   * axis, 0.95 cut the board off at both edges.
   */
  const PADDING = 1.18;
  /** Largest yaw the pointer and idle drift can reach, combined. */
  const MAX_YAW = 0.3;

  /** Frustum angles, cached by `placeCamera` for the per-frame refit. */
  let fovH = 0;
  let fovV = 0;
  /** Eased camera distance, so the dolly is a move rather than a jump. */
  let camDist = 0;

  const placeCamera = (width: number, height: number) => {
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;

    // Fit the board's *projected* box, not its bounding sphere. The board is
    // essentially a flat rectangle, so a sphere circumscribes mostly empty air
    // and pushes the camera roughly twice as far back as it needs to be.
    // Foreshortened depth plus the sliver of height the case and caps add:
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

    fovH = hFov;
    fovV = vFov;
    camera.updateProjectionMatrix();
    frameCamera(root.rotation.y, true);
  };

  /**
   * How far back the camera has to sit to frame the board at a given yaw.
   *
   * Solved per yaw rather than once for the worst case. Fitting the *diagonal*
   * — the pose at 45 degrees — does keep every rotation on screen, but it is
   * only free on the width axis, where `caseW` already dwarfs `caseD`. On the
   * depth axis it is not remotely free: the rotated footprint goes from 11.2
   * deep at rest to 18.2 at the diagonal, and depth is what drives the vertical
   * fit, so a fixed worst-case fit pushes the camera ~50% further back and
   * shrinks the board — including the legends — in the shot nobody has touched
   * yet. Almost every viewer sees only the resting pose, so the resting pose is
   * what should be framed tightly.
   */
  const distanceForYaw = (yaw: number) => {
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    // The slab is the subject, not the case: it oversails the board on every
    // side and turns with it, so framing the case alone lets its corners swing
    // out of shot on exactly the drag that shows it off.
    const subjectW = caseW + SURFACE_MARGIN * 2;
    const subjectD = caseD + SURFACE_MARGIN * 2;
    const yawedW = subjectW * c + subjectD * s;
    const yawedD = subjectD * c + subjectW * s;
    const projectedH =
      yawedD * Math.cos(ELEVATION) +
      (CASE_H + CAP_H + SURFACE_H) * Math.sin(ELEVATION);
    return (
      Math.max(
        yawedW / 2 / Math.tan(fovH / 2),
        projectedH / 2 / Math.tan(fovV / 2),
      ) * PADDING
    );
  };

  /**
   * Places the camera for the current yaw, easing unless `snap`. The ease is
   * what makes the dolly read as a camera pulling back to keep the subject in
   * frame rather than as the board shrinking.
   */
  const frameCamera = (yaw: number, snap = false) => {
    const target = distanceForYaw(yaw);
    camDist = snap ? target : camDist + (target - camDist) * 0.06;

    camera.position.set(
      0,
      camDist * Math.sin(ELEVATION),
      camDist * Math.cos(ELEVATION),
    );
    camera.lookAt(focus);

    // Centre the sweep on the frame, not on the board: follow the view axis to
    // where it crosses the backdrop plane. Biased a little above that so the
    // brightest part of the pool sits behind the board and the glow reads as
    // rising behind it rather than as a halo around it.
    const axisY =
      camera.position.y +
      ((BACKDROP_Z - camera.position.z) / (focus.z - camera.position.z)) *
        (focus.y - camera.position.y);
    // Biased off the board's depth, not the case height. The case is 18mm of a
    // frame metres across, so tying the pool's placement to it left the bias
    // invisible; the board's footprint is the thing the glow has to sit behind.
    backdrop.position.y = axisY + caseD * 0.5;


    // Size the sweep to the frustum where it actually sits, so its falloff is
    // measured against what the viewer can see. 2.4x the visible half-extent
    // puts the pool's outer edge — it reaches zero at 0.4 of the plane — just
    // inside the frame, so the sweep dissolves before the canvas boundary does.
    // Re-derived here rather than in `placeCamera` because the camera now moves
    // with the board, and a sweep sized for one distance tears at another.
    const reach = camera.position.distanceTo(backdrop.position);
    backdrop.scale.set(
      // 3.4, not 2.4: the backdrop is the only thing behind the subject now, so
      // any edge of it that lands inside the frame shows as a strip of clear
      // colour along the bottom.
      reach * Math.tan(fovH / 2) * 3.4,
      // The sweep is vertical and the camera looks down on it, so its height
      // is foreshortened; undo that or the pool ends up an ellipse lying on
      // its side rather than the round-ish glow it is in the plane's own space.
      (reach * Math.tan(fovV / 2) * 3.4) / Math.cos(ELEVATION),
      1,
    );
  };

  let width = canvas.clientWidth || 1;
  let height = canvas.clientHeight || 1;
  renderer.setSize(width, height, false);
  placeCamera(width, height);

  let raf = 0;
  let running = true;
  let active = true;
  const clock = { t: 0 };

  /**
   * Rotation the viewer has dialled in by dragging, which persists after they
   * let go — the board stays where it was put rather than springing back, the
   * way turning a real object over does.
   */
  let spin = 0;
  let tilt = 0;
  let dragging = false;
  /**
   * Pitch is clamped where yaw is not. Yaw all the way round a keyboard is
   * useful; pitching past these you are looking at the underside of the case
   * or straight down the key field, both of which are just broken-looking.
   */
  const TILT_MIN = -0.5;
  const TILT_MAX = 0.6;

  const render = () => {
    if (!running) return;
    raf = requestAnimationFrame(render);
    // Scrolled past the hero: keep the loop alive but stop doing GPU work,
    // rather than burning a frame budget on something nobody can see.
    if (!active) return;
    clock.t += 0.0045;

    if (reducedMotion && !dragging) {
      // Held drag rotation still applies: it is direct manipulation the viewer
      // asked for, not motion happening at them, so reduced-motion suppresses
      // the drift and the hover-follow but not the thing they are doing.
      root.rotation.set(-0.02 + tilt, spin, 0);
    } else if (dragging) {
      // Nothing but the drag while a finger is down. Letting the hover-follow
      // keep contributing here fights the drag: the pointer is travelling a
      // long way, so its ambient term swings hard in the same gesture and the
      // board no longer tracks the hand.
      root.rotation.y = spin;
      root.rotation.x = -0.02 + tilt;
    } else {
      // Ease toward the pointer so the board reads as an object being turned
      // over on a table, plus a slow idle drift so it is never dead still.
      // Both are offsets *on top of* whatever rotation was dragged in.
      pointer.lerp(targetPointer, 0.055);
      root.rotation.y = spin + pointer.x * (MAX_YAW - 0.04) + Math.sin(clock.t) * 0.035;
      root.rotation.x =
        -0.02 + tilt + pointer.y * 0.12 + Math.cos(clock.t * 0.8) * 0.015;
    }


    // Refit for however the board is currently turned. Cheap — a handful of
    // trig — and it is what lets the resting pose be framed tightly while a
    // dragged-to-45-degrees pose still fits.
    frameCamera(root.rotation.y);

    renderer.render(scene, camera);
  };
  render();

  return {
    resize(w, h) {
      width = Math.max(w, 1);
      height = Math.max(h, 1);
      renderer.setSize(width, height, false);
      placeCamera(width, height);
    },
    setPointer(x, y) {
      targetPointer.set(x, y);
    },
    rotateBy(yaw, pitch) {
      spin += yaw;
      tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, tilt + pitch));
    },
    setDragging(next) {
      dragging = next;
      if (!next) {
        // Hand the hover-follow back the pointer it has, rather than letting it
        // lerp from wherever the cursor was when the drag started — otherwise
        // releasing the mouse snaps the board through the whole drag distance.
        pointer.copy(targetPointer);
      }
    },
    setActive(next) {
      active = next;
    },
    setColors(nextCase, nextColorway) {
      caseMat.colorNode = chamferColor(nextCase.hex, caseW, caseD);
      caseMat.needsUpdate = true;
      for (const zone of zones) {
        const material = capMaterials.get(zone);
        if (!material) continue;
        const face = new Color(nextColorway[zone]);
        material.colorNode = capColor(face);
        material.needsUpdate = true;
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      for (const geometry of capGeoms.values()) geometry.dispose();
      caseGeom.dispose();
      for (const geometry of legendGeoms) geometry.dispose();
      for (const material of legendMats) material.dispose();
      backdropGeom.dispose();
      backdropMat.dispose();
      surfaceGeom.dispose();
      surfaceMat.dispose();
      env.dispose();
      atlas.dispose();
      renderer.dispose();
    },
  };
}
