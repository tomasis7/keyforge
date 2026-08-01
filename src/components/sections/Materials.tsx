const MATERIALS = [
  {
    label: 'Case',
    title: 'CNC aluminum case',
    copy: 'Milled from a single billet of 6061 aluminum, then anodized in-house for a deep, even finish. Stiff enough to stay silent, heavy enough to stay planted.',
  },
  {
    label: 'Keycaps',
    title: 'PBT dye-sub keycaps',
    copy: 'Dye-sublimated PBT with a matte texture that never shines under your fingertips. Legends are printed into the plastic, so they will not wear off.',
  },
  {
    label: 'Plate',
    title: 'Gasket-mounted plate',
    copy: 'The plate floats on silicone gaskets between case and PCB. Every keystroke lands with a soft bounce, and every build is tuned for sound as much as feel.',
  },
];

export function Materials() {
  return (
    <section className="section" data-reveal-group>
      <div className="container">
        <h2 className="section-title" data-reveal>
          Built from real materials
        </h2>
        <div className="materials-grid">
          {MATERIALS.map((material) => (
            <article key={material.title} className="material-card" data-reveal>
              <p className="material-label">{material.label}</p>
              <h3 className="material-title">{material.title}</h3>
              <p className="material-copy">{material.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
