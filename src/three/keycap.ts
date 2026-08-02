import type { BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Corner radius, in world units. Absolute, so every cap rounds identically. */
const RADIUS = 0.07;
/** How far each side draws in between base and top. Also absolute. */
const INSET = 0.11;
/**
 * Depth of the dish scooped out of the top face, as a fraction of cap height.
 * Kept shallow: the legends are flat quads laid on the cap, and a deep dish
 * curves the surface up past them at the edges so the cap occludes its own
 * lettering.
 */
export const DISH = 0.07;

/**
 * One keycap, built at its true size.
 *
 * Every cap is the *same shape* — same corner radius, same shoulder angle —
 * just longer or shorter. That is why a spacebar reads as a spacebar rather
 * than a stretched alpha.
 *
 * This has to be geometry rather than a scaled instance. Scaling a single cap
 * mesh to 6.25u stretches its corner radii and shoulder slopes by the same
 * factor, which is exactly what made the spacebar and enter key look wrong:
 * a lozenge with soft bulging ends instead of a long cap with normal corners.
 * So the taper is an absolute inset and the radius is an absolute radius, and
 * geometries are cached per distinct size.
 */
export function keycapGeometry(width: number, depth: number, height: number): BufferGeometry {
  const geometry = new RoundedBoxGeometry(width, height, depth, 5, RADIUS);
  const position = geometry.attributes.position;
  const half = height / 2;
  const topHalfWidth = Math.max(width / 2 - INSET, RADIUS);

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    // 0 at the base, 1 at the top face.
    const t = Math.min(Math.max((y + half) / height, 0), 1);
    // Eased so the shoulder turns near the top rather than sloping the whole
    // way down, which is what the profile of a real cap does.
    const shoulder = t * t;
    const draw = INSET * shoulder;

    // Absolute pull-in per side, never past the centre line.
    position.setX(i, x - Math.sign(x) * Math.min(draw, Math.abs(x)));
    position.setZ(i, z - Math.sign(z) * Math.min(draw, Math.abs(z)));

    if (t > 0.92) {
      // Cylindrical dish: deepest along the middle, flat front to back, so it
      // scoops the way a fingertip sits rather than denting like a sphere.
      const across = Math.min(Math.abs(x) / topHalfWidth, 1);
      position.setY(i, y - DISH * height * (1 - across * across));
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
