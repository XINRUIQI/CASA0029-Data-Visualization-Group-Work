import { useEffect, useRef, useCallback } from 'react';

const CLOUD_COUNT = 65;
const BUILDING_COUNT = 50;

function seeded(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function CloudDiveBg({ onIntroComplete }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({ progress: 0, introDone: false });
  const callbackRef = useRef(onIntroComplete);
  callbackRef.current = onIntroComplete;

  const buildScene = useCallback((w, h) => {
    const clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const layer = i < 22 ? 0 : i < 44 ? 1 : 2;
      clouds.push({
        x: seeded(i * 3.1) * w * 1.4 - w * 0.2,
        y: h * 0.1 + seeded(i * 7.3) * h * 0.6,
        rx: 70 + seeded(i * 2.7) * 160,
        ry: 28 + seeded(i * 5.1) * 50,
        alpha: 0.18 + seeded(i * 1.9) * 0.38,
        speed: 0.06 + seeded(i * 4.2) * 0.18,
        phase: seeded(i * 9.1) * Math.PI * 2,
        layer,
      });
    }

    const buildings = [];
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const x = (i / BUILDING_COUNT) * w * 1.15 - w * 0.075;
      const bw = 8 + seeded(i * 6.3) * 24;
      const bh = 25 + seeded(i * 4.7) * 90;
      const bright = 0.15 + seeded(i * 3.3) * 0.3;
      buildings.push({ x, w: bw, h: bh, bright });
    }

    return { clouds, buildings };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, scene;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.parentElement.clientWidth;
      h = canvas.parentElement.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = buildScene(w, h);
    };

    const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const drawSky = (dp) => {
      const topH = 0.35 + dp * 0.35;
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      const n = Math.min(dp * 1.4, 1);
      grd.addColorStop(0, `rgb(${Math.round(185 - 175 * n)},${Math.round(205 - 195 * n)},${Math.round(245 - 215 * n)})`);
      grd.addColorStop(topH, `rgb(${Math.round(235 - 215 * n)},${Math.round(205 - 185 * n)},${Math.round(215 - 180 * n)})`);
      grd.addColorStop(1, `rgb(${Math.round(25 + 5 * (1 - n))},${Math.round(20 + 5 * (1 - n))},${Math.round(45 + 5 * (1 - n))})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    };

    const drawSun = (dp) => {
      const sunY = h * (0.28 - dp * 0.55);
      const sunX = w * 0.55;
      const sunR = 55 + dp * 15;
      const alpha = Math.max(0, 0.65 - dp * 0.85);
      if (alpha <= 0) return;

      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.5);
      glow.addColorStop(0, `rgba(255, 225, 185, ${alpha * 0.5})`);
      glow.addColorStop(0.25, `rgba(255, 200, 165, ${alpha * 0.2})`);
      glow.addColorStop(1, 'rgba(255, 200, 165, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 245, 225, ${alpha})`;
      ctx.fill();
    };

    const drawClouds = (t, dp) => {
      const cameraY = dp * h * 2.2;
      scene.clouds.forEach(c => {
        const parallax = 1 + c.layer * 0.6;
        const cy = c.y - cameraY * parallax;
        if (cy < -250 || cy > h + 250) return;

        const driftX = Math.sin(t * c.speed + c.phase) * 18;
        const cx = c.x + driftX;
        const scale = 1 + dp * c.layer * 0.35;
        const alpha = c.alpha * Math.max(0, 1 - dp * 0.55);

        ctx.beginPath();
        ctx.ellipse(cx, cy, c.rx * scale, c.ry * scale, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });
    };

    const drawCity = (dp) => {
      const cityAlpha = Math.max(0, (dp - 0.25) / 0.75);
      if (cityAlpha <= 0) return;

      const baseY = h - 8;
      const scale = 0.4 + dp * 1.8;

      scene.buildings.forEach(b => {
        const bh = b.h * scale;
        const bw = b.w * scale;
        const bx = b.x + (b.x - w / 2) * (scale - 1) * 0.25;

        ctx.fillStyle = `rgba(25, 30, 55, ${cityAlpha * 0.92})`;
        ctx.fillRect(bx, baseY - bh, bw, bh);

        const winAlpha = cityAlpha * b.bright * 0.85;
        ctx.fillStyle = `rgba(100, 200, 255, ${winAlpha})`;
        const winW = Math.max(2, bw * 0.14);
        const winH = Math.max(2, 3 * scale * 0.5);
        const winGap = Math.max(6, 10 * scale * 0.4);
        for (let wy = baseY - bh + 8; wy < baseY - 5; wy += winGap) {
          for (let wx = bx + 3; wx < bx + bw - 3; wx += winW + 3) {
            if (seeded(wx * 17 + wy * 31) > 0.38) {
              ctx.fillRect(wx, wy, winW, winH);
            }
          }
        }
      });

      const grd = ctx.createLinearGradient(0, baseY - 5, 0, baseY + 15);
      grd.addColorStop(0, `rgba(12, 15, 30, ${cityAlpha})`);
      grd.addColorStop(1, `rgba(10, 10, 26, ${cityAlpha})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, baseY - 5, w, 25);
    };

    const drawDrone = (t, dp) => {
      const droneX = w * 0.5 + Math.sin(t * 0.7) * 25;
      const baseY = dp < 0.5
        ? h * 0.3 + dp * h * 0.4
        : h * 0.5 + (dp - 0.5) * h * 0.15;
      const droneY = baseY + Math.sin(t * 1.5) * 5;
      const droneScale = 0.8 + dp * 0.8;
      const s = 7 * droneScale;

      ctx.save();
      ctx.translate(droneX, droneY);

      ctx.fillStyle = `rgba(200, 220, 240, ${0.85 + dp * 0.15})`;
      ctx.fillRect(-s * 0.45, -s * 0.15, s * 0.9, s * 0.3);

      const armLen = s * 1.3;
      ctx.strokeStyle = `rgba(180, 200, 220, ${0.6 + dp * 0.3})`;
      ctx.lineWidth = 1.5 * droneScale;
      for (const angle of [-0.6, 0.6, Math.PI - 0.6, Math.PI + 0.6]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * armLen, Math.sin(angle) * armLen);
        ctx.stroke();
      }

      const propSpeed = 14;
      const propR = s * 0.65;
      ctx.strokeStyle = `rgba(0, 232, 150, ${0.4 + dp * 0.3})`;
      ctx.lineWidth = 1.5 * droneScale;
      for (const angle of [-0.6, 0.6, Math.PI - 0.6, Math.PI + 0.6]) {
        const hx = Math.cos(angle) * armLen;
        const hy = Math.sin(angle) * armLen;
        const pAngle = t * propSpeed + angle * 3;
        ctx.beginPath();
        ctx.arc(hx, hy, propR, pAngle, pAngle + Math.PI * 1.3);
        ctx.stroke();
      }

      ctx.restore();
    };

    const LINGER_DURATION = 2500;
    const DIVE_DURATION = 4500;
    let startTime = null;

    const draw = (time) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const t = time * 0.001;
      const st = stateRef.current;

      if (!st.introDone) {
        if (elapsed < LINGER_DURATION) {
          st.progress = 0;
        } else {
          const diveElapsed = elapsed - LINGER_DURATION;
          const raw = Math.min(diveElapsed / DIVE_DURATION, 1);
          st.progress = easeInOut(raw);
          if (raw >= 1 && !st.introDone) {
            st.introDone = true;
            callbackRef.current?.();
          }
        }
      }

      const dp = st.progress;

      ctx.clearRect(0, 0, w, h);
      drawSky(dp);
      drawSun(dp);
      drawClouds(t, dp);
      drawCity(dp);
      drawDrone(t, dp);

      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [buildScene]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
