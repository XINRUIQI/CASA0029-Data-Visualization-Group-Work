import { useEffect, useRef, useCallback } from 'react';

const PHASE_CIRCLES = 900;
const PHASE_MERGE = 2700;   // was 700ms — slowed by +2s so the two circles
                            //            crawl toward each other
const PHASE_TEXT = 1800;    // longer hold so the tagline has time to breathe
const PHASE_EXPAND = 1700;  // was 900ms — pill now expands to full screen
                            //            nearly twice as slowly for a more
                            //            cinematic "open-up" feel

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
      ctx.fillStyle = '#5A89A6';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';

      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (elapsed < T1) {
        // Phase 1: two circles appear, grow bigger and spread further apart
        const p = easeOut(elapsed / T1);
        const r = 20 + p * 70;        // 20 → 90 radius
        const gap = 80 + p * 280;     // 80 → 360 (half-distance between centers)
        ctx.beginPath();
        ctx.arc(cx - gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (elapsed < T2) {
        // Phase 2: the two large circles move toward each other and merge
        // into a long horizontal pill/bar. Uses a smoothstep-style easing so
        // the motion starts gentle, accelerates through the middle, then
        // eases out as they overlap — feels much more organic at 2.7s.
        const p = easeInOut((elapsed - T1) / PHASE_MERGE);
        const r = 90;
        const gap = 360 - p * 240;    // 360 → 120 (half-distance)

        // Connecting bar fades in as the circles get close enough to
        // visually overlap, so the transition reads as "two dots merging
        // into a pill" rather than a long stripe flanked by dots.
        const fadeStart = 200;
        const fadeEnd = 120;
        const barAlpha = Math.max(
          0,
          Math.min(1, (fadeStart - gap) / (fadeStart - fadeEnd))
        );
        if (barAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = barAlpha;
          ctx.fillRect(cx - gap, cy - r, gap * 2, r * 2);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(cx - gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (elapsed < T3) {
        // Phase 3: pill holds, slowly breathing slightly bigger
        const gp = easeOut((elapsed - T2) / PHASE_TEXT);
        const r = 90 + gp * 15;
        const gap = 120 + gp * 15;
        ctx.beginPath();
        ctx.arc(cx - gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - gap, cy - r, gap * 2, r * 2);
      } else {
        // Phase 4: the pill (two circles + connecting bar) scales uniformly
        // outward — instead of collapsing into a single circle and radiating
        // from the centre, we preserve the capsule silhouette so the reveal
        // reads as "the pill opens up to uncover the page".
        const p = easeInOut((elapsed - T3) / PHASE_EXPAND);
        const startR = 105;             // pill half-height at end of phase 3
        const startGap = 135;            // pill half-length at end of phase 3
        // A scale at which the two flanking circles (radius = startR*scale)
        // alone are guaranteed to cover every viewport corner. The bar
        // covers even more, so this is a safe upper bound for both axes.
        const targetScale = diag / startR;
        const scale = 1 + (targetScale - 1) * p;
        const r = startR * scale;
        const gap = startGap * scale;

        ctx.fillRect(cx - gap, cy - r, gap * 2, r * 2);
        ctx.beginPath();
        ctx.arc(cx - gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + gap, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw tagline — starts fading in exactly when the connecting bar
      // begins to materialise (so "text appears the moment the two circles
      // link up into a pill") and stays fully visible through the whole of
      // phase 3, only fading out right before the expand transition.
      const T_TEXT_IN = T1 + PHASE_MERGE * 0.6;
      if (elapsed > T_TEXT_IN && elapsed < T3 + 200) {
        const textIn = Math.min((elapsed - T_TEXT_IN) / 700, 1);
        const textOut = elapsed > T3 - 400
          ? Math.max(0, 1 - (elapsed - (T3 - 400)) / 500)
          : 1;
        const textAlpha = easeOut(textIn) * textOut;

        if (textAlpha > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // Bigger (was min(w*0.022, 22)) and sits lower below the pill
          const fontSize = Math.min(w * 0.036, 36);
          ctx.font = `300 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;
          ctx.fillStyle = `rgba(180, 200, 220, ${textAlpha * 0.9})`;
          ctx.fillText('Say goodbye to soggy french fries.', cx, cy + 150);
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
