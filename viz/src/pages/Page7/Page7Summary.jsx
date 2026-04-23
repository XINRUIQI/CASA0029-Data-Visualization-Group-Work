import './Page7Summary.css';

export default function Page7Summary() {
  return (
    <section id="page-7" className="page page-summary">
      <div className="summary-container">
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

        <div className="summary-block">
          <h2>Limitations</h2>
          <p>
            Our analysis is constrained by the temporal and spatial scope of the available
            datasets: takeout demand is sampled from a single operator over a limited window,
            and ground friction is approximated using shortest-path detour ratios rather than
            observed travel times. Candidate launch pads are evaluated under simplified
            assumptions — uniform flight range, no airspace restrictions, and static demand —
            which inevitably abstract away weather, regulation, noise, and the vertical
            complexity of Shenzhen's high-rise environment.
          </p>
        </div>

        <div className="summary-block">
          <h2>Outlook</h2>
          <p>
            As low-altitude economy policy matures and urban air mobility infrastructure
            expands, drone logistics is moving from pilot demonstrations toward city-scale
            deployment. Future work should integrate real-time airspace data, multi-operator
            demand, and dynamic dispatch modelling to refine launch-pad siting. Coupling
            ground and aerial networks — rather than replacing one with the other — offers
            the most realistic path toward a resilient, low-friction last-mile system for
            dense Chinese megacities.
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
