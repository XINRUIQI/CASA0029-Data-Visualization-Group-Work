import { useRef, useEffect, useState } from 'react';

function ParticleBg() {
  const cvs = useRef(null);
  useEffect(() => {
    const canvas = cvs.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let pts = [];

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const N = Math.floor((canvas.width * canvas.height) / 5000);
      pts = Array.from({ length: N }, () => ({
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r:  Math.random() * 1.8 + 0.6,
        a:  Math.random() * 0.55 + 0.25,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const LINK_DIST = 90;
    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(200,200,210,${(1 - d / LINK_DIST) * 0.14})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,205,215,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas ref={cvs} style={{
      position: 'absolute', inset: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0,
    }} />
  );
}

const CONGESTION_TOP10 = [
  { name: 'Shangbu Road',          hours: 21,    increase: '+4%'   },
  { name: 'Yantian Road',          hours: 19,    increase: null    },
  { name: 'Binhai Avenue',         hours: 15.75, increase: '+9%'   },
  { name: 'Longgang Avenue',       hours: 11.25, increase: '+121%' },
  { name: 'Meiguan Road',          hours: 7.5,   increase: '+114%' },
  { name: 'Caitian Road',          hours: 7.5,   increase: '+107%' },
  { name: 'Fulong Road',           hours: 6.5,   increase: '+30%'  },
  { name: 'Xinzhou Road',          hours: 6.5,   increase: '+160%' },
  { name: 'Liuxian Avenue',        hours: 6.25,  increase: '+113%' },
  { name: 'Xinzhou Rd (segment)',  hours: 6.25,  increase: null    },
];

function CongestionLollipop() {
  const W = 480, H = 300;
  const mL = 148, mR = 56, mT = 14, mB = 28;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const maxVal = 23;
  const rowH = plotH / CONGESTION_TOP10.length;
  const xS = v => (v / maxVal) * plotW;
  const yS = i => mT + (i + 0.5) * rowH;
  const ticks = [0, 5, 10, 15, 20];

  return (
    <div className="p1s-chart">
      <p className="p1s-chart-label">TOP CONGESTED CORRIDORS · DAILY HOURS</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* grid lines + x labels */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={mL + xS(t)} y1={mT} x2={mL + xS(t)} y2={mT + plotH}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={mL + xS(t)} y={mT + plotH + 18}
              textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize={9.5}>{t}h</text>
          </g>
        ))}

        {CONGESTION_TOP10.map((d, i) => {
          const y   = yS(i);
          const x   = mL + xS(d.hours);
          // RdYlBu: top 3 red, mid 4 orange-yellow, rest blue
          const col = i < 3 ? '#D73027' : i < 6 ? '#FC8D59' : '#91BFDB';
          const bright = i < 3;
          return (
            <g key={d.name}>
              <text x={mL - 10} y={y + 4} textAnchor="end"
                fill={bright ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.32)'}
                fontSize={10} fontWeight={bright ? 600 : 400}>{d.name}</text>
              <line x1={mL} y1={y} x2={x} y2={y}
                stroke={col} strokeWidth={bright ? 1.5 : 1} opacity={bright ? 0.85 : 0.5} />
              <circle cx={x} cy={y} r={bright ? 5 : 3.5} fill={col} opacity={bright ? 1 : 0.65} />
              <text x={x + 9} y={y + 4}
                fill={bright ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)'}
                fontSize={9.5} fontWeight={bright ? 600 : 400}>{d.hours}h</text>
              {d.increase && (
                <text x={x + 9} y={y + 16}
                  fill="#FC8D59" fontSize={8.5} opacity={0.75}>{d.increase}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Pilot stat highlights ──────────────────────────────────────
function PilotStats() {
  const stats = [
    { value: '23',   unit: 'routes',    label: 'Meituan drone delivery routes' },
    { value: '77',   unit: 'new',       label: 'Routes launched in 2023' },
    { value: '156',  unit: 'total',     label: 'Cumulative operational routes' },
    { value: '600K+', unit: 'flights',  label: 'Cargo drone flights completed' },
  ];
  return (
    <div className="p1s-pilot-stats">
      {stats.map(s => (
        <div key={s.value} className="p1s-pilot-stat">
          <span className="p1s-pilot-val">{s.value}</span>
          <span className="p1s-pilot-unit">{s.unit}</span>
          <span className="p1s-pilot-lbl">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── 2024 monthly data ──────────────────────────────────────────
const SCALING_DATA = [
  { month: '1',  routes: 22, flights: 4.29  },
  { month: '2',  routes: 9,  flights: 2.94  },
  { month: '3',  routes: 11, flights: 3.99  },
  { month: '4',  routes: 7,  flights: 4.16  },
  { month: '5',  routes: 1,  flights: 4.56  },
  { month: '6',  routes: 1,  flights: 4.45  },
  { month: '7',  routes: 4,  flights: 5.15  },
  { month: '8',  routes: 1,  flights: 4.97  },
  { month: '9',  routes: 4,  flights: 8.72  },
  { month: '10', routes: 21, flights: 10.33 },
  { month: '11', routes: 13, flights: 9.11  },
  { month: '12', routes: 7,  flights: 13.22 },
];

function ScalingChart() {
  const W = 480, H = 220;
  const mL = 36, mR = 40, mT = 20, mB = 36;
  const plotW = W - mL - mR, plotH = H - mT - mB;

  const maxR = 25, maxF = 15;
  const slot = plotW / SCALING_DATA.length;
  const barW = slot * 0.45;

  const xS  = i  => mL + (i + 0.5) * slot;
  const ryS = v  => mT + plotH - (v / maxR) * plotH;
  const fyS = v  => mT + plotH - (v / maxF) * plotH;

  const rTicks = [0, 10, 20];
  const fTicks = [0, 5, 10, 15];

  return (
    <div className="p1s-chart">
      <p className="p1s-chart-label">2024 MONTHLY · NEW ROUTES vs FLIGHTS (×10K)</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>

        {/* grid */}
        {fTicks.map(t => (
          <line key={t} x1={mL} y1={fyS(t)} x2={mL + plotW} y2={fyS(t)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}

        {/* left Y (routes) */}
        {rTicks.map(t => (
          <text key={t} x={mL - 5} y={ryS(t) + 4}
            textAnchor="end" fill="rgba(255,255,255,0.75)" fontSize={9}>{t}</text>
        ))}
        <text x={10} y={mT + plotH / 2} textAnchor="middle"
          fill="rgba(255,255,255,0.75)" fontSize={8.5}
          transform={`rotate(-90,10,${mT + plotH / 2})`}>routes</text>

        {/* right Y (flights) */}
        {fTicks.map(t => (
          <text key={t} x={mL + plotW + 5} y={fyS(t) + 4}
            textAnchor="start" fill="rgba(255,255,255,0.75)" fontSize={9}>{t}</text>
        ))}
        <text x={W - 9} y={mT + plotH / 2} textAnchor="middle"
          fill="rgba(255,255,255,0.75)" fontSize={8.5}
          transform={`rotate(90,${W - 9},${mT + plotH / 2})`}>×10K</text>

        {/* bars — new routes */}
        {SCALING_DATA.map((d, i) => {
          const x = xS(i) - barW / 2;
          const h = (d.routes / maxR) * plotH;
          const y = mT + plotH - h;
          return (
            <rect key={i} x={x} y={y} width={barW} height={h}
              fill="#4575B4" opacity={0.65} rx={2} />
          );
        })}

        {/* line — flights */}
        <polyline
          points={SCALING_DATA.map((d, i) => `${xS(i)},${fyS(d.flights)}`).join(' ')}
          fill="none" stroke="#FC8D59" strokeWidth={1.8} opacity={0.85} strokeLinejoin="round" />
        {SCALING_DATA.map((d, i) => (
          <circle key={i} cx={xS(i)} cy={fyS(d.flights)} r={2.8}
            fill="#FC8D59" opacity={0.9} />
        ))}

        {/* x labels */}
        {SCALING_DATA.map((d, i) => (
          <text key={i} x={xS(i)} y={mT + plotH + 16}
            textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={9}>{d.month}</text>
        ))}

        {/* baseline */}
        <line x1={mL} y1={mT + plotH} x2={mL + plotW} y2={mT + plotH}
          stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      </svg>
      <div className="p1s-chart-legend">
        <span><span className="p1s-legend-box" style={{ background: '#4575B4' }} />New routes</span>
        <span><span className="p1s-legend-line" style={{ background: '#FC8D59' }} />Monthly flights (×10K)</span>
      </div>
    </div>
  );
}

// RdYlBu palette — warm (urgency) → cool (progress)
const PALETTE = ['#D73027', '#FC8D59', '#FEE090', '#E0F3F8', '#91BFDB', '#4575B4'];

const SLICES = [
  {
    year: '',
    title: 'Need for UAM',
    subtitle: 'Analysis of the Need for UAM as a Mitigation Measure',
    detail:
      'Major roads in Shenzhen average 5.7 hours of daily congestion. The most severely affected corridors are Shangbu Road (21 h), Yantian Road (19 h), and Binhai Avenue (15.75 h). By flying above ground-level traffic, UAM can effectively bypass these bottlenecks and significantly reduce journey times across the city.',
    color: PALETTE[0],   // #D73027 red — problem / urgency
    num: '01',
  },
  {
    year: '2023',
    title: 'From Ground Mobility to Aerial Possibility',
    subtitle: 'eVTOL developers establish a foothold in Shenzhen',
    detail:
      'Lilium, a German eVTOL manufacturer, announced its China headquarters in Shenzhen. Domestic firms — EHang (Guangzhou), Fengfei (Shanghai), and Shiji Technology — also entered Shenzhen to develop flight routes, marking the city\'s emergence as China\'s primary eVTOL hub.',
    color: PALETTE[1],
    num: '02',
  },
  {
    year: '2023',
    title: 'From Experiment to Real-world Testing',
    subtitle: 'Meituan pilots drone food delivery at city scale',
    detail:
      'Internet platform Meituan established 23 drone food delivery routes in Shenzhen. According to the Shenzhen Municipal Transport Bureau, 77 new drone routes were launched in 2023, bringing the total to 156 operational routes, with cargo drones completing over 600,000 flights.',
    color: PALETTE[2],
    num: '03',
  },
  {
    year: '2024',
    title: 'Scaling Drone Delivery in Shenzhen',
    subtitle: '776K flights · 101 new routes · +27% year-on-year',
    detail:
      'Low-altitude activity surged across Shenzhen in 2024. Helicopter operations reached 28,000 flights carrying 136,800 passengers, expanding into medical rescue, business travel, and cross-border transport. Unmanned cargo flights hit 776,000 — up 27% year-on-year — spanning express delivery, on-demand consumer logistics, and medical services.',
    color: PALETTE[3],
    num: '04',
  },
  {
    year: '2025+',
    title: 'Institutionalisation & the Low-altitude Economy',
    subtitle: 'Shenzhen — world\'s leading city for the low-altitude economy',
    detail:
      'The Shenzhen Municipal Government is committed to building the "world\'s leading city for the low-altitude economy", leveraging urban planning to deliver the Four Centres: Global Headquarters & R&D, High-End Intelligent Manufacturing, All-Scenario Demonstration, and One-Stop Solution Provision.',
    color: PALETTE[5],
    num: '05',
  },
];

export default function Page1Slices() {
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef([]);

  // track active card by finding whose center is closest to viewport center
  useEffect(() => {
    const onScroll = () => {
      const center = window.scrollY + window.innerHeight * 0.5;
      let best = 0, bestDist = Infinity;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const cardCenter = top + el.offsetHeight / 2;
        const dist = Math.abs(center - cardCenter);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      setActiveIdx(best);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToCard = (i) => {
    cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const active = SLICES[activeIdx];

  return (
    <div className="p1s-wrap">
      <div className="p1s-layout">

        {/* ── LEFT sticky panel ── */}
        <div className="p1s-left" style={{ '--accent': active.color }}>
          <ParticleBg />
          <div className="p1s-left-glow" />
          <div className="p1s-left-bignum">{active.num}</div>

          {/* header row */}
          <div className="p1s-hdr">
            <span className="p1s-lbl">TIMELINE</span>
            <span className="p1s-lbl-next"
              onClick={() => document.getElementById('page-2')?.scrollIntoView({ behavior: 'smooth' })}>
              NEXT
            </span>
          </div>

          {/* current card info */}
          <div className="p1s-info">
            <h2 className="p1s-info-title">{active.title}</h2>
            <p className="p1s-info-sub">{active.subtitle}</p>
          </div>

          {/* dot spine */}
          <div className="p1s-spine">
            <div className="p1s-spine-track" />
            {SLICES.map((s, i) => (
              <button
                key={i}
                className={`p1s-dot ${i === activeIdx ? 'active' : ''} ${i < activeIdx ? 'past' : ''}`}
                style={{ '--c': s.color }}
                onClick={() => scrollToCard(i)}
                title={s.title}
              >
                <span className="p1s-dot-pip" />
                <span className="p1s-dot-yr">{s.num}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT scrollable cards ── */}
        <div className="p1s-right">
          {SLICES.map((s, i) => (
            <div
              key={i}
              ref={el => { cardRefs.current[i] = el; }}
              className={`p1s-card ${i === activeIdx ? 'active' : ''}`}
              style={{ '--accent': s.color }}
            >
              <div className="p1s-card-bg" data-pattern={i % 4} />
              <div className="p1s-card-body">
                <div className="p1s-card-meta">
                  <span className="p1s-card-num">{s.num}</span>
                </div>
                <h3 className="p1s-card-title">{s.title}</h3>
                <p className="p1s-card-sub">{s.subtitle}</p>
                <p className="p1s-card-detail">{s.detail}</p>
                {i === 0 && <CongestionLollipop />}
                {i === 1 && (
                  <div className="p1s-card-img-wrap">
                    <img src={`${import.meta.env.BASE_URL}images/evtol-pad.png`} alt="eVTOL on landing pad" className="p1s-card-img" />
                  </div>
                )}
                {i === 2 && <PilotStats />}
                {i === 3 && <ScalingChart />}
                {i === 4 && (
                  <div className="p1s-card-img-wrap">
                    <img src={`${import.meta.env.BASE_URL}images/future.png`} alt="Low-altitude economy future" className="p1s-card-img" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
