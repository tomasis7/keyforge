import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { EASE_COUNT, reducedMotion } from './motion';

export function useAnimatedNumber(value: number): number {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    const from = prevRef.current;
    prevRef.current = value;
    if (reducedMotion()) {
      setDisplay(value);
      return;
    }
    const proxy = { val: from };
    const tween = gsap.to(proxy, {
      val: value,
      duration: 0.5,
      ease: EASE_COUNT,
      snap: { val: 1 },
      onUpdate: () => setDisplay(Math.round(proxy.val)),
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return display;
}
