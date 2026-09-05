import { readFileSync } from 'node:fs';

const controller = readFileSync('src/time-pocket-flight.js', 'utf8');
const billboard = readFileSync('src/billboard-flight.js', 'utf8');
const ui = readFileSync('src/portfolio-ui.js', 'utf8');
const ship = readFileSync('src/ship-overlay.js', 'utf8');
const stub = readFileSync('src/ship-stub.js', 'utf8');
const css = readFileSync('src/billboard.css', 'utf8');

for (const required of [
  "contract: 'cinematic-slow-pass-v1'",
  'COAST_DELAY_MS = 170',
  'COAST_RATE_PX_PER_SECOND = 9',
  "mode = canCoast ? 'time-pocket' : 'flight'",
  'coastCarry += COAST_RATE_PX_PER_SECOND * dt',
  'syntheticScrollUntil = performance.now() + 90',
  'scrollBy(0, distance)',
  'lockedStop?.title || null',
]) {
  if (!controller.includes(required)) throw new Error(`Time-pocket behavior missing: ${required}`);
}

if (ui.includes('showWaypoint(waypoints[0])')) {
  throw new Error('Waypoint 01 hard-reset returned; restored scroll positions would flash the wrong content.');
}
if (!ui.includes('window.__portfolioTimePocketDebug?.lockedStop')) {
  throw new Error('UI does not honor the shared latched stop.');
}
if (!billboard.includes('window.__portfolioTimePocketDebug?.lockedStop')) {
  throw new Error('Billboard does not honor the shared latched stop.');
}

for (const required of [
  'smoothTangent',
  'filteredVelocity',
  'coastAmount',
  "engineState: coastAmount > 0.45 ? 'idle-drift'",
  'setShipEngineState',
]) {
  if (!ship.includes(required)) throw new Error(`Smoothed ship/coast behavior missing: ${required}`);
}

for (const required of [
  'export function setShipEngineState',
  'Math.sin(time * 4.6 + phase)',
  'livingIdle',
  'fastFlicker',
]) {
  if (!stub.includes(required)) throw new Error(`Animated engine behavior missing: ${required}`);
}
if (stub.includes('export function setShipWarp')) {
  throw new Error('Old warp-only engine function returned instead of being replaced.');
}
if (css.includes('steps(2, end)')) {
  throw new Error('Stepped billboard flicker returned; activation should be smooth.');
}
if (!css.includes('billboard-breathe')) {
  throw new Error('Slow-pass billboard breathing state is missing.');
}

console.log('[portfolio-time-pocket] PASS');
console.log('[portfolio-time-pocket] idle=cinematic-slow-pass');
console.log('[portfolio-time-pocket] coast=9px/s-native-scroll');
console.log('[portfolio-time-pocket] focus=latched-no-waypoint-01-reset');
console.log('[portfolio-time-pocket] ship=smoothed-route-and-camera');
console.log('[portfolio-time-pocket] engines=animated-idle-to-thrust');
