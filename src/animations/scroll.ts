import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE_EXPO, reducedMotion } from './motion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Creates the scroll reveals and returns a teardown. Everything is built inside
 * a gsap.context so a single revert() kills the tweens and their ScrollTriggers
 * and restores the original styles — which is what makes this safe under
 * StrictMode's mount/unmount/remount and under HMR. It previously guarded with
 * a module-level `initialized` flag and never cleaned up.
 */
export function initScrollReveals(): () => void {
  if (reducedMotion()) return () => {};

  const ctx = gsap.context(() => {
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
  });

  return () => ctx.revert();
}

/**
 * Trigger positions are measured once at creation. Switching layout changes the
 * board's aspect ratio (16u x 5 rows vs 18.5u x 6 rows), which reflows every
 * section below the configurator and leaves not-yet-fired triggers pointing at
 * stale offsets.
 */
export function refreshScrollReveals(): void {
  ScrollTrigger.refresh();
}
