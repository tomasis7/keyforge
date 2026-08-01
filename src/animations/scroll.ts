import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE_EXPO, reducedMotion } from './motion';

gsap.registerPlugin(ScrollTrigger);

let initialized = false;

export function initScrollReveals(): void {
  if (initialized || reducedMotion()) return;
  initialized = true;

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const items = group.querySelectorAll('[data-reveal]');
    if (items.length === 0) return;
    gsap.from(items, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: EASE_EXPO,
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });

  document
    .querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-group] [data-reveal])')
    .forEach((el) => {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: EASE_EXPO,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });
}
