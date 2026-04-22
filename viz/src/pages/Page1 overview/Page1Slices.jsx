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
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H;
        if (p.y > H) p.y -= H;
      }

      // draw links
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.14;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(200,200,210,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // draw dots
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

const SLICES = [
  {
    year: '',
    title: 'Need for UAM',
    subtitle: 'Analysis of the Need for UAM as a Mitigation Measure',
    detail:
      'As a rapidly urbanising region, Shenzhen suffers from severe traffic congestion, with the average journey time on major roads standing at xx minutes. The roads with the highest levels of congestion are xxx, xxx and xxx. As a solution to this problem, UAM can effectively bypass ground-level congestion and significantly reduce journey times.',
    color: '#4488ff',
    num: '01',
  },
  {
    year: '2023',
    title: 'From Ground Mobility to Aerial Possibility',
    subtitle: 'eVTOL developers establish a foothold in Shenzhen',
    detail:
      'Lilium, a German developer and manufacturer of eVTOLs (electric vertical take-off and landing aircraft), has announced the establishment of its China headquarters in Shenzhen. Domestic eVTOL firms such as EHang in Guangzhou, Fengfei in Shanghai and Shiji Technology have also announced their entry into Shenzhen to develop flight routes.',
    color: '#6a5aff',
    num: '02',
  },
  {
    year: '2023.06',
    title: 'Longhua Scale-up',
    subtitle: 'SF Fengyi: 100+ daily drone flights',
    detail:
      'SF Fengyi established a dense drone delivery network across Longhua district, achieving 100+ daily commercial flights — the first district-scale urban drone logistics operation.',
    color: '#00c878',
    num: '03',
  },
  {
    year: '2023.12',
    title: 'First Legislation',
    subtitle: 'China\'s first low-altitude law passed',
    detail:
      'Shenzhen passed China\'s first dedicated low-altitude economy legislation, creating clear frameworks for airspace management, operator licensing, and safety requirements.',
    color: '#ff8c00',
    num: '04',
  },
  {
    year: '2024.02',
    title: 'Regulation Active',
    subtitle: 'Shenzhen Low-Altitude Regulation takes effect',
    detail:
      'The regulation formally took effect, enabling standardized commercial drone operations across the city. 75% of Shenzhen\'s airspace below 120m was opened for commercial use.',
    color: '#ff6b6b',
    num: '05',
  },
  {
    year: '2024.10',
    title: 'Cross-border',
    subtitle: 'First cross-border drone delivery route',
    detail:
      'Meituan launched the first normalized cross-border drone delivery route via Futian Port, connecting Shenzhen and Hong Kong logistics in under 15 minutes.',
    color: '#c864ff',
    num: '06',
  },
  {
    year: '2024.12',
    title: 'Scale Achieved',
    subtitle: '483 pads · 250 routes · 776K flights',
    detail:
      'By end of 2024, Shenzhen had 483 launch pads, 250 active routes, and completed 776,000 cargo flights — the world\'s most advanced urban drone logistics network.',
    color: '#64c8ff',
    num: '07',
  },
  {
    year: '2025+',
    title: 'Future Target',
    subtitle: '1,000+ routes · full airspace integration',
    detail:
      'Shenzhen targets 1,000+ drone routes with full integration into urban transport planning. Cross-border drone corridors with Hong Kong and the Greater Bay Area are in development.',
    color: '#00e896',
    num: '08',
  },
];

const CARD_W      = 420;
const MAX_INERTIA = 60; // px/frame hard cap for inertia
const ONE_LOOP    = SLICES.length * CARD_W;

export default function Page1Slices() {
  const viewportRef = useRef(null);
  const stripRef    = useRef(null);
  const scrollRef   = useRef(0);
  const rafRef      = useRef(null);
  const pausedRef   = useRef(false);

  // drag state
  const draggingRef   = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const dragMovedRef  = useRef(false);
  const lastXRef      = useRef(0);
  const lastTRef      = useRef(0);
  const velocityRef   = useRef(0); // px / frame, used after release for inertia

  const [expanded, setExpanded]   = useState(null);

  useEffect(() => {
    const animate = () => {
      if (!pausedRef.current) {
        if (!draggingRef.current && Math.abs(velocityRef.current) > 0.2) {
          // inertia decay after drag release
          scrollRef.current += velocityRef.current;
          velocityRef.current *= 0.92;
        } else if (!draggingRef.current) {
          velocityRef.current = 0;
        }
        // wrap (supports negative for reverse drag)
        scrollRef.current = ((scrollRef.current % ONE_LOOP) + ONE_LOOP) % ONE_LOOP;

        if (stripRef.current) {
          stripRef.current.style.transform =
            `translate3d(${-scrollRef.current}px, 0, 0)`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    pausedRef.current = expanded !== null;
  }, [expanded]);

  // ── drag-to-scroll handlers ─────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const DRAG_THRESHOLD = 5; // px

    // We deliberately do NOT call setPointerCapture on pointerdown, because
    // that would re-target the subsequent pointerup (and thus the click) to
    // the viewport and prevent individual cards from receiving click events.
    // Instead, we track movement on window-level listeners and only mark the
    // gesture as a real drag once the threshold is crossed.

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (pausedRef.current) return; // don't drag while a card is expanded

      draggingRef.current   = true;
      dragMovedRef.current  = false;
      dragStartXRef.current = e.clientX;
      dragStartScrollRef.current = scrollRef.current;
      lastXRef.current = e.clientX;
      lastTRef.current = performance.now();
      velocityRef.current = 0;

      window.addEventListener('pointermove',   onPointerMove);
      window.addEventListener('pointerup',     endDrag);
      window.addEventListener('pointercancel', endDrag);
    };

    const onPointerMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;

      if (!dragMovedRef.current) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return; // still a pending click
        dragMovedRef.current = true;
        el.classList.add('dragging');
      }

      let next = dragStartScrollRef.current - dx;
      next = ((next % ONE_LOOP) + ONE_LOOP) % ONE_LOOP;
      scrollRef.current = next;

      const now = performance.now();
      const dt  = Math.max(1, now - lastTRef.current);
      // px per ~16ms frame, pointing in scroll direction (opposite of drag)
      velocityRef.current = -((e.clientX - lastXRef.current) / dt) * 16;
      lastXRef.current = e.clientX;
      lastTRef.current = now;
    };

    const endDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      el.classList.remove('dragging');

      // clamp inertia
      const v = velocityRef.current;
      if (v >  MAX_INERTIA) velocityRef.current =  MAX_INERTIA;
      if (v < -MAX_INERTIA) velocityRef.current = -MAX_INERTIA;

      window.removeEventListener('pointermove',   onPointerMove);
      window.removeEventListener('pointerup',     endDrag);
      window.removeEventListener('pointercancel', endDrag);

      // Clear moved flag on the next frame so the synthetic click that
      // follows pointerup can be correctly suppressed (for drag) or allowed
      // (for a tap, where dragMovedRef is already false).
      if (dragMovedRef.current) {
        // keep dragMovedRef = true through the click phase, then reset
        setTimeout(() => { dragMovedRef.current = false; }, 0);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove',   onPointerMove);
      window.removeEventListener('pointerup',     endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  const STRIP = [...SLICES, ...SLICES];

  return (
    <div className="p1h-section">

      {/* ── background canvas ── */}
      <ParticleBg />

      {/* ── top label row ── */}
      <div className="p1h-top-left">
        <span className="p1h-label">TIMELINE</span>
        <span className="p1h-label-next"
          onClick={() => document.getElementById('page-2')?.scrollIntoView({ behavior: 'smooth' })}>
          NEXT
        </span>
      </div>

      {/* ── scrolling viewport ── */}
      <div className="p1h-viewport" ref={viewportRef}>
      <div className="p1h-strip" ref={stripRef}>
        {STRIP.map((s, idx) => {
          const realIdx = idx % SLICES.length;
          const isExp   = expanded === realIdx;
          return (
            <div
              key={idx}
              className={`p1h-card ${isExp ? 'expanded' : ''}`}
              style={{ '--accent': s.color, width: CARD_W + 'px' }}
              onClick={() => {
                if (dragMovedRef.current) return; // suppress click after drag
                setExpanded(isExp ? null : realIdx);
              }}
            >
              {/* background pattern */}
              <div className="p1h-card-bg" data-pattern={realIdx % 4} />

              {/* accent glow at bottom */}
              <div className="p1h-card-glow" />

              {/* big faded number */}
              <div className="p1h-card-num">{s.num}</div>

              {/* content */}
              <div className="p1h-card-body">
                {s.year && <span className="p1h-year">{s.year}</span>}
                <h3 className="p1h-title">{s.title}</h3>
                <p className="p1h-sub">{s.subtitle}</p>
                <div className="p1h-arrow">↗</div>
              </div>

              {/* expanded detail overlay */}
              {isExp && (
                <div className="p1h-detail" onClick={e => e.stopPropagation()}>
                  {s.year && <span className="p1h-detail-year">{s.year}</span>}
                  <h3 className="p1h-detail-title">{s.title}</h3>
                  <p className="p1h-detail-text">{s.detail}</p>
                  <div className="p1h-detail-nav">
                    <button
                      disabled={realIdx === 0}
                      onClick={() => setExpanded(realIdx - 1)}
                    >← Prev</button>
                    <span>{realIdx + 1} / {SLICES.length}</span>
                    <button
                      disabled={realIdx === SLICES.length - 1}
                      onClick={() => setExpanded(realIdx + 1)}
                    >Next →</button>
                  </div>
                  <button className="p1h-close" onClick={() => setExpanded(null)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>{/* end viewport */}

      <div className="p1h-bottom-hint">
        <span>← DRAG TO SCROLL · CLICK A CARD FOR DETAILS →</span>
      </div>

    </div>
  );
}
