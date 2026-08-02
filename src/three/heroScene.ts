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
const LEGEND_W = 0.5;
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
const CASE_H = 2.1;
/**
 * Extra case beyond the key field, on every side — the frame the keys sit
 * inside. Close to a full key wide, so the board reads as a machined block the
 * keys are set into rather than a plate they are sitting on.
 */
const BEZEL = 0.85;
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
  material.metalness = 0.86;
  material.roughness = 0.42;
  material.clearcoat = 0.25;
  material.clearcoatRoughness = 0.5;

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
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);

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
  const key = new DirectionalLight(0xfff4e8, 3.4);
  key.position.set(-5, 7.5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.002;
  key.shadow.radius = 4;
  scene.add(key);

  const kicker = new DirectionalLight(0x9fc4ff, 2.2);
  kicker.position.set(6, 2.6, -6);
  scene.add(kicker);

  const fill = new HemisphereLight(0x8899bb, 0x0b0b0d, 0.55);
  scene.add(fill);

  // Catches the contact shadow on an otherwise transparent canvas, so the board
  // sits on the page rather than floating in front of it.
  const shadowPlane = new Mesh(
    new PlaneGeometry(60, 60),
    new ShadowMaterial({ opacity: 0.5, transparent: true }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -CASE_H / 2 - 0.01;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // --- camera and interaction ----------------------------------------------
  const pointer = new Vector2(0, 0);
  const targetPointer = new Vector2(0, 0);
  const focus = new Vector3(0, 0, 0);

  /** Elevation of the camera above the desk, in radians. A 3/4 product angle. */
  const ELEVATION = 0.68;
  /** Breathing room around the board inside the frame. */
  const PADDING = 1.0;
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
      atlas.dispose();
      renderer.dispose();
    },
  };
}
