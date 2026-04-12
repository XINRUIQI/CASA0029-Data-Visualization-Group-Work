import { Routes, Route } from 'react-router-dom';
import Page0Cover from './pages/Page0/Page0Cover';
import Page1Landing from './pages/Page1 overview/Page1Landing';
import Page2Sites from './pages/Page2 sites/Page2Sites';
import Page3Entry from './pages/Page3 analysis/Page3Entry';
import Page3FullMap from './pages/Page3 analysis/Page3FullMap';
import Page4Demand from './pages/Page4/Page4Demand';
import Page5Strategy from './pages/Page5/Page5Strategy';
import Page6Summary from './pages/Page6/Page6Summary';
import './App.css';

const NAV_PAGES = [
  { id: 0, label: 'Cover' },
  { id: 1, label: 'Overview' },
  { id: 2, label: 'Sites' },
  { id: 3, label: 'Friction' },
  { id: 4, label: 'Demand' },
  { id: 5, label: 'Strategy' },
  { id: 6, label: 'Summary' },
];

function scrollToPage(id) {
  const el = document.getElementById(`page-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function MainNarrative() {
  return (
    <div className="app">
      <nav className="page-nav">
        {NAV_PAGES.map(p => (
          <button
            key={p.id}
            className="nav-dot"
            title={p.label}
            onClick={() => scrollToPage(p.id)}
          >
            <span>{p.id}</span>
          </button>
        ))}
      </nav>

      <Page0Cover />
      <Page1Landing />
      <Page2Sites />
      <Page3Entry />
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
      <Route path="/analysis" element={<Page3FullMap />} />
    </Routes>
  );
}
