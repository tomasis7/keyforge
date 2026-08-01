export function Specs() {
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
                <th scope="col">65%</th>
                <th scope="col">75%</th>
                <th scope="col">TKL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Dimensions</th>
                <td>322 × 124 mm</td>
                <td>368 × 142 mm</td>
                <td>368 × 134 mm</td>
              </tr>
              <tr>
                <th scope="row">Weight</th>
                <td colSpan={3}>1.6 kg CNC aluminum</td>
              </tr>
              <tr>
                <th scope="row">Connectivity</th>
                <td colSpan={3}>USB-C · Bluetooth 5.1 · 2.4 GHz</td>
              </tr>
              <tr>
                <th scope="row">Battery</th>
                <td colSpan={3}>4000 mAh</td>
              </tr>
              <tr>
                <th scope="row">Hot-swap</th>
                <td colSpan={3}>Yes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
