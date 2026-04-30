import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import EnterTransition from './EnterTransition';
import IntroOverlay from './IntroOverlay';
import './Page0.css';

gsap.registerPlugin(ScrollTrigger);

// Module-level flag: remembers whether the Page0 intro overlay has already
// played during this tab's lifetime. Unlike sessionStorage, it is reset on
// full page reload, so a real "first visit" always gets the intro — but an
// in-app route round-trip (e.g. Page2FullMap's "Back to Main") does not
// replay it.
let introPlayedInSession = false;

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

  const [transitioning, setTransitioning] = useState(false);
  const [spawnPoints, setSpawnPoints] = useState(null);
  const isFirstVisit = useRef(!introPlayedInSession);
  const [introDone, setIntroDone] = useState(() => introPlayedInSession);

  const handleIntroDone = useCallback(() => {
    setIntroDone(true);
  }, []);

  // Flip the module flag as soon as the intro finishes (or is skipped) so
  // subsequent remounts of Page0Cover within the same tab skip the overlay.
  useEffect(() => {
    if (introDone) introPlayedInSession = true;
  }, [introDone]);

  // Safety fallback: ensure intro completes even if animation fails.
  useEffect(() => {
    if (introDone) return;
    const timer = setTimeout(() => setIntroDone(true), 5000);
    return () => clearTimeout(timer);
  }, [introDone]);

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

  /* ── GSAP entrance animations (only on first visit) ── */
  useEffect(() => {
    if (!introDone) return;

    const ctx = gsap.context(() => {
      if (isFirstVisit.current) {
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
          .from('.p0-subtitle', {
            y: 24,
            opacity: 0,
            duration: 0.5,
          }, 0.5)
          .from('.p0-enter-btn', {
            y: 20,
            opacity: 0,
            scale: 0.9,
            duration: 0.5,
            ease: 'back.out(1.5)',
          }, 0.95)
          .from('.p0-scroll-hint', { opacity: 0, duration: 0.4 }, 1.1);
      }

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
      {/* ── background layers: video ── */}
      <div className="p0-bg-wrap">
        <video
          ref={videoRef}
          className="p0-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src="https://res.cloudinary.com/flyzipline/video/upload/q_auto:best,f_auto/v1776784625/homepage_hero_desktop_21042026_rw2jvh.mp4"
        />
        <div className="p0-bg-overlay" />
        <div className="p0-bg-grain" />
      </div>

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
        <div className="p0-hero-title-group">
          <h1 className="p0-title">
            <span className="p0-title-big">
              <span className="p0-word-light">Delivery,</span>
              {' '}
              <span className="p0-word-bold">elevated!</span>
            </span>
          </h1>
        </div>

        <div className="p0-hero-bottom-group">
          <p className="p0-subtitle">
            <span className="p0-sub-light">Exploring how drone take-off and landing sites can be optimally located<br />in <span className="p0-highlight">Shenzhen</span> through multi-objective spatial optimisation.</span>
          </p>
          <button className={`p0-enter-btn ${transitioning ? 'p0-enter-hide' : ''}`} onClick={handleEnter}>
            <span className="p0-enter-text">Enter</span>
            <span className="p0-enter-ring" />
          </button>
        </div>
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
