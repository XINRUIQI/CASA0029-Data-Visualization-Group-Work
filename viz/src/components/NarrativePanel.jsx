import './NarrativePanel.css';

export default function NarrativePanel({ title, subtitle, children, position = 'left' }) {
  return (
    <div className={`narrative-panel narrative-${position}`}>
      {title && <h2 className="narrative-title">{title}</h2>}
      {subtitle && <p className="narrative-subtitle">{subtitle}</p>}
      <div className="narrative-body">
        {children}
      </div>
    </div>
  );
}
