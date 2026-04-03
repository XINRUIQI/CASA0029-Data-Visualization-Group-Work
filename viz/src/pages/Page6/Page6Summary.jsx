import './Page6Summary.css';

export default function Page6Summary() {
  return (
    <section id="page-6" className="page page-summary">
      <div className="summary-container">
        <h1>What have we learned?</h1>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="card-number">490K+</div>
            <div className="card-label">POI delivery destinations</div>
          </div>
          <div className="summary-card">
            <div className="card-number">1.5x</div>
            <div className="card-label">Average ground detour ratio</div>
          </div>
          <div className="summary-card">
            <div className="card-number">1.8x</div>
            <div className="card-label">Peak congestion amplifier</div>
          </div>
          <div className="summary-card">
            <div className="card-number">93%</div>
            <div className="card-label">OD pairs cross water barriers</div>
          </div>
        </div>

        <div className="summary-text">
          <p>
            Shenzhen's dense urban fabric, fragmented by water, railways, and expressways,
            creates systematic ground delivery friction. Drone logistics can bypass these
            barriers entirely — flying straight where vehicles must detour.
          </p>
          <p>
            With strategic placement of just 10 launch pads, drone coverage can reach
            a significant portion of the city's delivery demand. This is not a future
            vision — Shenzhen is already building it.
          </p>
        </div>

        <div className="summary-footer">
          <p>CASA0029 Data Visualization — Group Work</p>
          <p>University College London, 2026</p>
        </div>
      </div>
    </section>
  );
}
