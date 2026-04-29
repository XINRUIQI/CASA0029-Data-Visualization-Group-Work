import { useEffect, useRef, useCallback } from 'react';

const CLOUD_COUNT = 65;
const BUILDING_COUNT = 50;
const ENTRANCE_MS = 1000;
const ENTRANCE_BLUR_MAX = 9;

function seeded(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const smooth = (t) => t * t * (3 - 2 * t);
  const ux = smooth(fx);
  const uy = smooth(fy);
  const a = seeded(x0 * 1.7 + y0 * 9.2);
  const b = seeded((x0 + 1) * 1.7 + y0 * 9.2);
  const c = seeded(x0 * 1.7 + (y0 + 1) * 9.2);
  const d = seeded((x0 + 1) * 1.7 + (y0 + 1) * 9.2);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
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
      const blobs = [];
      for (let b = 0; b < 3; b++) {
        const s = seeded(i * 11.7 + b * 19.3);
        const s2 = seeded(i * 4.1 + b * 29.9);
        blobs.push({
          ox: (s - 0.5) * (b === 0 ? 0.15 : 0.95),
          oy: (s2 - 0.5) * (b === 0 ? 0.12 : 0.75),
          rxm: b === 0 ? 1 : 0.42 + seeded(i * 2.9 + b) * 0.38,
          rym: b === 0 ? 1 : 0.38 + seeded(i * 5.3 + b) * 0.35,
        });
      }
      clouds.push({
        x: seeded(i * 3.1) * w * 1.4 - w * 0.2,
        y: h * 0.1 + seeded(i * 7.3) * h * 0.6,
        rx: 70 + seeded(i * 2.7) * 160,
        ry: 28 + seeded(i * 5.1) * 50,
        alpha: 0.18 + seeded(i * 1.9) * 0.38,
        speed: 0.06 + seeded(i * 4.2) * 0.18,
        phase: seeded(i * 9.1) * Math.PI * 2,
        layer,
        layerDrift: 0.72 + layer * 0.18,
        parallaxYmul: 1 + layer * 0.62,
        blobs,
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

    const drawClouds = (t, dp, elapsed) => {
      const sunX = w * 0.55;
      const sunY = h * (0.28 - dp * 0.55);
      const cameraY = dp * h * 2.2;
      const entranceT = Math.min(1, elapsed / ENTRANCE_MS);
      const entranceEase = 1 - Math.pow(1 - entranceT, 3);
      const introScale = 0.96 + 0.04 * entranceEase;
      const introOpacity = 0.18 + 0.82 * entranceEase;
      const blurPx = (1 - entranceEase) * ENTRANCE_BLUR_MAX;

      const drawPuffs = () => {
        scene.clouds.forEach((c) => {
          const parallax = c.parallaxYmul;
          let cy = c.y - cameraY * parallax;
          const driftAmp = 14 + c.layer * 12;
          const driftX = Math.sin(t * c.speed * c.layerDrift + c.phase) * driftAmp;
          let cx = c.x + driftX;
          cy += Math.sin(t * c.speed * 0.85 * c.layerDrift + c.phase + 1.7) * (4 + c.layer * 3);

          const n1 = smoothNoise(cx * 0.006 + t * 0.11 * c.layerDrift, cy * 0.006 + c.phase * 2);
          const n2 = smoothNoise(cx * 0.009 + 17.2, cy * 0.009 + t * 0.08);
          cx += (n1 - 0.5) * 9;
          cy += (n2 - 0.5) * 6.4;
          cy += (1 - entranceEase) * (10 + c.layer * 6);

          if (cy < -280 || cy > h + 280) return;

          const scale = introScale * (1 + dp * c.layer * 0.35);
          const diveDim = Math.max(0, 1 - dp * 0.55);
          const noiseA = 0.82 + 0.18 * smoothNoise(cx * 0.012 + c.phase, cy * 0.012 + t * 0.03);
          const baseAlpha = c.alpha * diveDim * introOpacity * noiseA;

          const dx = sunX - cx;
          const dy = sunY - cy;
          const warmBias = Math.min(1, 1100 / (Math.hypot(dx, dy) + 80));

          for (const b of c.blobs) {
            const bx = cx + b.ox * c.rx * scale;
            const by = cy + b.oy * c.ry * scale;
            const brx = c.rx * b.rxm * scale;
            const bry = c.ry * b.rym * scale;
            const rMax = Math.max(brx, bry) * 1.2;
            const grd = ctx.createRadialGradient(bx, by, 0, bx, by, rMax);
            const peak = baseAlpha * (0.52 + 0.48 * warmBias);
            const midA = baseAlpha * (0.32 + 0.22 * warmBias);
            const edgeA = baseAlpha * 0.09;
            grd.addColorStop(0, `rgba(255, 252, 248, ${peak})`);
            grd.addColorStop(0.28, `rgba(248, 244, 255, ${midA})`);
            grd.addColorStop(0.55, `rgba(255, 230, 224, ${edgeA})`);
            grd.addColorStop(0.82, `rgba(228, 236, 248, ${edgeA * 0.35})`);
            grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.beginPath();
            ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
          }
        });
      };

      ctx.save();
      if (blurPx > 0.45) ctx.filter = `blur(${blurPx}px)`;
      drawPuffs();
      ctx.restore();
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
      grd.addColorStop(1, `rgba(46, 94, 126, ${cityAlpha})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, baseY - 5, w, 25);
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
      drawClouds(t, dp, elapsed);
      drawCity(dp);

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
