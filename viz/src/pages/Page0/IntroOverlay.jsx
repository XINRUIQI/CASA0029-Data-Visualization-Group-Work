import { useEffect, useRef, useCallback } from 'react';

const PHASE_CIRCLES = 800;
const PHASE_MERGE = 600;
const PHASE_TEXT = 1200;
const PHASE_EXPAND = 900;

export default function IntroOverlay({ onComplete }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const doneRef = useRef(false);

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
    const diag = Math.sqrt(w * w + h * h);

    const T1 = PHASE_CIRCLES;
    const T2 = T1 + PHASE_MERGE;
    const T3 = T2 + PHASE_TEXT;
    const T_TOTAL = T3 + PHASE_EXPAND;

    const start = performance.now();

    const draw = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      // dark background
      ctx.fillStyle = '#050518';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';

      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (elapsed < T1) {
        // Phase 1: two circles appear, grow bigger and spread apart
        const p = easeOut(elapsed / T1);
        const r = 15 + p * 45;
        const gap = 60 + p * 40;
        ctx.beginPath();
        ctx.arc(cx - gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (elapsed < T2) {
        // Phase 2: circles merge into a horizontal pill/bar
        const p = easeInOut((elapsed - T1) / PHASE_MERGE);
        const r = 60;
        const gap = 100 * (1 - p * 0.5);
        const barW = gap;

        ctx.beginPath();
        ctx.arc(cx - barW, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + barW, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - barW, cy - r, barW * 2, r * 2);
      } else if (elapsed < T3) {
        // Phase 3: pill stays, text appears below, slowly grows
        const gp = easeOut((elapsed - T2) / PHASE_TEXT);
        const r = 60 + gp * 20;
        const barW = 75 + gp * 10;
        ctx.beginPath();
        ctx.arc(cx - barW, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + barW, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - barW, cy - r, barW * 2, r * 2);
      } else {
        // Phase 4: expand to full screen
        const p = easeInOut((elapsed - T3) / PHASE_EXPAND);
        const startR = 85;
        const endR = diag;
        const r = startR + (endR - startR) * p;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw text during phase 3 (on the dark overlay, not punched out)
      if (elapsed > T2 && elapsed < T3 + 200) {
        const textIn = Math.min((elapsed - T2) / 400, 1);
        const textOut = elapsed > T3 - 300
          ? Math.max(0, 1 - (elapsed - (T3 - 300)) / 500)
          : 1;
        const textAlpha = easeOut(textIn) * textOut;

        if (textAlpha > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const fontSize = Math.min(w * 0.022, 22);
          ctx.font = `300 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;
          ctx.fillStyle = `rgba(180, 200, 220, ${textAlpha * 0.85})`;
          ctx.fillText('Say goodbye to soggy french fries.', cx, cy + 70);
          ctx.restore();
        }
      }

      if (elapsed < T_TOTAL) {
        animRef.current = requestAnimationFrame(draw);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    };

    animRef.current = requestAnimationFrame(draw);
  }, [onComplete]);

  useEffect(() => {
    run();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [run]);

  return <canvas ref={canvasRef} className="p0-intro-overlay" />;
}
