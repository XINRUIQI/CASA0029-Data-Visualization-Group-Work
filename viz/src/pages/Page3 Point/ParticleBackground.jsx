import { useEffect, useRef } from 'react';

function generateBuildings(W, H) {
  const buildings = [];
  let x = 0;
  while (x < W) {
    const w   = 7.7 + Math.random() * 16.5;
    const h   = 16.5 + Math.random() * (H * 0.1513);
    const top = H - h;
    const cols = Math.floor(w / 5);
    const rows = Math.floor(h / 7);
    const windows = Array.from({ length: rows * cols }, () => ({
      on:       Math.random() > 0.45,
      flicker:  Math.random() < 0.08,
      timer:    Math.random() * 200,
      interval: 40 + Math.random() * 300,
    }));
    buildings.push({ x, w, top, h, windows, cols, rows });
    x += w + 0.55 + Math.random() * 1.65;
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

    const DRONES = Array.from({ length: 3 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 0.6 + Math.random() * 0.8;
      const H0    = canvas.height;
      return {
        x:     (i + 0.5) * (canvas.width / 3) + (Math.random() - 0.5) * 80,
        y:     H0 * 0.78 + Math.random() * H0 * 0.14,
        vx:    Math.cos(angle) * spd,
        vy:    Math.sin(angle) * spd * 0.5,
        size:  8 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
      };
    });

    function drawDrone(x, y, size, t) {
      const s = size;
      // 4 arm tip positions — front pair lower/wider, back pair higher/narrower (perspective)
      const tips = [
        [x - s * 1.0, y + s * 0.55],  // front-left
        [x + s * 1.0, y + s * 0.55],  // front-right
        [x - s * 0.7, y - s * 0.38],  // back-left
        [x + s * 0.7, y - s * 0.38],  // back-right
      ];

      // arms
      ctx.strokeStyle = '#8abcda';
      ctx.lineWidth = 1.2;
      for (const [tx, ty] of tips) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.08);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      // front rotors (closer — larger ellipse)
      ctx.strokeStyle = '#64c8ff';
      ctx.lineWidth = 1.2;
      for (const [tx, ty] of tips.slice(0, 2)) {
        ctx.beginPath();
        ctx.ellipse(tx, ty, s * 0.42, s * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
        // rotor blur ring
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.ellipse(tx, ty, s * 0.52, s * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // back rotors (further — smaller ellipse)
      for (const [tx, ty] of tips.slice(2)) {
        ctx.beginPath();
        ctx.ellipse(tx, ty, s * 0.3, s * 0.09, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // body — top face
      ctx.fillStyle = '#1e3f5a';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.08);
      ctx.lineTo(x + s * 0.2, y - s * 0.08);
      ctx.lineTo(x + s * 0.24, y + s * 0.08);
      ctx.lineTo(x - s * 0.24, y + s * 0.08);
      ctx.closePath();
      ctx.fill();

      // body — front face
      ctx.fillStyle = '#2e6080';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y + s * 0.08);
      ctx.lineTo(x + s * 0.24, y + s * 0.08);
      ctx.lineTo(x + s * 0.24, y + s * 0.24);
      ctx.lineTo(x - s * 0.24, y + s * 0.24);
      ctx.closePath();
      ctx.fill();

      // camera lens
      ctx.fillStyle = '#f0e8ee';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.24, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(100,200,255,0.6)';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.24, s * 0.055, 0, Math.PI * 2);
      ctx.fill();

      // blinking nav light
      if (Math.sin(t * 4) > 0.2) {
        ctx.fillStyle = '#ff3c3c';
        ctx.beginPath();
        ctx.arc(x, y + s * 0.36, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const STARS = Array.from({ length: 700 }, () => ({
      x:      Math.random(),
      y:      Math.random() * Math.random() * 0.55,
      r:      Math.random() * 1.2 + 0.3,
      phase:  Math.random() * Math.PI * 2,
      freq:   Math.random() * 2.5 + 0.5,
      twinkle: Math.random() < 0.4,
    }));

    function resetMeteor(m, W) {
      m.x     = Math.random() * W * 0.6;
      m.y     = 10 + Math.random() * 100;
      m.vx    = 4 + Math.random() * 4;
      m.vy    = 1.2 + Math.random() * 1.5;
      m.len   = 80 + Math.random() * 120;
      m.alpha = 0;
      m.state = 'wait';
      m.wait  = 480;
    }

    const METEORS = Array.from({ length: 2 }, (_, i) => {
      const m = {};
      resetMeteor(m, canvas.width);
      m.wait = i * 240;
      return m;
    });

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
        let a, r;
        if (s.twinkle) {
          const pulse = 0.5 + 0.5 * Math.sin(frame * 0.018 * s.freq + s.phase);
          a = 0.05 + 0.95 * pulse;
          r = s.r * (0.6 + 0.8 * pulse);
        } else {
          a = 0.4 + 0.3 * Math.sin(frame * 0.006 * s.freq + s.phase);
          r = s.r;
        }
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 225, 255, ${a})`;
        ctx.fill();
      }

      const t = frame * 0.016;
      for (const d of DRONES) {
        d.x += d.vx;
        d.y += d.vy;
        const minY = H * 0.78, maxY = H * 0.93;
        if (d.x > W + 60) d.x = -60;
        if (d.x < -60)    d.x = W + 60;
        if (d.y < minY) { d.y = minY; d.vy *= -1; }
        if (d.y > maxY) { d.y = maxY; d.vy *= -1; }
        ctx.save();
        if (d.vx < 0) {
          ctx.scale(-1, 1);
          drawDrone(-d.x, d.y, d.size, t + d.phase);
        } else {
          drawDrone(d.x, d.y, d.size, t + d.phase);
        }
        ctx.restore();
      }

      for (const m of METEORS) {
        if (m.state === 'wait') {
          m.wait--;
          if (m.wait <= 0) m.state = 'in';
        } else if (m.state === 'in') {
          m.alpha = Math.min(1, m.alpha + 0.06);
          m.x += m.vx; m.y += m.vy;
          if (m.alpha >= 1) m.state = 'fly';
        } else if (m.state === 'fly') {
          m.x += m.vx; m.y += m.vy;
          if (m.x > W + 50 || m.y > 220) {
            resetMeteor(m, W);
          }
        }
        if (m.state === 'wait') continue;
        const tailX = m.x - m.vx / Math.hypot(m.vx, m.vy) * m.len;
        const tailY = m.y - m.vy / Math.hypot(m.vx, m.vy) * m.len;
        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(255,255,255,${m.alpha * 0.9})`);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${m.alpha})`;
        ctx.fill();
      }

      for (const b of buildings) {
        ctx.fillStyle = '#f0e8ee';
        ctx.fillRect(b.x, b.top, b.w, b.h);

        ctx.fillStyle = 'rgba(80, 120, 255, 0.25)';
        ctx.fillRect(b.x, b.top, b.w, 1.5);

        const winW  = (b.w - 3.3) / b.cols;
        const winH  = 3.85;
        const startY = b.top + 5.5;

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

            const wx = b.x + 1.65 + c * winW;
            const wy = startY + r * 7.15;
            if (wy + winH > b.top + b.h - 2.2) continue;

            ctx.fillStyle = 'rgba(255, 255, 200, 0.35)';
            ctx.fillRect(wx, wy, winW - 2, winH);
          }
        }

        if (b.h > H * 0.3) {
          const blink = Math.sin(frame * 0.04 + b.x) > 0.7;
          if (blink) {
            ctx.beginPath();
            ctx.arc(b.x + b.w / 2, b.top - 1.65, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = '#f0e8ee';
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
