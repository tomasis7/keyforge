import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { EASE_COUNT, reducedMotion } from './motion';

/**
 * Counts up to `value`, writing straight to the DOM.
 *
 * The previous version held the tweened number in useState and called
 * setDisplay from GSAP's onUpdate, which re-rendered the whole price bar once
 * per animation frame. Here GSAP owns the text node outright: attach the
 * returned ref to an element with **no React children**, so React has nothing
 * to write there and the two can never fight over it.
 */
export function useAnimatedNumber(
  value: number,
  prefix = '',
): RefObject<HTMLSpanElement> {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = prevRef.current;
    prevRef.current = value;

    if (from === value || reducedMotion()) {
      el.textContent = prefix + value;
      return;
    }

    const proxy = { val: from };
    const tween = gsap.to(proxy, {
      val: value,
      duration: 0.5,
      ease: EASE_COUNT,
      snap: { val: 1 },
      onUpdate: () => {
        el.textContent = prefix + Math.round(proxy.val);
      },
    });
    return () => {
      tween.kill();
      // Killing mid-flight would otherwise strand the display on a partial
      // number that no longer matches the real total.
      el.textContent = prefix + value;
    };
  }, [value, prefix]);

  return ref;
}
