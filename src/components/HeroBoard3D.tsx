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
