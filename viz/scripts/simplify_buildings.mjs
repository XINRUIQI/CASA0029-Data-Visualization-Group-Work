/**
 * Reduce buildings_all.geojson file size by rounding coordinates.
 *
 * Run:  node scripts/simplify_buildings.mjs
 * Output: public/data/buildings_all.geojson (overwritten in place)
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '../public/data/buildings_all.geojson');

const PRECISION = 5;

function roundCoords(coords) {
  if (typeof coords[0] === 'number') {
    return coords.map(v => +v.toFixed(PRECISION));
  }
  return coords.map(roundCoords);
}

console.log('Reading …');
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const before = Buffer.byteLength(JSON.stringify(data));

console.log(`Features: ${data.features.length}`);

for (const f of data.features) {
  f.geometry.coordinates = roundCoords(f.geometry.coordinates);
}

const json = JSON.stringify(data);
const after = Buffer.byteLength(json);
writeFileSync(FILE, json);

console.log(`Before: ${(before / 1024 / 1024).toFixed(1)} MB`);
console.log(`After:  ${(after  / 1024 / 1024).toFixed(1)} MB`);
console.log(`Saved:  ${((before - after) / 1024 / 1024).toFixed(1)} MB (${((1 - after / before) * 100).toFixed(0)}%)`);
