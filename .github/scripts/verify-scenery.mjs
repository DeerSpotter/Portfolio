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

if (!canvas.includes("const SCENERY_CONTRACT = 'layered-side-scenes-v1'")) {
  throw new Error('Layered side scenery contract is missing.');
}
if (!canvas.includes("lateralPerspective: 'accelerated-side-growth'")) {
  throw new Error('Accelerated lateral growth contract is missing.');
}
if (!canvas.includes("role: 'lead'") || !canvas.includes("role: 'hero'") || !canvas.includes("role: 'trail'")) {
  throw new Error('Each waypoint must retain lead, hero, and trail depth layers.');
}
if (!canvas.includes('const scaleX = scaleY *')) {
  throw new Error('Sideways growth must be independent from vertical scene scale.');
}

console.log('[portfolio-scenery] PASS');
console.log(`[portfolio-scenery] dedicatedArtwork=${visuals.length}`);
console.log('[portfolio-scenery] layersPerStop=3');
console.log('[portfolio-scenery] projection=accelerated-side-growth');
console.log('[portfolio-scenery] legacyPlanetAndCrosshairPlaceholders=0');
