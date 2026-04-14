import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const PARTICLE_COUNT = 1000;
const CONNECT_DIST = 55;
const MOUSE_RADIUS = 150;

function generateDroneTargets(cx, cy, scale, count) {
  const armLen = 105 * scale;
  const bodyRx = 36 * scale;
  const bodyRy = 22 * scale;
  const propR = 36 * scale;
  const armWidth = 7 * scale;
  const armAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

  const pts = [];
  const bodyCount = Math.floor(count * 0.18);
  const armCount = Math.floor(count * 0.18);
  const propCount = Math.floor(count * 0.46);
  const ambientCount = count - bodyCount - armCount - propCount;

  // body — dense filled ellipse
  for (let i = 0; i < bodyCount; i++) {
    const a = (Math.PI * 2 * i) / bodyCount;
    const r = Math.sqrt(Math.random());
    pts.push({
      x: cx + Math.cos(a) * bodyRx * r,
      y: cy + Math.sin(a) * bodyRy * r,
      layer: 'body',
      hubAngle: 0,
      hubCx: 0,
      hubCy: 0,
      orbitR: 0,
    });
  }

  // arms — thick lines
  const perArm = Math.floor(armCount / 4);
  for (const angle of armAngles) {
    for (let i = 0; i < perArm; i++) {
      const t = (i / perArm) * 0.92 + 0.08;
      const perpAngle = angle + Math.PI / 2;
      const offset = (Math.random() - 0.5) * armWidth;
      pts.push({
        x: cx + Math.cos(angle) * armLen * t + Math.cos(perpAngle) * offset,
        y: cy + Math.sin(angle) * armLen * t + Math.sin(perpAngle) * offset,
        layer: 'arm',
        hubAngle: 0,
        hubCx: 0,
        hubCy: 0,
        orbitR: 0,
      });
    }
  }

  // propellers — particles with orbit data so they can spin
  const perProp = Math.floor(propCount / 4);
  for (const angle of armAngles) {
    const hcx = cx + Math.cos(angle) * armLen;
    const hcy = cy + Math.sin(angle) * armLen;
    for (let i = 0; i < perProp; i++) {
      const a = (Math.PI * 2 * i) / perProp;
      const r = Math.sqrt(Math.random()) * propR;
      pts.push({
        x: hcx + Math.cos(a) * r,
        y: hcy + Math.sin(a) * r,
        layer: 'prop',
        hubAngle: a,
        hubCx: hcx,
        hubCy: hcy,
        orbitR: r,
      });
    }
  }

  // ambient floating particles
  for (let i = 0; i < ambientCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = (armLen + propR) * (1.15 + Math.random() * 1.3);
    pts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      layer: 'ambient',
      hubAngle: 0,
      hubCx: 0,
      hubCy: 0,
      orbitR: 0,
    });
  }

  return pts;
}

const DroneParticles = forwardRef(function DroneParticles({ exploding }, ref) {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const explodeRef = useRef(false);
  const explodeStartRef = useRef(null);

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
          x: prev ? prev.x : cx + (Math.random() - 0.5) * w,
          y: prev ? prev.y : cy + (Math.random() - 0.5) * h,
          tx: t.x,
          ty: t.y,
          layer: t.layer,
          hubAngle: t.hubAngle,
          hubCx: t.hubCx,
          hubCy: t.hubCy,
          orbitR: t.orbitR,
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
      ctx.clearRect(0, 0, w, h);
      const t = time * 0.001;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const isExploding = explodeRef.current;
      const explodeElapsed = isExploding && explodeStartRef.current
        ? time - explodeStartRef.current
        : 0;
      const explodeProgress = Math.min(explodeElapsed / EXPLODE_DURATION, 1);

      const spinSpeed = 2.5;

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
            goalY = p.hubCy + Math.sin(angle) * p.orbitR;
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
