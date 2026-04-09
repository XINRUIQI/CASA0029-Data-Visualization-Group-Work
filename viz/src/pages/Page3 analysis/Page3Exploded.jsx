import './Page3Exploded.css';

const LAYERS = [
  { id: 'flight', label: 'Flight Path', color: '#00ccff', icon: '✈',
    desc: 'Direct air route from origin to destination. No ground constraints.' },
  { id: 'launch', label: 'Launch Pad', color: '#00e896', icon: '🛬',
    desc: 'Rooftop or ground-level pad for takeoff/landing. Requires 10m² clear space.' },
  { id: 'building', label: 'Buildings', color: '#666', icon: '🏢',
    desc: 'Urban morphology creates depth, enclosed courtyards, and height obstacles.' },
  { id: 'barrier', label: 'Barriers', color: '#ffa028', icon: '🚧',
    desc: 'Water, railways, expressways — impassable at ground level without detour.' },
  { id: 'road', label: 'Road Network', color: '#ff5050', icon: '🛤',
    desc: 'Ground routes must follow roads, wait at signals, queue in traffic.' },
  { id: 'service', label: 'Service Area', color: '#c864ff', icon: '📍',
    desc: 'POI demand zone — restaurants, offices, residences needing delivery.' },
];

export default function Page3Exploded({ activeCase, onClose }) {
  return (
    <div className="p3e">
      <div className="p3e-header">
        <h3>Exploded Layer View</h3>
        <p>Why ground loses, why air wins — layer by layer.</p>
        <button className="p3e-close" onClick={onClose}>×</button>
      </div>

      <div className="p3e-stack">
        {LAYERS.map((layer, i) => (
          <div
            key={layer.id}
            className="p3e-layer"
            style={{
              '--layer-color': layer.color,
              '--layer-offset': `${i * 64}px`,
              animationDelay: `${i * 0.12}s`,
            }}
          >
            <div className="p3e-layer-bar" />
            <div className="p3e-layer-content">
              <span className="p3e-icon">{layer.icon}</span>
              <div>
                <div className="p3e-layer-name">{layer.label}</div>
                <div className="p3e-layer-desc">{layer.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p3e-verdict">
        <div className="p3e-verdict-ground">
          <span className="p3e-v-label">Ground</span>
          <span>Must navigate layers 3→4→5 sequentially</span>
          <span className="p3e-v-time" style={{ color: '#ff5050' }}>{activeCase?.tt_ground || '?'} min</span>
        </div>
        <div className="p3e-verdict-vs">VS</div>
        <div className="p3e-verdict-air">
          <span className="p3e-v-label">Air</span>
          <span>Bypasses layers 3-5, direct from 6→1</span>
          <span className="p3e-v-time" style={{ color: '#00ccff' }}>{activeCase?.tt_air || '?'} min</span>
        </div>
      </div>
    </div>
  );
}
