import { useEffect } from 'react';
import { initScrollReveals } from './animations/scroll';
import { Configurator } from './components/Configurator';
import { Hero } from './components/Hero';
import { Footer } from './components/sections/Footer';
import { Materials } from './components/sections/Materials';
import { Specs } from './components/sections/Specs';
import { SwitchFeel } from './components/sections/SwitchFeel';

export default function App() {
  // Reveals are created once the whole tree is mounted, so this stays here
  // rather than moving into the sections themselves.
  useEffect(() => initScrollReveals(), []);

  return (
    <div className="shell">
      <header className="shell-header container">
        <span className="wordmark">
          KEYFORGE<span className="wordmark-dot">.</span>
        </span>
      </header>

      <main>
        <Hero />
        <Configurator />
        <Materials />
        <SwitchFeel />
        <Specs />
        <Footer />
      </main>
    </div>
  );
}
