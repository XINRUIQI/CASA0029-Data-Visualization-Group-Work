import { useState, useEffect, useRef, useCallback } from 'react';
import './Page7Summary.css';

/* ═══ Animated Number Counter ═══ */
function AnimatedNumber({ value, suffix = '', prefix = '', duration = 2000, decimals = 0 }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef(null);
  const animated = useRef(false);

  const animate = useCallback(() => {
    if (animated.current) return;
    animated.current = true;

    const start = performance.now();
    const numValue = parseFloat(value);

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numValue * eased;

      if (decimals > 0) {
        setDisplay(current.toFixed(decimals));
      } else {
        setDisplay(Math.round(current).toLocaleString());
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [value, duration, decimals]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate();
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate]);

  return (
    <span ref={ref} className="animated-number">
      {prefix}{display}{suffix}
    </span>
  );
}

/* ═══ Scroll-triggered fade-in hook ═══ */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, visible];
}

/* ═══ Stats Data ═══ */
const STATS = [
  { value: 490, suffix: 'K+', label: 'POI delivery destinations', decimals: 0 },
  { value: 1.5, suffix: 'x', label: 'Average ground detour ratio', decimals: 1 },
  { value: 1.8, suffix: 'x', label: 'Peak congestion amplifier', decimals: 1 },
  { value: 93, suffix: '%', label: 'OD pairs cross water barriers', decimals: 0 },
];

/* ═══ Ground vs Drone comparison ═══ */
const COMPARISONS = [
  {
    ground: { icon: '↪', label: 'Detour ratio 1.5x', bar: 85 },
    drone:  { icon: '→', label: 'Straight-line flight', bar: 30 },
  },
  {
    ground: { icon: '⊘', label: 'Barrier crossings (water, rail, highway)', bar: 90 },
    drone:  { icon: '↑', label: 'Barrier-free air corridor', bar: 10 },
  },
  {
    ground: { icon: '◎', label: 'Peak congestion 1.8x delay', bar: 75 },
    drone:  { icon: '◇', label: 'Unaffected by traffic', bar: 15 },
  },
  {
    ground: { icon: '═', label: 'Constrained by road network', bar: 80 },
    drone:  { icon: '◎', label: '3 km radius coverage per pad', bar: 20 },
  },
];

/* ═══ Limitation Cards ═══ */
const LIMITATIONS = [
  {
    icon: '⏱',
    title: 'Data Scope',
    desc: 'Takeout demand sampled from a single operator over a limited temporal window; spatial coverage is incomplete.',
  },
  {
    icon: '📊',
    title: 'Demand Proxy',
    desc: 'Food delivery orders used as a proxy for total last-mile demand — other parcel types not captured.',
  },
  {
    icon: '⚙',
    title: 'Simplified Model',
    desc: 'Uniform 3 km flight range, no airspace restrictions, and static demand assumptions abstract away real operational constraints.',
  },
  {
    icon: '🌦',
    title: 'External Factors',
    desc: 'Weather variability, noise regulations, battery degradation, and evolving UAM policy are not modelled.',
  },
  {
    icon: '🏙',
    title: 'Vertical Complexity',
    desc: 'Shenzhen\'s high-rise environment creates vertical last-metre challenges not addressed by horizontal coverage analysis.',
  },
];

/* ═══ Roadmap Timeline ═══ */
const ROADMAP = [
  {
    phase: 'Now',
    title: 'Pilot Demonstrations',
    desc: 'Meituan & SF Express operating drone deliveries in designated Shenzhen corridors since 2023.',
  },
  {
    phase: 'Near',
    title: 'Real-time Airspace Integration',
    desc: 'Connect drone routing with live UTM (Unmanned Traffic Management) and CAAC low-altitude data.',
  },
  {
    phase: 'Mid',
    title: 'Multi-operator Demand Modeling',
    desc: 'Aggregate cross-platform delivery demand for dynamic dispatch and multi-modal optimization.',
  },
  {
    phase: 'Long',
    title: 'Ground-Aerial Coupled Network',
    desc: 'Hybrid logistics where drones handle high-friction segments and ground vehicles cover dense corridors.',
  },
  {
    phase: 'Vision',
    title: 'Resilient Last-Mile System',
    desc: 'A fully integrated, low-friction urban delivery network adaptive to weather, demand spikes, and regulation.',
  },
];

