import { useEffect, useRef } from 'react';

function generateBuildings(W, H) {
  const buildings = [];
  let x = 0;
  while (x < W) {
    const w   = 14 + Math.random() * 30;
    const h   = 30 + Math.random() * (H * 0.275);
    const top = H - h;
    const cols = Math.floor(w / 10);
    const rows = Math.floor(h / 14);
    const windows = Array.from({ length: rows * cols }, () => ({
      on:       Math.random() > 0.45,
      flicker:  Math.random() < 0.08,
      timer:    Math.random() * 200,
      interval: 40 + Math.random() * 300,
    }));
    buildings.push({ x, w, top, h, windows, cols, rows });
    x += w + 1 + Math.random() * 3;
  }
  return buildings;
}

export default function ParticleBackground() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let raf;
    let buildings = [];

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  || window.innerWidth;
      canvas.height = rect.height || window.innerHeight;
      buildings = generateBuildings(canvas.width, canvas.height);
    };
    init();
    const ro = new ResizeObserver(init);
    ro.observe(canvas.parentElement || document.body);

    const STARS = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random() * 0.55,
      r: Math.random() * 1.1 + 0.2,
      phase: Math.random() * Math.PI * 2,
      freq:  Math.random() * 0.8 + 0.3,
    }));

    let frame = 0;
    const draw = () => {
      frame++;
      const W = canvas.width, H = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,   '#020510');
      sky.addColorStop(0.6, '#060820');
      sky.addColorStop(1,   '#0a0d2a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      for (const s of STARS) {
        const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(frame * 0.01 * s.freq + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 215, 255, ${a})`;
        ctx.fill();
      }

      for (const b of buildings) {
        ctx.fillStyle = '#0d1128';
        ctx.fillRect(b.x, b.top, b.w, b.h);

        ctx.fillStyle = 'rgba(80, 120, 255, 0.25)';
        ctx.fillRect(b.x, b.top, b.w, 1.5);

        const winW  = (b.w - 6) / b.cols;
        const winH  = 7;
        const startY = b.top + 10;

        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            const win = b.windows[r * b.cols + c];

            if (win.flicker) {
              win.timer++;
              if (win.timer > win.interval) {
                win.on = !win.on;
                win.timer = 0;
                win.interval = 40 + Math.random() * 300;
              }
            }

            if (!win.on) continue;

            const wx = b.x + 3 + c * winW;
            const wy = startY + r * 13;
            if (wy + winH > b.top + b.h - 4) continue;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(wx, wy, winW - 2, winH);
          }
        }

        if (b.h > H * 0.3) {
          const blink = Math.sin(frame * 0.04 + b.x) > 0.7;
          if (blink) {
            ctx.beginPath();
            ctx.arc(b.x + b.w / 2, b.top - 3, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = '#080b1c';
      ctx.fillRect(0, H - 2, W, 2);

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
