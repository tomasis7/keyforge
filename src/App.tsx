import { useEffect, useRef } from 'react';
import { heroEntrance } from './animations/hero';
import { initScrollReveals } from './animations/scroll';
import { Configurator } from './components/Configurator';
import { KeyboardSVG } from './components/KeyboardSVG';
import { Footer } from './components/sections/Footer';
import { Materials } from './components/sections/Materials';
import { Specs } from './components/sections/Specs';
import { SwitchFeel } from './components/sections/SwitchFeel';
import { CASE_OPTIONS, COLORWAYS } from './data/options';
import { useConfigurator } from './store/configurator';

export default function App() {
  const layout = useConfigurator((s) => s.layout);
  const caseId = useConfigurator((s) => s.case);
  const colorwayId = useConfigurator((s) => s.colorway);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (heroRef.current) heroEntrance(heroRef.current);
    initScrollReveals();
  }, []);

  const caseOption = CASE_OPTIONS.find((c) => c.id === caseId) ?? CASE_OPTIONS[0];
  const colorway = COLORWAYS.find((c) => c.id === colorwayId) ?? COLORWAYS[0];

  return (
    <div className="shell">
      <header className="shell-header container">
        <span className="wordmark">
          KEYFORGE<span className="wordmark-dot">.</span>
        </span>
      </header>

      <main>
        <section className="hero-lite container" ref={heroRef}>
          <p className="kicker">CUSTOM MECHANICAL KEYBOARDS</p>
          <h1 className="hero-title">
            <span className="word">
              <span className="word-inner">Build</span>
            </span>{' '}
            <span className="word">
              <span className="word-inner">your</span>
            </span>{' '}
            <span className="word">
              <span className="word-inner">endgame.</span>
            </span>
          </h1>
          <p className="hero-sub">
            Layout, case, keycaps, switches, plate and extras — tuned to your
            spec, priced live, shareable in one link.
          </p>
          <a href="#configurator" className="btn hero-cta">
            Start building
          </a>
          <div className="hero-board">
            <KeyboardSVG layout={layout} caseOption={caseOption} colorway={colorway} />
          </div>
        </section>

        <Configurator />
        <Materials />
        <SwitchFeel />
        <Specs />
        <Footer />
      </main>
    </div>
  );
}
