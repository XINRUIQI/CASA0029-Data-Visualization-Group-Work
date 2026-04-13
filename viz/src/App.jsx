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
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimer = useRef(null);

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

  const visible = isOnPage0 || hovered || menuOpen;

  const handleMouseEnter = () => {
    clearTimeout(hideTimer.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setHovered(false), 300);
  };

  return (
    <>
      {!isOnPage0 && (
        <div
          className="topbar-trigger-zone"
          onMouseEnter={handleMouseEnter}
        />
      )}
      <header
        className={`global-topbar ${visible ? 'visible' : ''} ${isOnPage0 ? 'on-page0' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="global-topbar-spacer" />
        <nav className={`global-topbar-nav ${menuOpen ? 'open' : ''}`}>
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
        <button
          className={`global-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </header>
    </>
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

      <nav className="page-nav">
        {NAV_PAGES.map(p => (
          <button
            key={p.id}
            className="nav-dot"
            title={p.label}
            onClick={() => handleNavClick(p.id)}
          >
            <span>{p.id}</span>
          </button>
        ))}
      </nav>

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainNarrative />} />
      <Route path="/analysis" element={<Page2FullMap />} />
    </Routes>
  );
}
