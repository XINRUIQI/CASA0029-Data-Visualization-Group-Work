import { useEffect, useRef } from 'react';
import './Page9.css';

const DRONES = [
  { x: 0.15, y: 0.28, s: 1.0, speed: 0.35 },
  { x: 0.55, y: 0.18, s: 0.65, speed: 0.22 },
  { x: 0.78, y: 0.38, s: 0.8, speed: 0.28 },
];

export default function Page9DroneHero() {
  const heroRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    if (!hero || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let t = 0;
    let raf = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = hero.getBoundingClientRect();
      w = canvas.width = Math.max(1, Math.round(rect.width * dpr));
      h = canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(hero);
    window.addEventListener('resize', resize);

    function drawCity() {
      ctx.save();
      ctx.globalAlpha = 0.35;

      for (let i = 0; i < 80; i++) {
        const x = (i / 80) * w;
        const base = h * 0.78;
        const height =
          (Math.sin(i * 1.7) * 0.5 + 0.5) * h * 0.22 + h * 0.08;

        ctx.fillStyle = 'rgba(56,189,248,0.22)';
        ctx.fillRect(x, base - height, w / 120, height);

        ctx.fillStyle = 'rgba(125,211,252,0.45)';
        ctx.fillRect(x, base - height, w / 160, 2);
      }

      ctx.restore();
    }

    function drawRoutes() {
      ctx.save();
      ctx.lineWidth = 1.2 * dpr;
      ctx.globalAlpha = 0.55;

      for (let i = 0; i < 7; i++) {
        const y = h * (0.28 + i * 0.07);
        const offset = (t * (0.3 + i * 0.04) + i * 120) % w;

        ctx.strokeStyle = 'rgba(34,211,238,0.35)';
        ctx.beginPath();

        for (let x = -200 * dpr; x < w + 200 * dpr; x += 40 * dpr) {
          const px = x + offset - w;
          const py = y + Math.sin((x / w) * 8 + i) * 28 * dpr;
          if (x === -200 * dpr) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        ctx.stroke();
      }

      ctx.restore();
    }

    function drawDrone(x, y, scale) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale * dpr, scale * dpr);

      ctx.shadowColor = 'rgba(125,211,252,0.8)';
      ctx.shadowBlur = 18;

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.roundRect(-34, -8, 68, 16, 8);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(-14, -18, 28, 36, 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(226,232,240,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(-70, -24);
      ctx.moveTo(34, 0);
      ctx.lineTo(70, -24);
      ctx.moveTo(-34, 0);
      ctx.lineTo(-70, 24);
      ctx.moveTo(34, 0);
      ctx.lineTo(70, 24);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(125,211,252,0.9)';
      ctx.lineWidth = 2;
      [[-76, -27], [76, -27], [-76, 27], [76, 27]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.ellipse(px, py, 26, 7, t * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.restore();
    }

    const animate = () => {
      t += 1;

      ctx.clearRect(0, 0, w, h);

      drawRoutes();
      drawCity();

      DRONES.forEach((d, i) => {
        const x =
          w * d.x +
          Math.sin(t * 0.006 * d.speed + i) * 35 * dpr;
        const y =
          h * d.y +
          Math.cos(t * 0.008 * d.speed + i) * 18 * dpr;
        drawDrone(x, y, d.s);
      });

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section id="page-9" className="page page9-drone-hero">
      <section className="hero" ref={heroRef}>
        <canvas ref={canvasRef} className="drone-bg" aria-hidden />
        <div className="hero-content">
          <p className="tag">
            Drone Delivery as Complementary Urban Infrastructure
          </p>
          <h1>Where Can Drones Relieve Ground Delivery Pressure?</h1>
          <p className="sub">
            A Shenzhen-based spatial analysis of demand, ground friction and
            aerial delivery opportunity.
          </p>
        </div>
      </section>
    </section>
  );
}
