import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const PARTICLE_COUNT = 1000;
const CONNECT_DIST = 55;
const MOUSE_RADIUS = 150;

/**
 * Generate target positions for a *side-view* quad-copter silhouette.
 *
 * Coordinate sketch (cx, cy is the fuselage center):
 *
 *          ─ ─ ─               ─ ─ ─         <- spinning rotors (horizontal
 *           │                   │                blur strokes in side view)
 *           ║                   ║             <- motor/strut posts
 *            ╲                 ╱
 *             ╲               ╱               <- arms, tilted upward
 *        ╔═════╪═════════════╪═════╗          <- fuselage (horizontal ellipse)
 *              │             │
 *              ▼             ▼                <- landing gear legs
 *
 * We represent each part as a "layer" so draw-time code can style (colour,
 * size, glow) and animate (spin) it differently. Propeller particles orbit
 * a hub on an *extremely flattened ellipse* (orbitR wide, orbitRy tiny) so
 * that from the side they read as a horizontal motion blur, not a disc.
 */
function generateDroneTargets(cx, cy, scale, count) {
  const bodyRx    = 82 * scale;   // fuselage half-length
  const bodyRy    = 13 * scale;   // fuselage half-height
  const armLen    = 54 * scale;   // length of each upward-tilted arm
  const armAngle  = Math.PI * 0.18; // ~32° upward tilt
  const propLen   = 50 * scale;   // rotor half-span (disc radius)
  const propYLift = 4 * scale;    // rotor sits slightly above the motor tip
  const gearH     = 18 * scale;   // landing-gear leg height

  // Arm bases are lifted up by half the fuselage so arms appear to come out
  // of the top-half of the hull, not the centerline.
  const armBases = [
    { bx: cx + bodyRx * 0.55, by: cy - bodyRy * 0.35, dir:  1 }, // front arm
    { bx: cx - bodyRx * 0.55, by: cy - bodyRy * 0.35, dir: -1 }, // rear arm
  ];

  const pts = [];

  const bodyCount    = Math.floor(count * 0.22);
  const armCount     = Math.floor(count * 0.14);
  const propCount    = Math.floor(count * 0.42);
  const gearCount    = Math.floor(count * 0.06);
  const ambientCount = count - bodyCount - armCount - propCount - gearCount;

  // ── Fuselage: dense, horizontal ellipse (plus a subtle taper on both ends
  //    to hint at a bullet-like silhouette) ──
  for (let i = 0; i < bodyCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    // Taper: narrow the ellipse near the ends so |cos(a)| ~ 1 → smaller ry.
    const taper = 1 - Math.abs(Math.cos(a)) * 0.25;
    pts.push({
      x: cx + Math.cos(a) * bodyRx * r,
      y: cy + Math.sin(a) * bodyRy * taper * r,
      layer: 'body',
      hubAngle: 0, hubCx: 0, hubCy: 0, orbitR: 0, orbitRy: 0,
    });
  }

  // ── Arms + short vertical motor strut on the end of each arm ──
  const perArm = Math.floor(armCount / 2);
  for (const base of armBases) {
    const endX = base.bx + base.dir * Math.cos(armAngle) * armLen;
    const endY = base.by - Math.sin(armAngle) * armLen;
    // Most particles trace the arm line.
    const armJitter = 2 * scale;
    for (let i = 0; i < perArm; i++) {
      const t = i / perArm;
      const jx = (Math.random() - 0.5) * armJitter;
      const jy = (Math.random() - 0.5) * armJitter;
      pts.push({
        x: base.bx + (endX - base.bx) * t + jx,
        y: base.by + (endY - base.by) * t + jy,
        layer: 'arm',
        hubAngle: 0, hubCx: 0, hubCy: 0, orbitR: 0, orbitRy: 0,
      });
    }
    // A few more particles on the short vertical motor post above the tip.
    const strutParticles = Math.max(4, Math.floor(perArm * 0.25));
    for (let i = 0; i < strutParticles; i++) {
      const u = i / strutParticles;
      pts.push({
        x: endX + (Math.random() - 0.5) * armJitter,
        y: endY - u * 6 * scale,
        layer: 'arm',
        hubAngle: 0, hubCx: 0, hubCy: 0, orbitR: 0, orbitRy: 0,
      });
    }
  }

  // ── Rotors: each rotor is a SET of particles orbiting a flattened ellipse
  //    (wide in x, near-zero in y) so from the side they look like a
  //    blurred horizontal stroke above each motor. ──
  const perProp = Math.floor(propCount / 2);
  for (const base of armBases) {
    const endX = base.bx + base.dir * Math.cos(armAngle) * armLen;
    const endY = base.by - Math.sin(armAngle) * armLen;
    const hubX = endX;
    const hubY = endY - propYLift;
    for (let i = 0; i < perProp; i++) {
      const a = (Math.PI * 2 * i) / perProp + Math.random() * 0.4;
      const rScale = 0.4 + Math.random() * 0.6; // density across span
      pts.push({
        x: hubX + Math.cos(a) * propLen * rScale,
        y: hubY + Math.sin(a) * 1.2 * scale * rScale,
        layer: 'prop',
        hubAngle: a,
        hubCx: hubX,
        hubCy: hubY,
        orbitR:  propLen * rScale,       // horizontal radius (full span)
        orbitRy: 1.2 * scale * rScale,   // near-zero vertical radius
      });
    }
  }

  // ── Landing gear: two short legs hanging off the belly ──
  const gearBases = [
    { bx: cx + bodyRx * 0.32 },
    { bx: cx - bodyRx * 0.32 },
  ];
  const perGear = Math.max(1, Math.floor(gearCount / 2));
  for (const g of gearBases) {
    for (let i = 0; i < perGear; i++) {
      const t = i / perGear;
      pts.push({
        x: g.bx + (Math.random() - 0.5) * 2 * scale,
        y: cy + bodyRy * 0.8 + t * gearH,
        layer: 'arm', // reuse arm styling for legs
        hubAngle: 0, hubCx: 0, hubCy: 0, orbitR: 0, orbitRy: 0,
      });
    }
  }

  // ── Ambient atmosphere: soft floating sparks around the craft. Compressed
  //    vertically so the overall cloud reads as "flying drone in a wide
  //    horizontal scene", matching the side-profile framing. ──
  for (let i = 0; i < ambientCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = (bodyRx + armLen + propLen) * (1.0 + Math.random() * 1.2);
    pts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.55,
      layer: 'ambient',
      hubAngle: 0, hubCx: 0, hubCy: 0, orbitR: 0, orbitRy: 0,
    });
  }

  return pts;
}

