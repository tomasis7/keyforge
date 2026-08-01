import { SWITCH_OPTIONS } from '../../data/options';

export function SwitchFeel() {
  return (
    <section className="section section-alt" data-reveal-group>
      <div className="container">
        <h2 className="section-title" data-reveal>
          Pick your feel
        </h2>
        <div className="switches-grid">
          {SWITCH_OPTIONS.map((sw) => (
            <article key={sw.id} className="switch-card" data-reveal>
              <p className="material-label">{sw.type}</p>
              <h3 className="switch-name">{sw.name}</h3>
              <p className="switch-desc">{sw.desc}.</p>
              <p className="switch-force">{sw.force}</p>
              <p className="switch-force-label">Actuation force</p>
              <p className="switch-sound">Sound — {sw.sound}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
