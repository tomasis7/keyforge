import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import type { ColorwayOption } from '../data/options';
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
  pendingFlip = Flip.getState('.key');
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
    onLeave: (els) =>
      els.forEach((el) => gsap.to(el, { opacity: 0, scale: 0.6, duration: 0.3 })),
  });
}

const zoneOfElement = (el: Element): Zone =>
  el.closest('.key')?.getAttribute('data-zone') as Zone;

export function recolorKeys(
  root: HTMLElement,
  oldColorway: ColorwayOption,
  newColorway: ColorwayOption,
): void {
  if (reducedMotion()) return;

  const tops: HTMLElement[] = [];
  const labels: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('.key').forEach((key) => {
    const top = key.querySelector<HTMLElement>('.key-top');
    const label = key.querySelector<HTMLElement>('.key-label');
    if (top) tops.push(top);
    if (label) labels.push(label);
  });

  const zoneColor =
    (colorway: ColorwayOption) =>
    (_index: number, el: Element): string =>
      colorway[zoneOfElement(el)];

  const labelColor =
    (colorway: ColorwayOption) =>
    (_index: number, el: Element): string =>
      colorway[LABEL_KEY[zoneOfElement(el)]];

  gsap.fromTo(
    tops,
    { fill: zoneColor(oldColorway) },
    { fill: zoneColor(newColorway), duration: 0.3, ease: EASE_POWER2, stagger: 0.005 },
  );
  gsap.fromTo(
    labels,
    { fill: labelColor(oldColorway) },
    { fill: labelColor(newColorway), duration: 0.3, ease: EASE_POWER2, stagger: 0.005 },
  );
}

export function recolorCase(root: HTMLElement, oldHex: string, newHex: string): void {
  if (reducedMotion()) return;
  const rect = root.querySelector('.board-case');
  if (!rect) return;
  gsap.fromTo(
    rect,
    { fill: oldHex },
    { fill: newHex, duration: 0.3, ease: EASE_POWER2 },
  );
}
