import { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Page0Cover from './pages/Page0/Page0Cover';
import Page1Landing from './pages/Page1 overview/Page1Landing';
import Page2Entry from './pages/Page2 analysis/Page2Entry';
import Page2FullMap from './pages/Page2 analysis/Page2FullMap';
import Page3Friction from './pages/Page3 Point/Page3Friction';
import Page4Demand from './pages/Page4/Page4Demand';
import Page5Strategy from './pages/Page5/Page5Strategy';
import Page6Summary from './pages/Page6/Page6Summary';
import './App.css';

const NAV_PAGES = [
  { id: 0, label: 'Cover' },
  { id: 1, label: 'Overview' },
  { id: 2, label: 'Friction' },
  { id: 3, label: 'Sites' },
  { id: 4, label: 'Demand' },
  { id: 5, label: 'Strategy' },
  { id: 6, label: 'Summary' },
];

const NAV_LINKS = [
  { target: 'page-1', label: 'Overview' },
  { target: 'page-2', label: 'Analysis' },
  { target: 'page-3', label: 'Status Quo' },
  { target: 'page-4', label: 'Optimization' },
  { target: 'page-5', label: 'Strategy' },
  { target: 'page-6', label: 'Summary' },
];

function GlobalTopbar() {
  const [isOnPage0, setIsOnPage0] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const page0 = document.getElementById('page-0');
    if (!page0) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnPage0(entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(page0);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <div
        className={`global-nav-overlay ${menuOpen ? 'visible' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <button
        className={`global-menu-toggle ${menuOpen ? 'open' : ''} ${isOnPage0 ? 'on-page0' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span /><span /><span />
      </button>
      <nav
        className={`global-topbar-nav ${menuOpen ? 'open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.target}
            href={`#${link.target}`}
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              document.getElementById(link.target)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </>
  );
}

function PageNav({ pages, onNavigate }) {
  const [activeId, setActiveId] = useState(0);

  useEffect(() => {
    const observers = pages
      .map((p) => {
        const el = document.getElementById(`page-${p.id}`);
        if (!el) return null;
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.intersectionRatio > 0.5) setActiveId(p.id);
          },
          { threshold: [0, 0.5, 1] }
        );
        obs.observe(el);
        return obs;
      })
      .filter(Boolean);
    return () => observers.forEach((o) => o.disconnect());
  }, [pages]);

  return (
    <nav className="page-nav" aria-label="Section navigation">
      {pages.map((p) => (
        <button
          key={p.id}
          className={`nav-dot ${activeId === p.id ? 'active' : ''}`}
          onClick={() => onNavigate(p.id)}
          aria-label={p.label}
          aria-current={activeId === p.id ? 'true' : undefined}
        >
          <span className="nav-dot-label">{p.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MainNarrative() {
  const [p2Key, setP2Key] = useState(0);

  const handleNavClick = useCallback((id) => {
    if (id === 2) {
      setP2Key(k => k + 1);
    }
    setTimeout(() => {
      const el = document.getElementById(`page-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  return (
    <div className="app">
      <GlobalTopbar />

      <PageNav pages={NAV_PAGES} onNavigate={handleNavClick} />

      <Page0Cover />
      <Page1Landing />
      <Page2Entry key={p2Key} />
      <Page3Friction />
      <Page4Demand />
      <Page5Strategy />
      <Page6Summary />
    </div>
  );
}

function GlobalCursor() {
  const wrapRef = useRef(null);
  const ringRef = useRef(null);
  const dotRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!wrap || !ring || !dot) return;

    let hovering = false;

    const onMove = (e) => {
      const t = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      wrap.style.transform = t;
      dot.style.transform = t;
    };

    const onMouseOver = (e) => {
      const next = !!e.target.closest?.(
        'a, button, input, textarea, select, label, [role="button"]'
      );
      if (next === hovering) return;
      hovering = next;
      ring.classList.toggle('hovering', next);
    };

    const onMouseDown = () => ring.classList.add('pressed');
    const onMouseUp = () => ring.classList.remove('pressed');

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseover', onMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, []);

  return (
    <>
      <div className="global-cursor" ref={wrapRef}>
        <div className="global-cursor-ring" ref={ringRef} />
      </div>
      <div className="global-cursor-dot" ref={dotRef} />
    </>
  );
}

export default function App() {
  return (
    <>
      <GlobalCursor />
      <Routes>
        <Route path="/" element={<MainNarrative />} />
        <Route path="/analysis" element={<Page2FullMap />} />
      </Routes>
    </>
  );
}
