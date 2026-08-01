import { useLayoutEffect, useRef, useState } from 'react';
import {
  animateExits,
  animateFlip,
  consumeLayoutFlip,
  recolorCase,
  recolorKeys,
} from '../animations/keyboard';
import { refreshScrollReveals } from '../animations/scroll';
import { CASE_OPTIONS, COLORWAYS, type CaseId, type ColorwayId } from '../data/options';
import { useConfigurator } from '../store/configurator';
import { BuildSummary } from './BuildSummary';
import { KeyboardSVG } from './KeyboardSVG';
import { OptionsPanel } from './OptionsPanel';
import { PriceBar } from './PriceBar';

export function Configurator() {
  const layout = useConfigurator((s) => s.layout);
  const caseId = useConfigurator((s) => s.case);
  const colorwayId = useConfigurator((s) => s.colorway);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const prevColorwayRef = useRef<ColorwayId | null>(null);
  const prevCaseRef = useRef<CaseId | null>(null);

  const caseOption = CASE_OPTIONS.find((c) => c.id === caseId) ?? CASE_OPTIONS[0];
  const colorway = COLORWAYS.find((c) => c.id === colorwayId) ?? COLORWAYS[0];

  useLayoutEffect(() => {
    const state = consumeLayoutFlip();
    if (state && viewerRef.current) animateFlip(state);
    if (viewerRef.current) animateExits(viewerRef.current);
    // The board's aspect ratio changed, so everything below it moved.
    refreshScrollReveals();
  }, [layout]);

  useLayoutEffect(() => {
    const previous = prevColorwayRef.current;
    prevColorwayRef.current = colorwayId;
    if (previous === null || previous === colorwayId || !viewerRef.current) return;
    const from = COLORWAYS.find((c) => c.id === previous) ?? COLORWAYS[0];
    recolorKeys(viewerRef.current, from, colorway);
    // `colorway` is a stable reference from the module-level COLORWAYS array,
    // so it changes exactly when colorwayId does — listing it is honest rather
    // than a suppression.
  }, [colorwayId, colorway]);

  useLayoutEffect(() => {
    const previous = prevCaseRef.current;
    prevCaseRef.current = caseId;
    if (previous === null || previous === caseId || !viewerRef.current) return;
    const from = CASE_OPTIONS.find((c) => c.id === previous) ?? CASE_OPTIONS[0];
    recolorCase(viewerRef.current, from.hex, caseOption.hex);
  }, [caseId, caseOption.hex]);

  return (
    <section id="configurator" className="configurator">
      <div className="container">
        <h2 className="configurator-title" data-reveal>
          Configure yours
        </h2>
        <div className="configurator-grid" data-reveal-group>
          <div className="configurator-viewer" data-reveal ref={viewerRef}>
            <KeyboardSVG layout={layout} caseOption={caseOption} colorway={colorway} />
          </div>
          <OptionsPanel />
        </div>
      </div>
      <PriceBar onReview={() => setSummaryOpen(true)} />
      <BuildSummary open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </section>
  );
}
