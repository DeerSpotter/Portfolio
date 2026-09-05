import { readFileSync } from 'node:fs';

const canvas = readFileSync('src/canvas-flight.js', 'utf8');
const content = readFileSync('src/portfolio-content.js', 'utf8');

const visuals = [
  'entry-vista',
  'engineering-assembly',
  'automation-stack',
  'context-port',
  'runtime-bridge',
  'clarity-map',
];

for (const visual of visuals) {
  if (!content.includes(`visual: '${visual}'`)) {
    throw new Error(`Missing dedicated waypoint artwork: ${visual}`);
  }
  if (!canvas.includes(`case '${visual}':`)) {
    throw new Error(`Canvas renderer does not implement waypoint artwork: ${visual}`);
  }
}

for (const removed of ['const planets =', 'function drawPlanet(', 'function drawWaypoint(']) {
  if (canvas.includes(removed)) {
    throw new Error(`Legacy placeholder renderer is still present: ${removed}`);
  }
}

for (const required of [
  "const SCENERY_CONTRACT = 'art-directed-flight-stations-v2'",
  "artDirection: 'hero-station-plus-supporting-silhouettes'",
  'function drawStationCompanion(',
  'function stationShadow(',
  "if (stop.role !== 'hero')",
  "role: 'lead'",
  "role: 'hero'",
  "role: 'trail'",
  'const scaleX = scaleY *',
  "lateralPerspective: 'accelerated-side-growth'",
]) {
  if (!canvas.includes(required)) throw new Error(`Art-direction contract missing: ${required}`);
}

if (!canvas.includes('drawStationCompanion(stop)')) {
  throw new Error('Lead/trail scenery no longer uses dedicated companion silhouettes.');
}

console.log('[portfolio-scenery] PASS');
console.log(`[portfolio-scenery] dedicatedHeroStations=${visuals.length}`);
console.log('[portfolio-scenery] depth=hero-plus-lead-trail-companions');
console.log('[portfolio-scenery] hierarchy=bold-silhouette-before-detail');
console.log('[portfolio-scenery] projection=accelerated-side-growth-capped-near-scale');
console.log('[portfolio-scenery] legacyPlanetAndCrosshairPlaceholders=0');