const DroneParticles = forwardRef(function DroneParticles({ exploding, paused = false }, ref) {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const explodeRef = useRef(false);
  const explodeStartRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useImperativeHandle(ref, () => ({
    getPositions() {
      return particlesRef.current.map(p => ({ x: p.x, y: p.y }));
    },
  }));

  useEffect(() => {
    if (exploding && !explodeRef.current) {
      explodeRef.current = true;
      explodeStartRef.current = performance.now();
      const particles = particlesRef.current;
      for (const p of particles) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 12;
        p.evx = Math.cos(angle) * speed + (Math.random() - 0.5) * 4;
        p.evy = Math.sin(angle) * speed + (Math.random() - 0.5) * 4;
      }
    }
    if (!exploding) {
      explodeRef.current = false;
      explodeStartRef.current = null;
    }
  }, [exploding]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.parentElement.clientWidth;
      h = canvas.parentElement.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const initParticles = () => {
      const scale = Math.min(w, h) / 420;
      const cx = w / 2;
      const cy = h / 2;
      const targets = generateDroneTargets(cx, cy, scale, PARTICLE_COUNT);

      particles = targets.map((t, i) => {
        const prev = particles[i];
        return {
          x: prev ? prev.x : t.x,
          y: prev ? prev.y : t.y,
          tx: t.x,
          ty: t.y,
          layer: t.layer,
          hubAngle: t.hubAngle,
          hubCx: t.hubCx,
          hubCy: t.hubCy,
          orbitR: t.orbitR,
          orbitRy: t.orbitRy || 0,
          vx: 0,
          vy: 0,
          size:
            t.layer === 'body' ? 2.8
            : t.layer === 'arm' ? 2.2
            : t.layer === 'prop' ? 1.6
            : 1,
          alpha:
            t.layer === 'ambient'
              ? 0.2 + Math.random() * 0.2
              : 0.55 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
        };
      });
      particlesRef.current = particles;
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };

    const EXPLODE_DURATION = 1200;

    const draw = (time) => {
      // While paused (e.g. during the intro overlay) skip all simulation
      // and drawing work, but keep a low-cost rAF alive so we can resume
      // immediately once the host flips `paused` back to false.
      if (pausedRef.current) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const t = time * 0.001;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const isExploding = explodeRef.current;
      const explodeElapsed = isExploding && explodeStartRef.current
        ? time - explodeStartRef.current
        : 0;
      const explodeProgress = Math.min(explodeElapsed / EXPLODE_DURATION, 1);

      const spinSpeed = 9; // rotor spins faster (and along an ellipse, not a
                         // disc), giving the visual impression of a blurred
                         // horizontal blade from the side.

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (isExploding) {
          p.evx = (p.evx || 0) * 0.98;
          p.evy = (p.evy || 0) * 0.98;
          p.x += p.evx || 0;
          p.y += p.evy || 0;

          const fadeAlpha = p.alpha * (1 - explodeProgress);
          if (fadeAlpha <= 0.01) continue;

          const sz = p.size * (1 - explodeProgress * 0.7);
          const twinkle = 0.75 + 0.25 * Math.sin(t * 3 + p.phase);
          const a = fadeAlpha * twinkle;

          let color;
          if (p.layer === 'body') color = `rgba(100, 200, 255, ${a})`;
          else if (p.layer === 'arm') color = `rgba(80, 180, 240, ${a * 0.9})`;
          else if (p.layer === 'prop') color = `rgba(0, 232, 150, ${a * 0.75})`;
          else color = `rgba(100, 200, 255, ${a * 0.35})`;

          ctx.beginPath();
          ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          let goalX, goalY;

          if (p.layer === 'prop') {
            const angle = p.hubAngle + t * spinSpeed;
            goalX = p.hubCx + Math.cos(angle) * p.orbitR;
            goalY = p.hubCy + Math.sin(angle) * p.orbitRy;
          } else {
            const floatX = Math.sin(t * 1.5 + p.phase) * 2;
            const floatY = Math.cos(t * 1.2 + p.phase * 1.3) * 2;
            goalX = p.tx + floatX;
            goalY = p.ty + floatY;
          }

          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (1 - dist / MOUSE_RADIUS) * 9;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }

          const stiffness = p.layer === 'prop' ? 0.06 : 0.035;
          p.vx += (goalX - p.x) * stiffness;
          p.vy += (goalY - p.y) * stiffness;
          p.vx *= 0.86;
          p.vy *= 0.86;
          p.x += p.vx;
          p.y += p.vy;

          const twinkle = 0.75 + 0.25 * Math.sin(t * 3 + p.phase);
          const a = p.alpha * twinkle;

          let color;
          if (p.layer === 'body') color = `rgba(100, 200, 255, ${a})`;
          else if (p.layer === 'arm') color = `rgba(80, 180, 240, ${a * 0.9})`;
          else if (p.layer === 'prop') color = `rgba(0, 232, 150, ${a * 0.75})`;
          else color = `rgba(100, 200, 255, ${a * 0.35})`;

          if (p.layer !== 'ambient') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color.replace(/[\d.]+\)$/, `${a * 0.1})`);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      if (!isExploding) {
        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          if (a.layer !== 'body' && a.layer !== 'arm') continue;
          for (let j = i + 1; j < particles.length; j++) {
            const b = particles[j];
            if (b.layer !== 'body' && b.layer !== 'arm') continue;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < CONNECT_DIST * CONNECT_DIST) {
              const alpha = (1 - Math.sqrt(d2) / CONNECT_DIST) * 0.15;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
              ctx.stroke();
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="p0-particles-canvas" />;
});

export default DroneParticles;
