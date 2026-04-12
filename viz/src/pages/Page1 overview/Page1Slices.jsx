import { useRef, useState } from 'react';

const SLICES = [
  {
    year: '2017',
    title: 'SF Express Drone',
    subtitle: 'First commercial drone delivery licence in China',
    detail:
      'SF Express obtained the first drone logistics licence from CAAC, running trial routes in Ganzhou. The concept of drone delivery moved from prototype to regulatory reality.',
    color: '#4488ff',
  },
  {
    year: '2022',
    title: 'National Strategy',
    subtitle: 'Low-altitude economy enters government agenda',
    detail:
      'Low-altitude economy was formally written into China\'s national economic strategy. Shenzhen, with its tech ecosystem and density, was positioned as the primary testbed.',
    color: '#6a5aff',
  },
  {
    year: '2023.06',
    title: 'Longhua Scale-up',
    subtitle: 'SF Fengyi: 100+ daily drone flights',
    detail:
      'SF Fengyi established a dense drone delivery network across Longhua district, achieving 100+ daily commercial flights — the first district-scale urban drone logistics operation.',
    color: '#00c878',
  },
  {
    year: '2023.12',
    title: 'First Legislation',
    subtitle: 'China\'s first low-altitude law passed',
    detail:
      'Shenzhen passed China\'s first dedicated low-altitude economy legislation, creating clear frameworks for airspace management, operator licensing, and safety requirements.',
    color: '#ff8c00',
  },
  {
    year: '2024.02',
    title: 'Regulation Active',
    subtitle: 'Shenzhen Low-Altitude Regulation takes effect',
    detail:
      'The regulation formally took effect, enabling standardized commercial drone operations across the city. 75% of Shenzhen\'s airspace below 120m was opened for commercial use.',
    color: '#ff6b6b',
  },
  {
    year: '2024.10',
    title: 'Cross-border',
    subtitle: 'First cross-border drone delivery route',
    detail:
      'Meituan launched the first normalized cross-border drone delivery route via Futian Port, connecting Shenzhen and Hong Kong logistics in under 15 minutes.',
    color: '#c864ff',
  },
  {
    year: '2024.12',
    title: 'Scale Achieved',
    subtitle: '483 pads · 250 routes · 776K flights',
    detail:
      'By end of 2024, Shenzhen had 483 launch pads, 250 active routes, and completed 776,000 cargo flights — the world\'s most advanced urban drone logistics network.',
    color: '#64c8ff',
  },
  {
    year: '2025+',
    title: 'Future Target',
    subtitle: '1,000+ routes · full airspace integration',
    detail:
      'Shenzhen targets 1,000+ drone routes with full integration into urban transport planning. Cross-border drone corridors with Hong Kong and the Greater Bay Area are in development.',
    color: '#00e896',
  },
];

export default function Page1Slices() {
  const sectionRef = useRef(null);
  const [expanded, setExpanded] = useState(null);
  const [hovered, setHovered] = useState(null);

  const handleClick = (i) => {
    setExpanded(expanded === i ? null : i);
    setHovered(null);
  };

  const isStack = expanded === null;

  return (
    <div className="p1s-section" ref={sectionRef}>
      {/* dimmed background when expanded */}
      <div className={`p1s-dim ${expanded !== null ? 'visible' : ''}`}
        onClick={() => setExpanded(null)} />

      {/* cards */}
      <div className="p1s-cascade">
        {SLICES.map((s, i) => {
          const isExpanded = expanded === i;
          const isOther = expanded !== null && !isExpanded;
          return (
            <div
              key={i}
              className={[
                'p1s-card',
                hovered === i && isStack ? 'hovered' : '',
                isExpanded ? 'expanded' : '',
                isOther ? 'dimmed' : '',
              ].join(' ')}
              style={{ '--accent': s.color, '--i': i }}
              onClick={() => handleClick(i)}
              onMouseEnter={() => isStack && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="p1s-card-visual" data-pattern={i % 4} />
              <div className="p1s-card-glow" />
              <div className="p1s-card-inner">
                <span className="p1s-card-year">{s.year}</span>
                <h3 className="p1s-card-title">{s.title}</h3>
                <p className="p1s-card-sub">{s.subtitle}</p>
              </div>
              <div className="p1s-card-index">{String(i + 1).padStart(2, '0')}</div>

              {/* detail text shown ON the card when expanded */}
              {isExpanded && (
                <div className="p1s-card-detail">
                  <p className="p1s-detail-text">{s.detail}</p>
                  <div className="p1s-detail-nav">
                    <button disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); setExpanded(i - 1); }}>
                      ← Prev
                    </button>
                    <span>{i + 1} / {SLICES.length}</span>
                    <button disabled={i === SLICES.length - 1}
                      onClick={(e) => { e.stopPropagation(); setExpanded(i + 1); }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* top-left label */}
      <div className="p1s-bottom-left">
        <span className="p1s-label-active">TIMELINE</span>
        <span className="p1s-label-link" onClick={() => {
          document.getElementById('page-2')?.scrollIntoView({ behavior: 'smooth' });
        }}>NEXT</span>
      </div>

      {/* bottom timeline nav */}
      <div className="p1s-right-nav">
        {SLICES.map((s, i) => (
          <button key={i}
            className={`p1s-nav-pill ${hovered === i || expanded === i ? 'active' : ''}`}
            style={{ '--accent': s.color }}
            onClick={() => handleClick(i)}>
            {s.year}
          </button>
        ))}
      </div>
    </div>
  );
}
