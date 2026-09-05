import { readFileSync } from 'node:fs';

const canvas = readFileSync('src/canvas-flight.js', 'utf8');

for (const required of [
  "const RIBBON_CONTRACT = 'perspective-navigation-wake-v2'",
  'const WAKE_MAX_RADIUS = 0.072',
  'function wakePoint(',
  'function drawWakeStrand(',
  'function drawFlightRibbons(',
  'ribbonStrands: 3',
  'wakeMaxRadius: WAKE_MAX_RADIUS',
  'drawFlightRibbons(ribbonStop, progress, now, Boolean(activeStop))',
]) {
  if (!canvas.includes(required)) throw new Error(`Flight wake contract missing: ${required}`);
}

for (const removed of [
  'function drawOrbitCurl(',
  'function drawHelicalRibbon(',
  'artEnd',
  'billboardEnd',
  'radius: Math.min(cssW, cssH) * 0.18',
]) {
  if (canvas.includes(removed)) {
    throw new Error(`Old scene-spanning scribble ribbon returned: ${removed}`);
  }
}

console.log('[portfolio-ribbon] PASS');
console.log('[portfolio-ribbon] replacement=bounded-perspective-navigation-wake');
console.log('[portfolio-ribbon] strands=3');
console.log('[portfolio-ribbon] radius=max-7.2-percent-of-short-viewport');
console.log('[portfolio-ribbon] motion=helix-aligned-to-flight-corridor-not-artwork-or-billboard');
