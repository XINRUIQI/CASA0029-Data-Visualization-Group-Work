import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import DroneParticles from './DroneParticles';
import EnterTransition from './EnterTransition';
import './Page0.css';

gsap.registerPlugin(ScrollTrigger);

function SplitChars({ text, className }) {
  return text.split('').map((char, i) => (
    <span
      key={i}
      className={`p0-char ${className || ''}`}
      style={{ display: char === ' ' ? 'inline' : 'inline-block' }}
    >
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));
}

const INFO_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 7h8M6 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'About This Project',
    content:
      'This project explores how drone logistics is reshaping urban infrastructure in Shenzhen — one of the world\'s first cities to operate large-scale urban drone delivery networks.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Data Sources',
    content:
      'Meituan drone delivery data (2024): 483 launch pads, 250 routes, 776,000 cargo flights. POI data from Gaode Map API. Administrative boundaries from Shenzhen Open Data.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 16c0-2 1.5-3 3-3s3 1 3 3M10 16c0-2 1.5-3 3-3s3 1 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Team',
    content: 'CASA0029 Data Visualization — UCL Bartlett Centre for Advanced Spatial Analysis.',
  },
];

export default function Page0Cover() {
  const sectionRef = useRef(null);
  const cursorRef = useRef(null);
  const cursorDotRef = useRef(null);
  const heroContentRef = useRef(null);
  const droneRef = useRef(null);
  const [activeInfo, setActiveInfo] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [spawnPoints, setSpawnPoints] = useState(null);

  const handleEnter = useCallback(() => {
    const positions = droneRef.current?.getPositions?.() || [];
    setSpawnPoints(positions);
    setTransitioning(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setTransitioning(false);
    document.getElementById('page-1')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* ── custom cursor ── */
  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = cursorDotRef.current;
    if (!cursor || !dot) return;

    const onMove = (e) => {
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.6,
        ease: 'power3.out',
      });
      gsap.to(dot, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
      });
    };

    const onEnterInteractive = () => {
      gsap.to(cursor, { scale: 2.2, opacity: 0.5, duration: 0.3 });
    };
    const onLeaveInteractive = () => {
      gsap.to(cursor, { scale: 1, opacity: 1, duration: 0.3 });
    };

    window.addEventListener('mousemove', onMove);

    const interactives = sectionRef.current?.querySelectorAll(
      'a, button, .p0-topbar-nav a'
    );
    interactives?.forEach((el) => {
      el.addEventListener('mouseenter', onEnterInteractive);
      el.addEventListener('mouseleave', onLeaveInteractive);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
      interactives?.forEach((el) => {
        el.removeEventListener('mouseenter', onEnterInteractive);
        el.removeEventListener('mouseleave', onLeaveInteractive);
      });
    };
  }, []);

  /* ── GSAP entrance animations ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.p0-word-light', {
          x: -60,
          opacity: 0,
          duration: 0.8,
          ease: 'power4.out',
        }, 0.4)
        .from('.p0-word-bold', {
          x: 60,
          opacity: 0,
          duration: 0.8,
          ease: 'power4.out',
        }, 0.55)
        .from('.p0-deco-dots', { opacity: 0, x: 20, duration: 0.6 }, 1.0)
        .from('.p0-sub-light', {
          y: 30,
          opacity: 0,
          duration: 0.7,
        }, 1.1)
        .from('.p0-sub-boxed', {
          scaleX: 0,
          opacity: 0,
          duration: 0.6,
          ease: 'back.out(1.7)',
        }, 1.4)
        .from('.p0-deco-squares', { opacity: 0, x: 15, duration: 0.5 }, 1.6)
        .from('.p0-sidebar-btn', {
          x: -30,
          opacity: 0,
          duration: 0.5,
          stagger: 0.12,
        }, 1.2)
        .from('.p0-scroll-hint', { opacity: 0, duration: 0.6 }, 2.0);

      /* ── ScrollTrigger: parallax + fade on scroll ── */
      gsap.to('.p0-hero-content', {
        y: -80,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#page-0',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.p0-particles-canvas', {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#page-0',
          start: '30% top',
          end: '70% top',
          scrub: true,
        },
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="page-0" className="page page-0" ref={sectionRef}>
      {/* ── custom cursor ── */}
      <div
        className="p0-cursor"
        ref={cursorRef}
        style={{ background: `url(${import.meta.env.BASE_URL}drone-cursor.svg) center/60% no-repeat` }}
      />
      <div className="p0-cursor-dot" ref={cursorDotRef} />

      {/* ── background layers: video + particles ── */}
      <div className="p0-bg-wrap">
        <video
          className="p0-bg-video"
          autoPlay
          muted
          loop
          playsInline
          poster={`${import.meta.env.BASE_URL}shenzhen-poster.jpg`}
        >
          <source src={`${import.meta.env.BASE_URL}shenzhen-drone-bg.mp4`} type="video/mp4" />
        </video>
        <div className="p0-bg-overlay" />
        <DroneParticles ref={droneRef} exploding={transitioning} />
        <div className="p0-bg-grain" />
      </div>

      {/* ── sidebar info buttons ── */}
      <aside className="p0-sidebar">
        {INFO_ITEMS.map((item, i) => (
          <button
            key={i}
            className={`p0-sidebar-btn ${activeInfo === i ? 'active' : ''}`}
            onClick={() => setActiveInfo(activeInfo === i ? null : i)}
            aria-label={item.title}
          >
            {item.icon}
          </button>
        ))}
      </aside>

      {/* ── sidebar popup ── */}
      {activeInfo !== null && (
        <div className="p0-sidebar-popup" key={activeInfo}>
          <button
            className="p0-popup-close"
            onClick={() => setActiveInfo(null)}
            aria-label="Close"
          >
            ×
          </button>
          <h3 className="p0-popup-title">{INFO_ITEMS[activeInfo].title}</h3>
          <p className="p0-popup-body">{INFO_ITEMS[activeInfo].content}</p>
        </div>
      )}

      {/* ── hero content ── */}
      <div className="p0-hero-content" ref={heroContentRef}>
        <h1 className="p0-title">
          <span className="p0-title-big">
            <span className="p0-word-light">Delivery,</span>
            {' '}
            <span className="p0-word-bold p0-glitch" data-text="elevated!">elevated!</span>
          </span>
          <span className="p0-deco-dots" aria-hidden="true">
            <span /><span /><span /><span />
          </span>
        </h1>

        <p className="p0-subtitle">
          <span className="p0-sub-light">Drone Delivery and the Rise of a New Urban Mobility System in</span>
          {' '}
          <span className="p0-sub-boxed">ShenZhen</span>
          <span className="p0-deco-squares" aria-hidden="true">
            <span /><span /><span />
          </span>
        </p>

        <button className={`p0-enter-btn ${transitioning ? 'p0-enter-hide' : ''}`} onClick={handleEnter}>
          <span className="p0-enter-text">Enter</span>
          <span className="p0-enter-ring" />
        </button>
      </div>

      <EnterTransition active={transitioning} spawnPoints={spawnPoints} onComplete={handleTransitionComplete} />

      {/* ── scroll hint ── */}
      <div className="p0-scroll-hint">
        <span className="p0-scroll-line" />
        <span className="p0-scroll-text">scroll</span>
      </div>
    </section>
  );
}
