import { readFileSync } from 'node:fs';

const canvas = readFileSync('src/canvas-flight.js', 'utf8');

for (const required of [
  "const RIBBON_CONTRACT = 'scene-spanning-parallax-ribbons-v1'",
  'function drawHelicalRibbon(',
  'function drawFlightRibbons(',
  'ribbonStrands: 3',
  'drawFlightRibbons(ribbonStop, progress, now, Boolean(activeStop))',
]) {
  if (!canvas.includes(required)) throw new Error(`Flight ribbon contract missing: ${required}`);
}

if (canvas.includes('function drawOrbitCurl(') || canvas.includes('drawOrbitCurl(activeStop')) {
  throw new Error('The old small orbit curl still exists; the ribbon change must replace it, not layer over it.');
}

if (!canvas.includes('radius: Math.min(cssW, cssH) * 0.18')) {
  throw new Error('Flight ribbons are no longer exaggerated across the scene.');
}
if (!canvas.includes('billboardEnd')) {
  throw new Error('Ribbon must reach toward the billboard side as part of the composition.');
}
if (!canvas.includes('artEnd')) {
  throw new Error('Ribbon must reach toward the artwork side as part of the composition.');
}

console.log('[portfolio-ribbon] PASS');
console.log('[portfolio-ribbon] replacement=old-orbit-curl-removed');
console.log('[portfolio-ribbon] strands=3');
console.log('[portfolio-ribbon] span=artwork<->ship<->billboard');
console.log('[portfolio-ribbon] motion=scene-spanning-helical');
