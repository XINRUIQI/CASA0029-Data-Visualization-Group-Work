export const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2hpcmx5cXhyIiwiYSI6ImNtbmo5bXAzNDBsN2Yyb3NtMnc2eDc5bTEifQ.HzqwQY7AqdgJxzlyLiRmqQ';

export const SHENZHEN_CENTER = [114.06, 22.55];
export const SHENZHEN_ZOOM = 10.5;
export const SHENZHEN_BOUNDS = [113.75, 22.40, 114.62, 22.86];

/** Mapbox `maxBounds`: [[west, south], [east, north]] */
export const SHENZHEN_MAX_BOUNDS = [
  [SHENZHEN_BOUNDS[0], SHENZHEN_BOUNDS[1]],
  [SHENZHEN_BOUNDS[2], SHENZHEN_BOUNDS[3]],
];

/**
 * Files in `public/data/`: in dev Vite serves `public/` at URL root (`/data/...`), while
 * `import.meta.env.BASE_URL` is the subpath from `vite.config` (needed for GitHub Pages build).
 * @param {string} relativePath e.g. `data/candidate_sites.json`
 */
export function publicDataUrl(relativePath) {
  const path = relativePath.replace(/^\//, '');
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${path}`;
}
export const POI_COLORS = {
  retail:    { hex: '#ff6b6b', label: 'Retail' },
  food:      { hex: '#ffa028', label: 'Food' },
  service:   { hex: '#ffdd57', label: 'Service' },
  office:    { hex: '#48dbfb', label: 'Office' },
  education: { hex: '#64c8ff', label: 'Education' },
  leisure:   { hex: '#00e896', label: 'Leisure' },
  scenic:    { hex: '#c864ff', label: 'Scenic' },
  medical:   { hex: '#ff85a1', label: 'Medical' },
};


export const PAGE_TITLES = [
  'Where do drones enter the city?',
  'Where are the drone sites now?',
  'How do drones fly?',
  'What makes ground delivery hard?',
  'Where is demand highest?',
  'Where should we build?',
  'What have we learned?',
];
