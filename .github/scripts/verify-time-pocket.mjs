import { readFileSync } from 'node:fs';

const controller = readFileSync('src/time-pocket-flight.js', 'utf8');
const billboard = readFileSync('src/billboard-flight.js', 'utf8');
const ui = readFileSync('src/portfolio-ui.js', 'utf8');
const ship = readFileSync('src/ship-overlay.js', 'utf8');
const stub = readFileSync('src/ship-stub.js', 'utf8');
const css = readFileSync('src/billboard.css', 'utf8');

for (const required of [
  "contract: 'cinematic-time-dilation-pass-v2'",
  'COAST_DELAY_MS = 170',
  'COAST_RATE_FAR = 12',
  'COAST_RATE_NEAR = 4.5',
  'TIME_FIELD_RADIUS = 0.085',
  'LOOP_EDGE_GUARD_PX = 18',
  'FLIGHT_LOCK_RELEASE_DISTANCE = 0.010',
  'TIME_POCKET_LOCK_RELEASE_DISTANCE = 0.072',
  'let hasFlightInput = false',
  'hasFlightInput = true',
  'const loopEdge = nearLoopEdge()',
  'const stopAcquired = Boolean(flight.activeStop)',
  '&& !loopEdge',
  '&& stopAcquired',
  "mode = canCoast ? 'time-pocket' : 'flight'",
  'coastCarry += rate * dt',
  'syntheticScrollUntil = performance.now() + 90',
  'scrollBy(0, distance)',
  'const acquiredStop = stopByTitle(activeTitle)',
  "mode === 'time-pocket'",
  'TIME_POCKET_LOCK_RELEASE_DISTANCE',
  'FLIGHT_LOCK_RELEASE_DISTANCE',
  'updateLock(flight.progress, flight.activeStop)',
  'timeFieldStrength: field.strength',
  'loopEdgeGuard: loopEdge',
  'stopAcquired,',
  'lockedStop?.title || null',
]) {
  if (!controller.includes(required)) throw new Error(`Time-pocket behavior missing: ${required}`);
}

if (controller.includes('nearest.distance <= LOCK_ACQUIRE_DISTANCE')) {
  throw new Error('Geometric nearest-stop lock acquisition returned; a stop may latch only after the canvas actually acquires it.');
}
if (ui.includes('showWaypoint(waypoints[0])')) {
  throw new Error('Waypoint 01 hard-reset returned; restored scroll positions would flash the wrong content.');
}
if (!ui.includes('const waypoint = requestedWaypoint;') || !billboard.includes('showWaypoint(stop)')) {
  throw new Error('Billboard selection must own both the projected pose and the displayed content.');
}
if (!billboard.includes('window.__portfolioTimePocketDebug?.lockedStop')) {
  throw new Error('Billboard does not honor the shared latched stop.');
}
if (!billboard.includes("billboard.style.setProperty('--time-field'")) {
  throw new Error('Billboard glow is not tied to time-field proximity.');
}

for (const required of [
  'smoothTangent',
  'filteredVelocity',
  'coastAmount',
  'timeFieldAmount',
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
for (const required of [
  'billboard-breathe',
  "body[data-flight-mode='time-pocket'] #world",
  '--time-field: 0',
]) {
  if (!css.includes(required)) throw new Error(`Time-field visual focus missing: ${required}`);
}

console.log('[portfolio-time-pocket] PASS');
console.log('[portfolio-time-pocket] entry=user-flight-then-idle');
console.log('[portfolio-time-pocket] ordering=stop-acquired-before-coast');
console.log('[portfolio-time-pocket] handoff=flight-releases-passed-stop-at-0.010');
console.log('[portfolio-time-pocket] slowPass=time-pocket-retains-stop-through-0.072');
console.log('[portfolio-time-pocket] idle=cinematic-time-dilation-pass');
console.log('[portfolio-time-pocket] coast=12px/s-far->4.5px/s-near');
console.log('[portfolio-time-pocket] loopEdges=18px-no-coast-guard');
console.log('[portfolio-time-pocket] focus=latched-no-waypoint-01-reset');
console.log('[portfolio-time-pocket] artwork=quieted-not-hidden');
console.log('[portfolio-time-pocket] ship=smoothed-route-camera-and-field');
console.log('[portfolio-time-pocket] engines=animated-idle-to-thrust');
