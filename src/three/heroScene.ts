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
  ShadowMaterial,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnvironment } from './studioEnv';
import { attribute, color, float, mix, positionLocal, smoothstep, texture, uv, vec2 } from 'three/tsl';
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
 * A chunky milled block the keys are set *into*, rather than a tray they sit on.
 *
 * Sized against the board's depth (~6.5), not in the abstract: a case taller
 * than the board is deep stops reading as a keyboard and becomes a plinth with
 * keys on top, and at any camera elevation that shows the key field the wall
 * then dominates the frame. Roughly 2/3 of the board depth is the point where
 * it still reads as substantial hardware.
 *
 * Nearly everything else derives from this — cap seating, legend lift, the
 * chamfer ramp, the backdrop, the shadow catcher and the camera fit. The two
 * things that do *not*, and so must be kept in step by hand, are the light rig's
 * distance and the shadow camera's frustum; see STAGE_DISTANCE.
 */
const CASE_H = 4.4;
/** Extra case beyond the key field, on every side: the frame around the keys. */
const BEZEL = 0.3;
/**
 * Width of the bright turn-over along the case's top edge, in world units.
 * Absolute rather than a fraction of case height: a chamfer is a machined edge
 * of fixed size, so it must not grow when the case gets deeper.
 */
const CHAMFER = 0.08;

export interface HeroScene {
  resize: (width: number, height: number) => void;
  setPointer: (x: number, y: number) => void;
  setColors: (caseOption: CaseOption, colorway: ColorwayOption) => void;
  /** Stops the render loop when the board is off-screen. */
  setActive: (active: boolean) => void;
  dispose: () => void;
}

/**
 * The bright line where a milled case's top face turns over. Both ends of the
 * ramp are computed in JS so the shader only has to interpolate between two
 * constants.
 */
function chamferColor(hex: string) {
  const body = new Color(hex);
  const edge = body.clone().lerp(new Color(0xffffff), 0.22);
  // positionLocal.y runs -CASE_H/2..CASE_H/2; the top sliver is the chamfer.
  const ramp = smoothstep(float(CASE_H / 2 - CHAMFER), float(CASE_H / 2), positionLocal.y);
  return mix(color(body), color(edge), ramp);
}

/**
 * Anodised aluminium. The chamfer along the top edge is what actually sells a
 * milled case: a bright, narrow highlight where the top face turns over. TSL
 * gives it to us from local position rather than a texture.
 */
