import { useEffect, useRef, useMemo } from 'react';
import './GridScrollBg.css';

const COLS = 8;
const ROWS = 12;
const TOTAL = COLS * ROWS;
const SCROLL_SPEED = 0.35; // px per frame

const PALETTES = [
  'rgba(255, 140, 0,  0.25)',
  'rgba(255, 140, 0,  0.15)',
  'rgba(255, 50,  100, 0.22)',
  'rgba(255, 50,  100, 0.12)',
  'rgba(200, 100, 255, 0.2)',
  'rgba(200, 100, 255, 0.1)',
  'rgba(100, 200, 255, 0.15)',
  'rgba(0,   232, 150, 0.12)',
  'rgba(255, 200, 40,  0.14)',
  'rgba(255, 255, 255, 0.04)',
  'rgba(255, 255, 255, 0.03)',
  'rgba(255, 255, 255, 0.02)',
];

function makeTiles(count) {
  const tiles = [];
  for (let i = 0; i < count; i++) {
    tiles.push({
      id: i,
      bg: PALETTES[Math.floor(Math.random() * PALETTES.length)],
      animDelay: -(Math.random() * 8).toFixed(2) + 's',
      animDuration: (4 + Math.random() * 6).toFixed(2) + 's',
    });
  }
  return tiles;
}

export default function GridScrollBg() {
  const wrapRef = useRef(null);
  const animRef = useRef(null);
  const offsetRef = useRef(0);

  const tiles = useMemo(() => makeTiles(TOTAL * 2), []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const tick = () => {
      offsetRef.current += SCROLL_SPEED;
      const rowH = wrap.scrollHeight / 2;
      if (offsetRef.current >= rowH) offsetRef.current -= rowH;
      wrap.style.transform = `translate3d(0, -${offsetRef.current}px, 0)`;
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="gsb-viewport" aria-hidden="true">
      <div className="gsb-scroll-wrap" ref={wrapRef}>
        {tiles.map((t, i) => (
          <div
            key={i}
            className="gsb-tile"
            style={{
              backgroundColor: t.bg,
              animationDelay: t.animDelay,
              animationDuration: t.animDuration,
            }}
          />
        ))}
      </div>
    </div>
  );
}
