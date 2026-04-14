import { useEffect, useRef, useCallback } from 'react';

const PARTICLE_COUNT = 4000;
const PHASE_BURST = 1000;
const PHASE_RETREAT = 900;
const PHASE_BLACK = 300;
const PHASE_TEXT = 1400;
const PHASE_FADE = 800;

export default function EnterTransition({ active, spawnPoints, onComplete }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const startRef = useRef(null);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h / 2;

    const srcPts = spawnPoints && spawnPoints.length > 0 ? spawnPoints : null;

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      let sx, sy;
      if (srcPts) {
        const src = srcPts[i % srcPts.length];
        sx = src.x + (Math.random() - 0.5) * 6;
        sy = src.y + (Math.random() - 0.5) * 6;
      } else {
        sx = cx + (Math.random() - 0.5) * 50;
        sy = cy + (Math.random() - 0.5) * 50;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 14;
      const drift = (Math.random() - 0.5) * 6;
      return {
        x: sx,
        y: sy,
        vx: Math.cos(angle) * speed + drift,
        vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 5,
        wanderPhase: Math.random() * Math.PI * 2,
        wanderSpeed: 0.8 + Math.random() * 2.5,
        wanderAmp: 2 + Math.random() * 4,
        baseSize: 0.4 + Math.random() * 1.4,
        alpha: 0.5 + Math.random() * 0.5,
        hue: Math.random() < 0.5 ? 200 : (140 + Math.random() * 40),
      };
    });

    const T_BURST_END = PHASE_BURST;
    const T_RETREAT_END = T_BURST_END + PHASE_RETREAT;
    const T_BLACK_END = T_RETREAT_END + PHASE_BLACK;
    const T_TEXT_END = T_BLACK_END + PHASE_TEXT;
    const T_TOTAL = T_TEXT_END + PHASE_FADE;

    startRef.current = performance.now();

    const draw = (now) => {
      const elapsed = now - startRef.current;
      const t = elapsed * 0.001;

      ctx.clearRect(0, 0, w, h);

      let bgAlpha;
      if (elapsed < T_BURST_END) {
        bgAlpha = Math.min(elapsed / (PHASE_BURST * 0.4), 1) * 0.5;
      } else if (elapsed < T_RETREAT_END) {
        const rp = (elapsed - T_BURST_END) / PHASE_RETREAT;
        bgAlpha = 0.5 + rp * 0.5;
      } else {
        bgAlpha = 1;
      }
      ctx.fillStyle = `rgba(5, 5, 24, ${bgAlpha})`;
      ctx.fillRect(0, 0, w, h);

      const showParticles = elapsed < T_RETREAT_END;

      if (showParticles) {
        const burstP = Math.min(elapsed / PHASE_BURST, 1);
        const burstEased = 1 - Math.pow(1 - burstP, 2);
        const inRetreat = elapsed > T_BURST_END;
        const retreatP = inRetreat
          ? (elapsed - T_BURST_END) / PHASE_RETREAT
          : 0;
        const retreatEased = 1 - Math.pow(1 - retreatP, 2);

        const sizeMul = inRetreat
          ? Math.max(0.1, 1 - retreatEased * 0.9)
          : Math.max(0.25, 1 - burstEased * 0.55);

        for (const p of particles) {
          if (inRetreat) {
            const dx = cx - p.x;
            const dy = cy - p.y;
            p.vx += dx * 0.004;
            p.vy += dy * 0.004;
            p.vx *= 0.955;
            p.vy *= 0.955;
          } else {
            p.vx *= 0.982;
            p.vy *= 0.982;
          }

          const wx = Math.sin(t * p.wanderSpeed + p.wanderPhase) * p.wanderAmp;
          const wy = Math.cos(t * p.wanderSpeed * 0.7 + p.wanderPhase * 1.3) * p.wanderAmp;
          p.x += p.vx + wx * 0.12;
          p.y += p.vy + wy * 0.12;

          let pAlpha = p.alpha * burstEased;
          if (inRetreat) pAlpha *= (1 - retreatEased);
          if (pAlpha <= 0.01) continue;

          const sz = p.baseSize * sizeMul;

          ctx.beginPath();
          ctx.arc(p.x, p.y, sz * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${pAlpha * 0.05})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${pAlpha})`;
          ctx.fill();
        }
      }

      if (elapsed > T_BLACK_END) {
        const textElapsed = elapsed - T_BLACK_END;
        const textProgress = Math.min(textElapsed / (PHASE_TEXT * 0.7), 1);
        const textEased = 1 - Math.pow(1 - textProgress, 3);
        let textAlpha = textEased;

        if (elapsed > T_TEXT_END) {
          textAlpha *= Math.max(0, 1 - (elapsed - T_TEXT_END) / PHASE_FADE);
        }

        if (textAlpha > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const fontSize = Math.min(w * 0.12, 120);
          ctx.font = `800 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;

          ctx.shadowColor = 'rgba(100, 200, 255, 0.6)';
          ctx.shadowBlur = 50 * textEased;
          ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha * 0.35})`;
          ctx.fillText('Group 3', cx, cy - 10);

          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
          ctx.fillText('Group 3', cx, cy - 10);

          const subSize = Math.min(w * 0.02, 18);
          ctx.font = `300 ${subSize}px -apple-system, "Helvetica Neue", sans-serif`;
          ctx.letterSpacing = '4px';
          ctx.fillStyle = `rgba(100, 200, 255, ${textAlpha * 0.7})`;
          ctx.fillText('CASA0029  DATA  VISUALISATION', cx, cy + fontSize * 0.5 + 20);

          ctx.restore();
        }
      }

      if (elapsed < T_TOTAL) {
        animRef.current = requestAnimationFrame(draw);
      } else {
        onComplete?.();
      }
    };

    animRef.current = requestAnimationFrame(draw);
  }, [onComplete, spawnPoints]);

  useEffect(() => {
    if (active) run();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, run]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="p0-enter-transition"
    />
  );
}