function caseMaterial(hex: string): MeshPhysicalNodeMaterial {
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
  // Heavy clearcoat, and this is the load-bearing value for the darker cases.
  // A clearcoat's reflectance does not depend on the base colour — it is a
  // transparent lacquer over the top — whereas both the diffuse and the metal
  // F0 of Anodized Black (#1C1C1E) are nearly zero. So on a black case the
  // clearcoat is essentially the *only* thing that puts light on a wall facing
  // away from the key light, and it is what stops the sides going to page
  // black while the top face reads silver.
  material.clearcoat = 0.85;
  material.clearcoatRoughness = 0.28;

  material.colorNode = chamferColor(hex);
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
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
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
  scene.environmentIntensity = 0.95;

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
  const caseMat = caseMaterial(caseOption.hex);
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

  const keyPos = stage(-5, 7.5, 5);
  const key = new DirectionalLight(0xfff4e8, 3.4);
  key.position.copy(keyPos);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = STAGE_DISTANCE * 2.2;
  // Half-extent of the board as seen from the light. Derived from the case so a
  // future height change cannot silently crop the shadow.
  const shadowExtent = Math.max(caseW, caseD, CASE_H) * 0.95;
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.bias = -0.002;
  key.shadow.radius = 8;
  scene.add(key);

  const kicker = new DirectionalLight(0x9fc4ff, 2.2);
  kicker.position.copy(stage(6, 2.6, -6));
  scene.add(kicker);

  // Front fill, roughly along the camera axis and deliberately weak. The key
  // and kicker are both high and raking, so the one surface neither of them
  // addresses is the case's front wall — the face the viewer looks straight at
  // and the one that reads as the case's thickness. Without this the wall is
  // carried entirely by the environment's horizon band. No shadow: this is
  // filling shadow, not making more of it.
  const fillFront = new DirectionalLight(0xdfe6f2, 2.4);
  fillFront.position.copy(stage(0.5, 1.6, 6));
  scene.add(fillFront);

  const fill = new HemisphereLight(0x8899bb, 0x0b0b0d, 0.55);
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
    // Elliptical falloff — wider than tall, so the pool reads as a lamp thrown
    // across a sweep rather than a circle pasted behind the board.
    const d = uv().sub(vec2(0.5, 0.5)).mul(vec2(1, 1.5)).length();
    // Ramped outward and inverted, never `smoothstep(hi, lo, x)`. A reversed
    // pair is undefined in GLSL, and it showed: the pool clipped to a hard
    // rectangle instead of falling off. Zero well inside the plane's edges
    // (|u-0.5| = 0.38 of 0.5) so the sweep never reveals its own geometry.
    // A broad plateau before the falloff starts, so the sweep is a lit wall
    // with a soft edge rather than a small bright dot lost in a long gradient.
    const pool = smoothstep(float(0.14), float(0.38), d).oneMinus();
    backdropMat.colorNode = mix(color(0x2b3340), color(0xa8bcd8), pool);
    // Fades to fully transparent well inside the plane's edges, so the sweep
    // dissolves into the page background instead of ending on a visible seam.
    // The canvas is alpha-blended over the page, so this has to be opacity —
    // matching the page colour here would break the moment the page restyles.
    backdropMat.opacityNode = pool;
  }
  const BACKDROP_Z = -30;
  const backdrop = new Mesh(backdropGeom, backdropMat);
  // Y is set by `placeCamera`, from where the view axis actually crosses this
  // plane. It cannot be a constant tied to the board: the camera looks *down*,
  // so on a plane this far back the centre of frame sits some 20 units below
  // the board, and a pool centred near the board's own height lands entirely
  // above the top of the picture.
  backdrop.position.set(0, 0, BACKDROP_Z);
  scene.add(backdrop);

  // Catches the contact shadow on an otherwise transparent canvas, so the board
  // sits on the page rather than floating in front of it. Drawn over the
  // backdrop, so the shadow reads against the lit sweep and not just the page.
  const shadowPlane = new Mesh(
    new PlaneGeometry(120, 120),
    new ShadowMaterial({ opacity: 0.46, transparent: true }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -CASE_H / 2 - 0.01;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

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
  const ELEVATION = 0.62;
  /**
   * Breathing room around the board inside the frame. Slightly tighter than 1.0
   * to buy back the on-screen legend size the thicker case costs.
   */
  const PADDING = 0.95;
  /** Largest yaw the pointer and idle drift can reach, combined. */
  const MAX_YAW = 0.3;

  const placeCamera = (width: number, height: number) => {
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;

    // Fit the board's *projected* box, not its bounding sphere. The board is
    // essentially a flat rectangle, so a sphere circumscribes mostly empty air
    // and pushes the camera roughly twice as far back as it needs to be.
    // Foreshortened depth plus the sliver of height the case and caps add:
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

    // Fit the board at its *widest* yaw, not at rest. Solving for the resting
    // pose lets the board swing past the canvas edge as soon as the pointer
    // turns it, which is exactly when someone is looking at it.
    const cos = Math.cos(MAX_YAW);
    const sin = Math.sin(MAX_YAW);
    const yawedW = caseW * cos + caseD * sin;
    const yawedD = caseD * cos + caseW * sin;
    const projectedH =
      yawedD * Math.cos(ELEVATION) + (CASE_H + CAP_H) * Math.sin(ELEVATION);

    const distance =
      Math.max(
        yawedW / 2 / Math.tan(hFov / 2),
        projectedH / 2 / Math.tan(vFov / 2),
      ) * PADDING;

    camera.position.set(
      0,
      distance * Math.sin(ELEVATION),
      distance * Math.cos(ELEVATION),
    );
    camera.lookAt(focus);
    camera.updateProjectionMatrix();

    // Centre the sweep on the frame, not on the board: follow the view axis to
    // where it crosses the backdrop plane. Biased a little above that so the
    // brightest part of the pool sits behind the board and the glow reads as
    // rising behind it rather than as a halo around it.
    const axisY =
      camera.position.y +
      ((BACKDROP_Z - camera.position.z) / (focus.z - camera.position.z)) *
        (focus.y - camera.position.y);
    backdrop.position.y = axisY + CASE_H;

    // Size the sweep to the frustum where it actually sits, so its falloff is
    // measured against what the viewer can see. 2.4x the visible half-extent
    // puts the pool's outer edge — it reaches zero at 0.38 of the plane — just
    // inside the frame, so the sweep dissolves before the canvas boundary does.
    const reach = camera.position.distanceTo(backdrop.position);
    const halfW = reach * Math.tan(hFov / 2);
    const halfH = reach * Math.tan(vFov / 2);
    backdrop.scale.set(
      halfW * 2.4,
      // The sweep is vertical and the camera looks down on it, so its height
      // is foreshortened; undo that or the pool ends up an ellipse lying on
      // its side rather than the round-ish glow it is in the plane's own space.
      (halfH * 2.4) / Math.cos(ELEVATION),
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

  const render = () => {
    if (!running) return;
    raf = requestAnimationFrame(render);
    // Scrolled past the hero: keep the loop alive but stop doing GPU work,
    // rather than burning a frame budget on something nobody can see.
    if (!active) return;
    clock.t += 0.0045;

    if (reducedMotion) {
      root.rotation.set(-0.02, 0, 0);
    } else {
      // Ease toward the pointer so the board reads as an object being turned
      // over on a table, plus a slow idle drift so it is never dead still.
      pointer.lerp(targetPointer, 0.055);
      // Stays within MAX_YAW, which is what placeCamera framed for.
      root.rotation.y = pointer.x * (MAX_YAW - 0.04) + Math.sin(clock.t) * 0.035;
      root.rotation.x = -0.02 + pointer.y * 0.12 + Math.cos(clock.t * 0.8) * 0.015;
    }
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
    setActive(next) {
      active = next;
    },
    setColors(nextCase, nextColorway) {
      caseMat.colorNode = chamferColor(nextCase.hex);
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
      env.dispose();
      atlas.dispose();
      renderer.dispose();
    },
  };
}
