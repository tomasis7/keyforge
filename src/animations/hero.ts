import gsap from 'gsap';
import { EASE_BACK, EASE_EXPO, reducedMotion } from './motion';

const animated = new WeakSet<HTMLElement>();

export function heroEntrance(root: HTMLElement): void {
  if (animated.has(root) || reducedMotion()) return;
  animated.add(root);

  const timeline = gsap.timeline({ defaults: { ease: EASE_EXPO } });

  timeline
    .from(root.querySelector('.kicker'), { y: 16, opacity: 0, duration: 0.5 })
    .from(
      root.querySelectorAll('.word-inner'),
      { yPercent: 110, stagger: 0.06, duration: 0.9 },
      '-=0.35',
    )
    .from(
      root.querySelectorAll('.hero-board .key'),
      {
        scale: 0,
        transformOrigin: 'center',
        stagger: { each: 0.006, from: 'random' },
        duration: 0.5,
        ease: EASE_BACK,
      },
      '-=0.35',
    )
    .from(
      root.querySelectorAll('.hero-sub, .hero-cta'),
      { y: 16, opacity: 0, duration: 0.5 },
      '-=0.35',
    );
}
