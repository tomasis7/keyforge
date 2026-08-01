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

const VIEWER_BOARD = '.configurator-viewer svg.board';
const EXIT_LAYER = 'board-exit-layer';

const keyIdsOf = (root: ParentNode): string[] =>
  [...root.querySelectorAll('.key')]
    .map((k) => k.getAttribute('data-key-id'))
    .filter((id): id is string => id !== null);

/**
 * A copy of the board taken before the store update, used to animate keys that
 * the next layout drops. It has to be a clone: React unmounts those nodes, and
 * a detached node has no position to animate from.
 */
interface ExitSnapshot {
  board: SVGSVGElement;
  rect: DOMRect;
  keyIds: Set<string>;
}

let pendingFlip: Flip.FlipState | null = null;
let pendingExit: ExitSnapshot | null = null;

export function captureLayoutFlip(): void {
  // Scoped to the viewer: the hero board lives under a 3D transform
  // (rotateX), which breaks Flip's absolute-position measurements.
  pendingFlip = Flip.getState('.configurator-viewer .key');

  const board = document.querySelector<SVGSVGElement>(VIEWER_BOARD);
  pendingExit = board
    ? {
        board: board.cloneNode(true) as SVGSVGElement,
        rect: board.getBoundingClientRect(),
        keyIds: new Set(keyIdsOf(board)),
      }
    : null;
}

export function consumeLayoutFlip(): Flip.FlipState | null {
  const state = pendingFlip;
  pendingFlip = null;
  return state;
}

/**
 * Fades out the keys the new layout dropped — 75% -> 65% loses the whole F-row,
 * which otherwise blinks out of existence while everything else glides.
 *
 * Flip cannot do this for us: by the time its callbacks run React has already
 * detached those nodes, so `onLeave` receives elements with no box to animate.
 * Instead we replay them from the pre-update clone, in a layer we create and
 * destroy ourselves. Nothing here touches a node React owns; the layer is only
 * ever appended last and removed whole.
 */
export function animateExits(viewer: HTMLElement): void {
  const snapshot = pendingExit;
  pendingExit = null;

  // A layout change during a previous exit supersedes it.
  viewer.querySelector(`.${EXIT_LAYER}`)?.remove();
  if (!snapshot || reducedMotion()) return;

  const surviving = new Set(keyIdsOf(viewer));
  const departed = [...snapshot.keyIds].filter((id) => !surviving.has(id));
  if (departed.length === 0) return;

  const ghost = snapshot.board;
  // Keep only the departing keys; the case is still on screen for real.
  ghost.querySelector('.board-case')?.remove();
  for (const key of [...ghost.querySelectorAll('.key')]) {
    if (!departed.includes(key.getAttribute('data-key-id') ?? '')) key.remove();
  }

  // The clone keeps the *old* viewBox, so sizing the layer to the old board's
  // screen rect puts every ghost key exactly where its original was.
  const viewerRect = viewer.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = EXIT_LAYER;
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${snapshot.rect.left - viewerRect.left}px`;
  layer.style.top = `${snapshot.rect.top - viewerRect.top}px`;
  layer.style.width = `${snapshot.rect.width}px`;
  layer.style.height = `${snapshot.rect.height}px`;
  ghost.setAttribute('width', '100%');
  ghost.setAttribute('height', '100%');
  layer.appendChild(ghost);
  viewer.appendChild(layer);

  gsap.to(ghost.querySelectorAll('.key'), {
    opacity: 0,
    scale: 0.6,
    transformOrigin: 'center',
    duration: 0.35,
    ease: EASE_POWER2,
    stagger: 0.004,
    onComplete: () => layer.remove(),
  });
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
    // is all-zero once detached) and it never re-inserts them. animateExits()
    // handles them from a pre-update clone instead.
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
