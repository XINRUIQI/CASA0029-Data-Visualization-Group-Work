import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import EnterTransition from './EnterTransition';
import IntroOverlay from './IntroOverlay';
import './Page0.css';

gsap.registerPlugin(ScrollTrigger);

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
  const heroContentRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);
  const [activeInfo, setActiveInfo] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [spawnPoints, setSpawnPoints] = useState(null);
  const [introDone, setIntroDone] = useState(false);

  const handleIntroDone = useCallback(() => {
    setIntroDone(true);
  }, []);

  // Safety fallback: ensure intro completes even if animation fails.
  // IntroOverlay's natural run-time is ~7.1s (900+2700+1800+1700), so we
  // give it a comfortable margin before forcing the page forward.
  useEffect(() => {
    const timer = setTimeout(() => setIntroDone(true), 9000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = useCallback(() => {
    // Drone particles were removed, so there are no source points to sample.
    // EnterTransition already falls back to bursting from screen center.
    setSpawnPoints(null);
    setTransitioning(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setTransitioning(false);
    document.getElementById('page-1')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* ── GSAP entrance animations (wait for intro) ── */
  useEffect(() => {
    if (!introDone) return;

    const ctx = gsap.context(() => {
      // Entrance choreography, all kicked off the moment the intro overlay
      // finishes. Pace is deliberately quick so the hero reads as a single
      // beat: Delivery → elevated! → subtitle (as one line) → Enter.
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.p0-word-light', {
          x: -40,
          opacity: 0,
          duration: 0.45,
        }, 0)
        .from('.p0-word-bold', {
          x: 40,
          opacity: 0,
          duration: 0.45,
        }, 0.18)
        // Bring the whole subtitle in as one unit (main caption + "in ShenZhen")
        .from('.p0-subtitle', {
          y: 24,
          opacity: 0,
          duration: 0.5,
        }, 0.5)
        // Enter button finally pops in
        .from('.p0-enter-btn', {
          y: 20,
          opacity: 0,
          scale: 0.9,
          duration: 0.5,
          ease: 'back.out(1.5)',
        }, 0.95)
        // Peripheral chrome — sidebar + scroll hint — fade in alongside
        // the button so nothing ever feels like it's still animating after
        // the user already sees the CTA.
        .from('.p0-sidebar-btn', {
          x: -20,
          opacity: 0,
          duration: 0.4,
          stagger: 0.08,
        }, 0.6)
        .from('.p0-scroll-hint', { opacity: 0, duration: 0.4 }, 1.1);

      gsap.to('.p0-hero-content', {
        y: -80,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [introDone]);

  return (
    <section id="page-0" className="page page-0" ref={sectionRef}>
      {/* ── background layers: video only ── */}
      <div className="p0-bg-wrap">
        <video
          ref={videoRef}
          className="p0-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src={`${import.meta.env.BASE_URL}cover-bg.mp4`}
          poster={`${import.meta.env.BASE_URL}shenzhen-poster.jpg`}
        />
        <div className="p0-bg-overlay" />
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

      {/* ── intro mask overlay ── */}
      {!introDone && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'pointer' }}
          onClick={handleIntroDone}
          title="Click to skip"
        >
          <IntroOverlay onComplete={handleIntroDone} />
        </div>
      )}

      {/* ── hero content ── */}
      <div className={`p0-hero-content ${introDone ? '' : 'p0-hidden'}`} ref={heroContentRef}>
        <h1 className="p0-title">
          <span className="p0-title-big">
            <span className="p0-word-light">Delivery,</span>
            {' '}
            <span className="p0-word-bold p0-glitch" data-text="elevated!">elevated!</span>
          </span>
        </h1>

        <p className="p0-subtitle">
          <span className="p0-sub-light">Drone Delivery and the Rise of a New Urban Mobility System</span>
          {' '}
          <span className="p0-sub-shenzhen-wrap">
            <span className="p0-sub-in">in</span>
            {' '}
            <span className="p0-sub-boxed">ShenZhen</span>
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
