import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Page0Cover from './pages/Page0/Page0Cover';
import './App.css';

// Route-level code-splitting: only Page0 is in the initial bundle.
// Each of Page1-6 is split into its own chunk and is mounted lazily
// once its viewport-anchor section is close to being scrolled into view.
const Page1Landing   = lazy(() => import('./pages/Page1 overview/Page1Landing'));
const Page2Entry     = lazy(() => import('./pages/Page2 analysis/Page2Entry'));
const Page2FullMap   = lazy(() => import('./pages/Page2 analysis/Page2FullMap'));
const Page3Friction  = lazy(() => import('./pages/Page3 Point/Page3Friction'));
const Page4Demand    = lazy(() => import('./pages/Page4/Page4Demand'));
const Page5Strategy  = lazy(() => import('./pages/Page5/Page5Strategy'));
const Page6Summary   = lazy(() => import('./pages/Page6/Page6Summary'));

/**
 * LazyPage: renders a full-viewport placeholder <section id="page-N" /> so
 * anchor scroll / nav-dot IntersectionObservers still work, and only mounts
 * the real (heavy) page component once the placeholder is about to enter the
 * viewport. Once mounted, it stays mounted (one-way latch) so scroll position
 * and internal state are preserved.
 *
 * rootMargin is generous (default 600px) so the next page is warmed up a
 * little before the user actually reaches it.
 */
function LazyPage({ pageId, component: Component, rootMargin = '600px', mountKey }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  if (visible) {
    return (
      <Suspense fallback={<section id={pageId} className="page lazy-placeholder" />}>
        <Component key={mountKey} />
      </Suspense>
    );
  }

  return <section id={pageId} className="page lazy-placeholder" ref={ref} />;
}

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
    // Because Page1-6 are lazy-mounted (the placeholder <section id="page-N" />
    // is replaced by the real page section once it scrolls into view), the
    // DOM nodes we originally observed can be detached. We therefore (1) bind
    // once on mount to whatever exists, and (2) re-bind whenever a page-*
    // anchor node is added or removed under <body>.
    const observed = new Map(); // pageId -> { el, obs }

    const bindAll = () => {
      for (const p of pages) {
        const el = document.getElementById(`page-${p.id}`);
        const current = observed.get(p.id);
        if (current && current.el === el) continue;
        if (current) current.obs.disconnect();
        if (!el) {
          observed.delete(p.id);
          continue;
        }
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.intersectionRatio > 0.5) setActiveId(p.id);
          },
          { threshold: [0, 0.5, 1] }
        );
        obs.observe(el);
        observed.set(p.id, { el, obs });
      }
    };

    bindAll();

    const mo = new MutationObserver((mutations) => {
      const touchesPageAnchor = mutations.some((m) => {
        const check = (n) =>
          n.nodeType === 1 && typeof n.id === 'string' && n.id.startsWith('page-');
        for (const n of m.addedNodes) if (check(n)) return true;
        for (const n of m.removedNodes) if (check(n)) return true;
        return false;
      });
      if (touchesPageAnchor) bindAll();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      observed.forEach(({ obs }) => obs.disconnect());
      observed.clear();
    };
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
      <LazyPage pageId="page-1" component={Page1Landing} />
      <LazyPage pageId="page-2" component={Page2Entry} mountKey={p2Key} />
      <LazyPage pageId="page-3" component={Page3Friction} />
      <LazyPage pageId="page-4" component={Page4Demand} />
      <LazyPage pageId="page-5" component={Page5Strategy} />
      <LazyPage pageId="page-6" component={Page6Summary} />
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

    // Synchronously write the transform. We use `pointermove` instead of
    // `mousemove` because it is not throttled to vsync and pairs with
    // `getCoalescedEvents` to give us the freshest physical pointer sample
    // the browser has received, which visibly reduces "cursor lag" when
    // the main thread is busy.
    const onPointerMove = (e) => {
      let cx = e.clientX;
      let cy = e.clientY;
      if (typeof e.getCoalescedEvents === 'function') {
        const list = e.getCoalescedEvents();
        if (list && list.length) {
          const last = list[list.length - 1];
          cx = last.clientX;
          cy = last.clientY;
        }
      }
      const t = `translate3d(${cx}px, ${cy}px, 0)`;
      wrap.style.transform = t;
      dot.style.transform = t;
    };

    const onPointerOver = (e) => {
      const next = !!e.target.closest?.(
        'a, button, input, textarea, select, label, [role="button"]'
      );
      if (next === hovering) return;
      hovering = next;
      ring.classList.toggle('hovering', next);
    };

    const onPointerDown = () => ring.classList.add('pressed');
    const onPointerUp = () => ring.classList.remove('pressed');

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointerover', onPointerOver, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerover', onPointerOver);
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
        <Route
          path="/analysis"
          element={
            <Suspense fallback={<div className="lazy-placeholder" />}>
              <Page2FullMap />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}
