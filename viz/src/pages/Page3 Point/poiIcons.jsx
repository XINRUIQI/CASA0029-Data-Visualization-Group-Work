import { POI_COLORS } from '../../config';

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const POI_ICONS = {
  retail: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M18 8h1a4 4 0 010 8h-1"/>
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  service: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  office: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="2" y="7" width="20" height="14" rx="1"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
    </svg>
  ),
  education: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  leisure: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12l3 3 5-6"/>
    </svg>
  ),
  scenic: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M3 17l4-8 4 5 3-3 4 6H3z"/>
      <circle cx="17" cy="7" r="2"/>
    </svg>
  ),
  medical: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
};

export function PoiPinIcon({ type, size = 22 }) {
  const icon = POI_ICONS[type];
  const color = POI_COLORS[type]?.hex || '#888';
  return (
    <svg viewBox="0 0 40 54" width={size} height={size * 1.35}
      style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
      <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 34 20 34S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill={color} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="white" strokeWidth="3" opacity="0.75" />
      <g transform="translate(8, 8)">
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon?.props?.children}
        </svg>
      </g>
    </svg>
  );
}
