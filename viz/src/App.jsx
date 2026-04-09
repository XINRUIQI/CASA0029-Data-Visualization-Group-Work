import Page0Cover from './pages/Page0/Page0Cover';
import Page1Landing from './pages/Page1 overview/Page1Landing';
import Page2Friction from './pages/Page2 point/Page2Friction';
import Page3Routes from './pages/Page3 analysis/Page3Routes';
import Page4Demand from './pages/Page4/Page4Demand';
import Page5Strategy from './pages/Page5/Page5Strategy';
import Page6Summary from './pages/Page6/Page6Summary';
import './App.css';

const PAGES = [
  { id: 0, label: 'Cover' },
  { id: 1, label: 'Overview' },
  { id: 2, label: 'Points' },
  { id: 3, label: 'Analysis' },
  { id: 4, label: 'Demand' },
  { id: 5, label: 'Strategy' },
  { id: 6, label: 'Summary' },
];

export default function App() {
  return (
    <div className="app">
      <nav className="page-nav">
        {PAGES.map(p => (
          <a key={p.id} href={`#page-${p.id}`} className="nav-dot" title={p.label}>
            <span>{p.id}</span>
          </a>
        ))}
      </nav>

      <Page0Cover />
      <Page1Landing />
      <Page2Friction />
      <Page3Routes />
      <Page4Demand />
      <Page5Strategy />
      <Page6Summary />
    </div>
  );
}
