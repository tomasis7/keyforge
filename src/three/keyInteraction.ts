import type { InstancedMesh, Object3D, Raycaster } from 'three';
import { InstancedBufferAttribute } from 'three';

/** How far a pressed cap travels, in scene units. One unit is 19.05mm. */
export const PRESS_TRAVEL = 0.08;
/** Seconds for the key to reach the bottom, and to spring back up. */
const DOWN_S = 0.06;
const UP_S = 0.14;
/** Cycles per second of the hover pulse. */
const PULSE_HZ = 1.6;

interface Bucket {
  /**
   * Two float attributes rather than one vec2. The typed `attribute()` helper
   * returns a node without component accessors, so a vec2 would need casting to
   * be swizzled in the shader; two floats need no swizzle at all.
   */
  pressAttr: InstancedBufferAttribute;
  glowAttr: InstancedBufferAttribute;
  /** Board-key index for each instance in this bucket, in instance order. */
  keys: number[];
}

interface Target {
  mesh: InstancedMesh;
  keys: number[];
}

export interface KeyInteraction {
  /**
   * Adds the per-instance state attribute to a mesh's geometry and starts
   * driving it. `keys` maps instance order to board-key index.
   */
  register: (mesh: InstancedMesh, keys: number[], pickable: boolean) => void;
  /** Board-key index under the ray, or null. */
  pick: (raycaster: Raycaster) => number | null;
  setHover: (key: number | null) => void;
  press: (key: number) => void;
  /** Advances animations and uploads changed attributes. */
  update: (elapsed: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

/**
 * Per-key hover and press state for the hero board.
 *
 * State is keyed by *board key index* rather than by instance, because a single
 * key exists as an instance in two different meshes — its cap and its legend —
 * and those two do not share an instance order: legend meshes skip keys with no
 * label. Anything keyed by instance would drift between them, and a pressed cap
 * would leave its lettering hanging in the air above it.
 */
export function createKeyInteraction(keyCount: number): KeyInteraction {
  // x = press (0..1), y = glow (0..1). One vec2 per instance.
  const press = new Float32Array(keyCount);
  const glow = new Float32Array(keyCount);
  /** Seconds since each key was struck; Infinity means "not animating". */
  const struck = new Float32Array(keyCount).fill(Infinity);

  const buckets: Bucket[] = [];
  const targets: Target[] = [];
  let hovered: number | null = null;
  let lastElapsed = 0;

  return {
    register(mesh, keys, pickable) {
      const pressAttr = new InstancedBufferAttribute(new Float32Array(keys.length), 1);
      const glowAttr = new InstancedBufferAttribute(new Float32Array(keys.length), 1);
      // Rewritten most frames while anything is animating.
      pressAttr.setUsage(35048 /* DynamicDrawUsage */);
      glowAttr.setUsage(35048 /* DynamicDrawUsage */);
      mesh.geometry.setAttribute('aPress', pressAttr);
      mesh.geometry.setAttribute('aGlow', glowAttr);
      buckets.push({ pressAttr, glowAttr, keys });
      if (pickable) targets.push({ mesh, keys });
    },

    pick(raycaster) {
      let best: { distance: number; key: number } | null = null;
      for (const target of targets) {
        // `intersectObject` on an InstancedMesh reports `instanceId`, which is
        // the index into this bucket's own key list rather than a board index.
        for (const hit of raycaster.intersectObject(target.mesh, false)) {
          if (hit.instanceId === undefined) continue;
          if (!best || hit.distance < best.distance) {
            best = { distance: hit.distance, key: target.keys[hit.instanceId] };
          }
          break;
        }
      }
      return best ? best.key : null;
    },

    setHover(key) {
      hovered = key;
    },

    press(key) {
      if (key < 0 || key >= keyCount) return;
      // Restart rather than ignore, so hammering the same key keeps responding.
      struck[key] = lastElapsed;
    },

    update(elapsed, reducedMotion) {
      lastElapsed = elapsed;
      // A hovered key pulses; everything else settles to zero. Reduced motion
      // gets the highlight without the pulse — the point is knowing which key
      // is under the cursor, and that survives being still.
      const pulse = reducedMotion ? 0.6 : 0.45 + 0.35 * Math.sin(elapsed * PULSE_HZ * Math.PI * 2);

      for (let i = 0; i < keyCount; i += 1) {
        const wantGlow = i === hovered ? pulse : 0;
        // Eased rather than snapped, so sweeping the cursor leaves a short trail
        // instead of flicking keys on and off.
        glow[i] += (wantGlow - glow[i]) * 0.25;

        const since = elapsed - struck[i];
        if (since < 0 || !Number.isFinite(since)) {
          press[i] = 0;
        } else if (since < DOWN_S) {
          press[i] = since / DOWN_S;
        } else if (since < DOWN_S + UP_S) {
          const t = (since - DOWN_S) / UP_S;
          // Ease-out on the way back so it springs rather than drifts.
          press[i] = 1 - (1 - (1 - t) * (1 - t));
        } else {
          press[i] = 0;
          struck[i] = Infinity;
        }
      }

      for (const bucket of buckets) {
        const pressArr = bucket.pressAttr.array as Float32Array;
        const glowArr = bucket.glowAttr.array as Float32Array;
        for (let i = 0; i < bucket.keys.length; i += 1) {
          const key = bucket.keys[i];
          pressArr[i] = press[key];
          glowArr[i] = glow[key];
        }
        bucket.pressAttr.needsUpdate = true;
        bucket.glowAttr.needsUpdate = true;
      }
    },

    dispose() {
      buckets.length = 0;
      targets.length = 0;
    },
  };
}

/** Narrows a hit test to meshes we actually registered. */
export const isInstanced = (o: Object3D): o is InstancedMesh =>
  (o as InstancedMesh).isInstancedMesh === true;
