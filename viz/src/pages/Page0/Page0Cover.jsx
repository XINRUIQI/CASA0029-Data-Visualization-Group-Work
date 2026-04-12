import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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

const NAV_LINKS = [
  { href: '#page-1', label: 'Overview' },
  { href: '#page-2', label: 'Status Quo' },
  { href: '#page-3', label: 'Analysis' },
  { href: '#page-4', label: 'Optimization' },
  { href: '#page-5', label: 'Strategy' },
  { href: '#page-6', label: 'Summary' },
];

export default function Page0Cover() {
  const sectionRef = useRef(null);
  const cursorRef = useRef(null);
  const cursorDotRef = useRef(null);
  const heroContentRef = useRef(null);
  const [activeInfo, setActiveInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

      tl.from('.p0-topbar', { y: -40, opacity: 0, duration: 0.8 }, 0.2)
        .from('.p0-title-small', { y: 40, opacity: 0, duration: 0.9 }, 0.4)
        .from('.p0-title-big', { y: 60, opacity: 0, duration: 1 }, 0.6)
        .from('.p0-divider', { scaleX: 0, opacity: 0, duration: 0.8 }, 0.9)
        .from('.p0-subtitle', { y: 30, opacity: 0, duration: 0.8 }, 1.0)
        .from('.p0-cta', { y: 20, opacity: 0, duration: 0.7 }, 1.2)
        .from('.p0-sidebar-btn', {
          x: -30,
          opacity: 0,
          duration: 0.5,
          stagger: 0.12,
        }, 1.0)
        .from('.p0-scroll-hint', { opacity: 0, duration: 0.6 }, 1.5);

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

      gsap.to('.p0-bg-video', {
        scale: 1.15,
        ease: 'none',
        scrollTrigger: {
          trigger: '#page-0',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.p0-topbar', {
        y: -60,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#page-0',
          start: '20% top',
          end: '50% top',
          scrub: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="page-0" className="page page-0" ref={sectionRef}>
      {/* ── custom cursor ── */}
      <div className="p0-cursor" ref={cursorRef} />
      <div className="p0-cursor-dot" ref={cursorDotRef} />

      {/* ── background video ── */}
      <div className="p0-bg-wrap">
        <video
          className="p0-bg-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/shenzhen-poster.jpg"
        >
          <source src="/shenzhen-drone-bg.mp4" type="video/mp4" />
        </video>
        <div className="p0-bg-overlay" />
        <div className="p0-bg-grain" />
      </div>

      {/* ── top bar ── */}
      <header className="p0-topbar">
        <div className="p0-topbar-logo">
          <span className="p0-logo-mark">◈</span>
          <span className="p0-logo-text">CASA0029</span>
        </div>
        <nav className={`p0-topbar-nav ${menuOpen ? 'open' : ''}`}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <button
          className={`p0-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </header>

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
          <span className="p0-title-small">When the sky becomes infrastructure</span>
          <span className="p0-title-big">
            Drones <span className="p0-accent">Reshape</span> the City
          </span>
        </h1>

        <div className="p0-divider" />

        <p className="p0-subtitle">
          Shenzhen — China&rsquo;s pioneer in low-altitude economy
          <br />
          483 launch pads &middot; 250 routes &middot; 776 k cargo flights in 2024
        </p>

        <a href="#page-1" className="p0-cta">
          <span>Explore the story</span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 3v12M4 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* ── scroll hint ── */}
      <div className="p0-scroll-hint">
        <span className="p0-scroll-line" />
        <span className="p0-scroll-text">scroll</span>
      </div>
    </section>
  );
}
