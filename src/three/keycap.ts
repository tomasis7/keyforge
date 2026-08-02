import type { BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** How much narrower the top face is than the base. Real caps taper hard. */
const TAPER = 0.7;
/**
 * Depth of the dish scooped out of the top face, as a fraction of cap height.
 * Kept shallow: the legends are flat quads laid on the cap, and a deep dish
 * curves the surface up past them at the edges so the cap occludes its own
 * lettering.
 */
export const DISH = 0.07;

/**
 * A keycap, not a box.
 *
 * The single biggest thing separating a plausible render from an obviously
 * synthetic one is that real keycaps are frusta: the top face is meaningfully
 * smaller than the base, so every cap catches a highlight on its four sloped
 * shoulders. A plain rounded box has vertical sides and reads as a tile.
 *
 * Built by deforming a rounded box rather than authoring a mesh: pull the upper
 * vertices toward the centre for the taper, then scoop the top face into a
 * shallow cylindrical dish. Normals are recomputed so the shoulders light
 * correctly.
 */
export function keycapGeometry(height: number): BufferGeometry {
  const geometry = new RoundedBoxGeometry(1, height, 1, 5, 0.07);
  const position = geometry.attributes.position;
  const half = height / 2;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    // 0 at the base, 1 at the top face.
    const t = Math.min(Math.max((y + half) / height, 0), 1);
    // Eased so the shoulder turns near the top rather than sloping the whole
    // way down, which is what the profile of a real cap does.
    const shoulder = t * t;
    const scale = 1 + (TAPER - 1) * shoulder;

    position.setX(i, x * scale);
    position.setZ(i, z * scale);

    if (t > 0.92) {
      // Cylindrical dish: deepest along the middle, flat front to back, so it
      // scoops the way a fingertip sits rather than denting like a sphere.
      const across = Math.min(Math.abs(x * scale) / (TAPER / 2), 1);
      position.setY(i, y - DISH * height * (1 - across * across));
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
