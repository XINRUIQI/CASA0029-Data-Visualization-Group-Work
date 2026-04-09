import './Page0.css';

export default function Page0Cover() {
  return (
    <section id="page-0" className="page page-0">
      <div className="p0-hero">
        <div className="p0-hero-bg" />
        <div className="p0-hero-content">
          <div className="p0-badge">CASA0029 · Data Visualization</div>
          <h1 className="p0-title">
            <span className="p0-title-line">Where do drones</span>
            <span className="p0-title-line accent">enter the city?</span>
          </h1>
          <p className="p0-subtitle">
            Shenzhen is not imagining the future — it is already building it.<br />
            483 launch pads. 250 routes. 776,000 cargo flights in 2024.
          </p>
          <a href="#page-1" className="p0-cta">
            <span>Explore the story</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
        <div className="p0-scroll-hint">scroll</div>
      </div>
    </section>
  );
}