export default function Page7Summary() {
  const [heroRef, heroVisible] = useReveal(0.2);
  const [compRef, compVisible] = useReveal(0.15);
  const [limRef, limVisible] = useReveal(0.1);
  const [roadRef, roadVisible] = useReveal(0.1);

  return (
    <section id="page-8" className="page page-summary">
      {/* ═══ HERO — Stats ═══ */}
      <div className={`s8-hero ${heroVisible ? 'revealed' : ''}`} ref={heroRef}>
        <h1 className="s8-title">Conclusion</h1>
        <p className="s8-subtitle">
          From barrier mapping to drone strategy — key takeaways from our analysis of
          Shenzhen's last-mile delivery friction.
        </p>
        <div className="s8-stats-grid">
          {STATS.map((s, i) => (
            <div className="s8-stat-card" key={i} style={{ '--delay': `${i * 0.12}s` }}>
              <div className="s8-stat-number">
                <AnimatedNumber
                  value={s.value}
                  suffix={s.suffix}
                  decimals={s.decimals}
                  duration={1800 + i * 200}
                />
              </div>
              <div className="s8-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Summary Text ═══ */}
      <div className="s8-summary-text">
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

      {/* ═══ Ground vs Drone ═══ */}
      <div className={`s8-comparison ${compVisible ? 'revealed' : ''}`} ref={compRef}>
        <h2 className="s8-section-title">Ground vs Drone Delivery</h2>
        <div className="s8-comp-table">
          <div className="s8-comp-header">
            <span className="s8-comp-h ground">Ground Delivery</span>
            <span className="s8-comp-vs">VS</span>
            <span className="s8-comp-h drone">Drone Delivery</span>
          </div>
          {COMPARISONS.map((row, i) => (
            <div className="s8-comp-row" key={i} style={{ '--delay': `${i * 0.1}s` }}>
              <div className="s8-comp-cell ground">
                <span className="s8-comp-icon">{row.ground.icon}</span>
                <span className="s8-comp-text">{row.ground.label}</span>
                <div className="s8-comp-bar">
                  <div
                    className="s8-comp-bar-fill ground"
                    style={{ '--bar-width': `${row.ground.bar}%` }}
                  />
                </div>
              </div>
              <div className="s8-comp-divider" />
              <div className="s8-comp-cell drone">
                <span className="s8-comp-icon">{row.drone.icon}</span>
                <span className="s8-comp-text">{row.drone.label}</span>
                <div className="s8-comp-bar">
                  <div
                    className="s8-comp-bar-fill drone"
                    style={{ '--bar-width': `${row.drone.bar}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Limitations ═══ */}
      <div className={`s8-limitations ${limVisible ? 'revealed' : ''}`} ref={limRef}>
        <h2 className="s8-section-title">Limitations</h2>
        <div className="s8-lim-grid">
          {LIMITATIONS.map((lim, i) => (
            <div className="s8-lim-card" key={i} style={{ '--delay': `${i * 0.08}s` }}>
              <div className="s8-lim-icon">{lim.icon}</div>
              <h3 className="s8-lim-title">{lim.title}</h3>
              <p className="s8-lim-desc">{lim.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Roadmap ═══ */}
      <div className={`s8-roadmap ${roadVisible ? 'revealed' : ''}`} ref={roadRef}>
        <h2 className="s8-section-title">Future Outlook</h2>
        <div className="s8-timeline">
          {ROADMAP.map((node, i) => (
            <div className="s8-tl-node" key={i} style={{ '--delay': `${i * 0.15}s` }}>
              <div className="s8-tl-line">
                <div className="s8-tl-dot" />
                {i < ROADMAP.length - 1 && <div className="s8-tl-connector" />}
              </div>
              <div className="s8-tl-content">
                <span className="s8-tl-phase">{node.phase}</span>
                <h3 className="s8-tl-title">{node.title}</h3>
                <p className="s8-tl-desc">{node.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <div className="s8-footer">
        <p>CASA0029 Data Visualization — Group Work</p>
        <p>University College London, 2025</p>
      </div>
    </section>
  );
}
