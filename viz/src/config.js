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
  if (import.meta.env.DEV) return `/${path}`;
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${path}`;
}

export const PAGE_TITLES = [
  'Where do drones enter the city?',
  'What makes ground delivery hard?',
  'How do drones fly?',
  'Where is demand highest?',
  'Where should we build?',
  'What have we learned?',
];
