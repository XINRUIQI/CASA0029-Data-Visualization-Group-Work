import { useEffect, useRef } from 'react';

const HEX_RADIUS = 22;
const SQRT3 = Math.sqrt(3);
const MOUSE_RADIUS = 180;

const PALETTE = [
  [90, 137, 166],  // #5A89A6 中天蓝
  [46, 94, 126],   // #2E5E7E 深天蓝
  [168, 196, 212], // #A8C4D4 浅天蓝
  [232, 168, 139], // #E8A88B 暖粉橙
];

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function pickColor(seed) {
  const idx = seed % (PALETTE.length - 1);
  const frac = (seed * 0.618) % 1;
  return lerpColor(PALETTE[idx], PALETTE[idx + 1], frac);
}

export default function HexGridBg() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, hexes = [];

    const buildGrid = () => {
      hexes = [];
      const colW = HEX_RADIUS * SQRT3;
      const rowH = HEX_RADIUS * 1.5;
      const cols = Math.ceil(w / colW) + 2;
      const rows = Math.ceil(h / rowH) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const offset = row % 2 === 0 ? 0 : colW * 0.5;
          const cx = col * colW + offset;
          const cy = row * rowH;
          const seed = (row * 137 + col * 97) & 0xffff;
          const color = pickColor(seed % 12);

          hexes.push({
            cx, cy, color,
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.6,
            baseAlpha: 0.03 + Math.random() * 0.12,
            pulseAmp: 0.04 + Math.random() * 0.1,
          });
        }
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.parentElement.clientWidth;
      h = canvas.parentElement.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    const drawHex = (cx, cy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
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

    const draw = (time) => {
      ctx.clearRect(0, 0, w, h);
      const t = time * 0.001;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (let i = 0; i < hexes.length; i++) {
        const hex = hexes[i];
        const pulse = Math.sin(t * hex.speed + hex.phase) * 0.5 + 0.5;
        let alpha = hex.baseAlpha + hex.pulseAmp * pulse;

        // mouse proximity glow
        const dx = hex.cx - mx;
        const dy = hex.cy - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const proximity = 1 - dist / MOUSE_RADIUS;
          alpha += proximity * 0.35;
        }

        alpha = Math.min(alpha, 0.6);

        const [r, g, b] = hex.color;

        // fill
        drawHex(hex.cx, hex.cy, HEX_RADIUS - 1);
        ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
        ctx.fill();

        // stroke
        drawHex(hex.cx, hex.cy, HEX_RADIUS);
        ctx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // bright glow for high-alpha cells
        if (alpha > 0.2) {
          drawHex(hex.cx, hex.cy, HEX_RADIUS + 2);
          ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${(alpha - 0.2) * 0.15})`;
          ctx.fill();
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
