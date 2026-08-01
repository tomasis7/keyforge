import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import type { ColorwayOption } from '../data/options';
import { keyBaseColor } from '../lib/color';
import { EASE_EXPO, EASE_POWER2, reducedMotion } from './motion';

gsap.registerPlugin(Flip);

type Zone = 'alpha' | 'mod' | 'accent';

const LABEL_KEY: Record<Zone, 'onAlpha' | 'onMod' | 'onAccent'> = {
  alpha: 'onAlpha',
  mod: 'onMod',
  accent: 'onAccent',
};

let pendingFlip: Flip.FlipState | null = null;

export function captureLayoutFlip(): void {
  // Scoped to the viewer: the hero board lives under a 3D transform
  // (rotateX), which breaks Flip's absolute-position measurements.
  pendingFlip = Flip.getState('.configurator-viewer .key');
}

export function consumeLayoutFlip(): Flip.FlipState | null {
  const state = pendingFlip;
  pendingFlip = null;
  return state;
}

export function animateFlip(state: Flip.FlipState): void {
  if (reducedMotion()) return;
  Flip.from(state, {
    duration: 0.6,
    ease: EASE_EXPO,
    absolute: true,
    scale: true,
    stagger: 0.004,
    onEnter: (els) =>
      els.forEach((el) =>
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: 0.4 },
        ),
      ),
    // No onLeave: React unmounts departing keys before this runs, so Flip hands
    // us detached nodes (its isVisible test reads getBoundingClientRect, which
    // is all-zero once detached) and it never re-inserts them. A tween here
    // animates nothing. Exits are therefore instant — most visible on 75% -> 65%,
    // which drops all 15 F-row keys. Animating them would mean re-appending the
    // nodes and re-fitting them to their captured position by hand, because the
    // viewBox has already changed underneath them.
  });
}

// Total by construction: every .key is rendered with a data-zone from a typed
// Zone field. The fallback is unreachable, but returning a real zone (rather
// than undefined, which GSAP would skip) means a malformed key recolours to
// something plausible instead of being stranded at its previous colour.
const zoneOfElement = (el: Element): Zone => {
  const zone = el.closest('.key')?.getAttribute('data-zone');
  return zone === 'mod' || zone === 'accent' ? zone : 'alpha';
};

export function recolorKeys(
  root: HTMLElement,
  oldColorway: ColorwayOption,
  newColorway: ColorwayOption,
): void {
  if (reducedMotion()) return;

  const tops: HTMLElement[] = [];
  const bases: HTMLElement[] = [];
  const labels: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('.key').forEach((key) => {
    const top = key.querySelector<HTMLElement>('.key-top');
    const base = key.querySelector<HTMLElement>('.key-base');
    const label = key.querySelector<HTMLElement>('.key-label');
    if (top) tops.push(top);
    if (base) bases.push(base);
    if (label) labels.push(label);
  });

  const zoneColor =
    (colorway: ColorwayOption) =>
    (_index: number, el: Element): string =>
      colorway[zoneOfElement(el)];

  const baseColor =
    (colorway: ColorwayOption) =>
    (_index: number, el: Element): string =>
      keyBaseColor(colorway[zoneOfElement(el)]);

  const labelColor =
    (colorway: ColorwayOption) =>
    (_index: number, el: Element): string =>
      colorway[LABEL_KEY[zoneOfElement(el)]];

  // overwrite: true — a colorway switch mid-tween would otherwise leave two
  // fromTo tweens rendering the same fill property and fighting each tick.
  const tween = (
    targets: HTMLElement[],
    from: (i: number, el: Element) => string,
    to: (i: number, el: Element) => string,
  ) =>
    gsap.fromTo(
      targets,
      { fill: from },
      {
        fill: to,
        duration: 0.3,
        ease: EASE_POWER2,
        stagger: 0.005,
        overwrite: true,
      },
    );

  tween(tops, zoneColor(oldColorway), zoneColor(newColorway));
  tween(bases, baseColor(oldColorway), baseColor(newColorway));
  tween(labels, labelColor(oldColorway), labelColor(newColorway));
}

export function recolorCase(root: HTMLElement, oldHex: string, newHex: string): void {
  if (reducedMotion()) return;
  const rect = root.querySelector('.board-case');
  if (!rect) return;
  gsap.fromTo(
    rect,
    { fill: oldHex },
    { fill: newHex, duration: 0.3, ease: EASE_POWER2, overwrite: true },
  );
}
