import { useEffect, useRef } from 'react';
import { heroEntrance } from '../animations/hero';
import { CASE_OPTIONS, COLORWAYS } from '../data/options';
import { useConfigurator } from '../store/configurator';
import { HeroBoard3D } from './HeroBoard3D';
import { KeyboardSVG } from './KeyboardSVG';

export function Hero() {
  const layout = useConfigurator((s) => s.layout);
  const caseId = useConfigurator((s) => s.case);
  const colorwayId = useConfigurator((s) => s.colorway);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (rootRef.current) heroEntrance(rootRef.current);
  }, []);

  const caseOption = CASE_OPTIONS.find((c) => c.id === caseId) ?? CASE_OPTIONS[0];
  const colorway = COLORWAYS.find((c) => c.id === colorwayId) ?? COLORWAYS[0];

  return (
    <section className="hero-lite container" ref={rootRef}>
      <p className="kicker">CUSTOM MECHANICAL KEYBOARDS</p>
      <h1 className="hero-title">
        <span className="word">
          <span className="word-inner">Build</span>
        </span>{' '}
        <span className="word">
          <span className="word-inner">your</span>
        </span>{' '}
        <span className="word">
          <span className="word-inner">
            endgame<span className="accent-dot">.</span>
          </span>
        </span>
      </h1>
      <p className="hero-sub">
        Layout, case, keycaps, switches, plate and extras — tuned to your spec,
        priced live, shareable in one link.
      </p>
      <a href="#configurator" className="btn hero-cta">
        Start building
      </a>
      <div className="hero-board">
        <HeroBoard3D layout={layout} caseOption={caseOption} colorway={colorway}>
          <KeyboardSVG layout={layout} caseOption={caseOption} colorway={colorway} />
        </HeroBoard3D>
      </div>
    </section>
  );
}
