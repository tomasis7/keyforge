import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../animations/motion';
import type { LayoutId } from '../data/layouts';
import type { CaseOption, ColorwayOption } from '../data/options';
import type { HeroScene } from '../three/heroScene';

interface Props {
  layout: LayoutId;
  caseOption: CaseOption;
  colorway: ColorwayOption;
  /** Rendered underneath, and left visible if the 3D scene never arrives. */
  children: React.ReactNode;
}

/**
 * Progressive enhancement over the SVG board.
 *
 * Three's WebGPU build is far too heavy to sit in the critical path, so the SVG
 * paints first and this loads afterwards, cross-fading in once the scene is
 * ready. If the import fails, or no GPU adapter is available, the SVG simply
 * stays — no error state, because nothing is broken.
 */
export function HeroBoard3D({ layout, caseOption, colorway, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeroScene | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Below this the hero board is small enough that a lit 3D render buys
    // little, while costing a 230 kB chunk, a GPU context and a continuous
    // frame budget on the device least able to spare any of them. The SVG is
    // the better answer there, so the chunk is never even fetched.
    if (!window.matchMedia('(min-width: 900px)').matches) return;

    void (async () => {
      try {
        const { createHeroScene } = await import('../three/heroScene');
        if (cancelled) return;
        const scene = await createHeroScene(
          canvas,
          layout,
          caseOption,
          colorway,
          reducedMotion(),
        );
        if (cancelled) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        const rect = wrap.getBoundingClientRect();
        scene.resize(rect.width, rect.height);
        setReady(true);
      } catch {
        // No adapter, or the chunk failed. The SVG below is the product.
      }
    })();

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // Built once. Colour and size changes are pushed imperatively below, which
    // is far cheaper than tearing down a GPU context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setColors(caseOption, colorway);
  }, [caseOption, colorway]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sceneRef.current?.resize(width, height);
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Scrolling to the configurator should not leave a lit scene rendering above
  // the fold for the rest of the session.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new IntersectionObserver(
      ([entry]) => sceneRef.current?.setActive(entry.isIntersecting),
      { rootMargin: '120px' },
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion()) return;
    const onMove = (event: PointerEvent) => {
      // Normalised to roughly -1..1 across the viewport, so the board turns
      // toward the cursor like an object being inspected on a table.
      sceneRef.current?.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Drag to turn the board. Deliberately not gated on reduced motion: this is
  // direct manipulation the viewer initiated, not animation played at them.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let last: { x: number; y: number } | null = null;
    /** Where and when the gesture started, to tell a click from a drag. */
    let origin: { x: number; y: number; t: number } | null = null;

    /** Canvas-relative normalised device coords, which is what the ray wants. */
    const ndc = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };

    const onDown = (event: PointerEvent) => {
      // Only the primary button; a right-click drag is a context menu.
      if (event.button !== 0) return;
      last = { x: event.clientX, y: event.clientY };
      origin = { x: event.clientX, y: event.clientY, t: performance.now() };
      // Capture, so a fast drag that leaves the canvas keeps turning the board
      // instead of stopping dead at the edge and stranding the cursor mid-grab.
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-grabbing');
      sceneRef.current?.setDragging(true);
    };

    const onDrag = (event: PointerEvent) => {
      // Highlight whatever is under the cursor whenever we are not turning the
      // board. During a drag the pointer is travelling far and fast, and lighting
      // up every key it crosses reads as noise rather than as a hover.
      if (!last) {
        sceneRef.current?.hoverAt(ndc(event));
        return;
      }
      // Pixels to radians. Yaw is looser than pitch because there is far more
      // of the board to travel horizontally, and pitch hits its clamp quickly.
      sceneRef.current?.rotateBy(
        (event.clientX - last.x) * 0.006,
        (event.clientY - last.y) * 0.004,
      );
      last = { x: event.clientX, y: event.clientY };
    };

    const onUp = (event: PointerEvent) => {
      if (!last) return;
      last = null;
      // A click and a drag are the same gesture on the same surface, so the
      // only thing separating them is how far and how long it went. Under both
      // thresholds it was meant as a press; over either, the viewer was turning
      // the board and no key should fire.
      if (origin) {
        const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
        if (moved < 5 && performance.now() - origin.t < 400) {
          sceneRef.current?.clickAt(ndc(event));
        }
        origin = null;
      }
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.classList.remove('is-grabbing');
      sceneRef.current?.setDragging(false);
    };

    const onLeave = () => sceneRef.current?.hoverAt(null);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onDrag);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerup', onUp);
    // A cancelled pointer (system gesture, focus loss) never fires pointerup,
    // and without this the board would stay stuck in the dragging branch.
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onDrag);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="hero-board-stage" ref={wrapRef}>
      <div className={ready ? 'hero-board-svg is-replaced' : 'hero-board-svg'}>{children}</div>
      <canvas
        ref={canvasRef}
        className={ready ? 'hero-board-canvas is-ready' : 'hero-board-canvas'}
        aria-hidden="true"
      />
    </div>
  );
}
