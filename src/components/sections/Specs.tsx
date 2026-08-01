import { LAYOUTS } from '../../data/layouts';
import { boardSpecs } from '../../lib/keyboard';

const SHARED_SPECS: [string, string][] = [
  ['Connectivity', 'USB-C · Bluetooth 5.1 · 2.4 GHz'],
  ['Battery', '4000 mAh'],
  ['Hot-swap', 'Yes'],
];

export function Specs() {
  // Derived from the same layout matrices the board is drawn from, so the table
  // cannot drift from what the configurator actually renders.
  const specs = LAYOUTS.map((layout) => ({ layout, ...boardSpecs(layout.id) }));

  return (
    <section className="section" data-reveal-group>
      <div className="container">
        <h2 className="section-title" data-reveal>
          The numbers
        </h2>
        <div className="specs-wrap" data-reveal>
          <table className="specs-table">
            <thead>
              <tr>
                <th scope="col">Spec</th>
                {specs.map(({ layout }) => (
                  <th scope="col" key={layout.id}>
                    {layout.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Dimensions</th>
                {specs.map(({ layout, widthMm, depthMm }) => (
                  <td key={layout.id}>
                    {widthMm} × {depthMm} mm
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Weight</th>
                {specs.map(({ layout, weightKg }) => (
                  <td key={layout.id}>{weightKg.toFixed(2)} kg</td>
                ))}
              </tr>
              {SHARED_SPECS.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td colSpan={specs.length}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
