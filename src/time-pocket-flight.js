import { waypoints } from './portfolio-content.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COAST_DELAY_MS = 170;
const COAST_RATE_FAR = 12;
const COAST_RATE_NEAR = 4.5;
const TIME_FIELD_RADIUS = 0.085;
const LOOP_EDGE_GUARD_PX = 18;
const FLIGHT_LOCK_RELEASE_DISTANCE = 0.010;
const TIME_POCKET_LOCK_RELEASE_DISTANCE = 0.072;

let lastUserInputTime = performance.now();
let lastTime = performance.now();
let syntheticScrollUntil = 0;
let coastCarry = 0;
let lockedStop = null;
let mode = 'flight';
let lastDomMode = '';
let coastStrength = 0;
let hasFlightInput = false;

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function wrapSigned(value) {
  let wrapped = wrap01(value);
  if (wrapped > 0.5) wrapped -= 1;
  return wrapped;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function stopByTitle(title) {
  return title ? waypoints.find(stop => stop.title === title) || null : null;
}

function noteUserInput() {
  const now = performance.now();
  if (now < syntheticScrollUntil) return;
  hasFlightInput = true;
  lastUserInputTime = now;
  coastCarry = 0;
  mode = 'flight';
}

addEventListener('wheel', noteUserInput, { passive: true });
addEventListener('scroll', noteUserInput, { passive: true });
addEventListener('touchmove', noteUserInput, { passive: true });
addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) noteUserInput();
});
addEventListener('pointerdown', event => {
  if (!event.target.closest('.detail, dialog, a, button')) noteUserInput();
}, { passive: true });

function updateLock(progress, activeTitle) {
  const acquiredStop = stopByTitle(activeTitle);

  // A stop only becomes a shared time-pocket latch after the canvas has
  // actually acquired it. During ordinary flight the billboard is free to
  // show the next stop in the distance instead of inheriting a stale nearest
  // stop simply because that stop is still geometrically close behind us.
  if (!lockedStop) {
    if (acquiredStop) lockedStop = acquiredStop;
    return;
  }

  if (acquiredStop && acquiredStop !== lockedStop) {
    lockedStop = acquiredStop;
    return;
  }

  const relativeDistance = wrapSigned(lockedStop.at - progress);
  const lockedDistance = Math.abs(relativeDistance);
  const releaseDistance = mode === 'time-pocket'
    ? TIME_POCKET_LOCK_RELEASE_DISTANCE
    : FLIGHT_LOCK_RELEASE_DISTANCE;
  const passed = relativeDistance < -releaseDistance;

  if (passed || lockedDistance > 0.16) {
    lockedStop = acquiredStop || null;
  }
}

function fieldFor(progress) {
  if (!lockedStop) return { relativeDistance: null, strength: 0, rate: COAST_RATE_FAR };
  const relativeDistance = wrapSigned(lockedStop.at - progress);
  const proximity = 1 - Math.abs(relativeDistance) / TIME_FIELD_RADIUS;
  const strength = smoothstep(proximity);
  const rate = COAST_RATE_FAR - (COAST_RATE_FAR - COAST_RATE_NEAR) * strength;
  return { relativeDistance, strength, rate };
}

function nearLoopEdge() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return scrollY <= LOOP_EDGE_GUARD_PX || maxScroll - scrollY <= LOOP_EDGE_GUARD_PX;
}

function advanceCoast(dt, rate) {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const remaining = maxScroll - scrollY;
  if (scrollY <= LOOP_EDGE_GUARD_PX || remaining <= LOOP_EDGE_GUARD_PX) {
    coastCarry = 0;
    return;
  }

  coastCarry += rate * dt;
  if (coastCarry < 0.5) return;

  const distance = Math.min(remaining - LOOP_EDGE_GUARD_PX, coastCarry);
  if (distance <= 0) {
    coastCarry = 0;
    return;
  }

  coastCarry = 0;
  syntheticScrollUntil = performance.now() + 90;
  scrollBy(0, distance);
}

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const flight = window.__portfolioCanvasDebug;
  if (!flight?.ready) {
    requestAnimationFrame(animate);
    return;
  }

  updateLock(flight.progress, flight.activeStop);
  const field = fieldFor(flight.progress);
  const idleFor = now - lastUserInputTime;
  const loopEdge = nearLoopEdge();
  const stopAcquired = Boolean(flight.activeStop);
  const canCoast = hasFlightInput
    && !reducedMotion
    && !loopEdge
    && stopAcquired
    && idleFor >= COAST_DELAY_MS
    && !document.body.classList.contains('reading-brief')
    && document.querySelector('.detail')?.dataset.readingHold !== 'true';
  mode = canCoast ? 'time-pocket' : 'flight';

  if (mode !== lastDomMode) {
    lastDomMode = mode;
    document.body.dataset.flightMode = mode;
  }

  const targetCoast = canCoast ? 1 : 0;
  coastStrength += (targetCoast - coastStrength) * (1 - Math.exp(-4.4 * dt));

  if (canCoast) advanceCoast(dt, field.rate);

  window.__portfolioTimePocketDebug = {
    ready: true,
    mode,
    hasFlightInput,
    stopAcquired,
    loopEdgeGuard: loopEdge,
    loopEdgeGuardPx: LOOP_EDGE_GUARD_PX,
    coastStrength,
    timeFieldStrength: field.strength,
    lockedStop: lockedStop?.title || null,
    lockedStopIndex: lockedStop ? waypoints.indexOf(lockedStop) : -1,
    relativeDistance: field.relativeDistance,
    coastRatePxPerSecond: field.rate,
    coastRateFar: COAST_RATE_FAR,
    coastRateNear: COAST_RATE_NEAR,
    timeFieldRadius: TIME_FIELD_RADIUS,
    flightLockReleaseDistance: FLIGHT_LOCK_RELEASE_DISTANCE,
    timePocketLockReleaseDistance: TIME_POCKET_LOCK_RELEASE_DISTANCE,
    contract: 'cinematic-time-dilation-pass-v2',
  };

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
