import { waypoints } from './portfolio-content.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COAST_DELAY_MS = 170;
const COAST_RATE_FAR = 12;
const COAST_RATE_NEAR = 4.5;
const TIME_FIELD_RADIUS = 0.085;
const LOCK_RELEASE_DISTANCE = 0.072;
const LOCK_ACQUIRE_DISTANCE = 0.10;

let lastUserInputTime = performance.now();
let lastTime = performance.now();
let syntheticScrollUntil = 0;
let coastCarry = 0;
let lockedStop = null;
let mode = 'flight';
let coastStrength = 0;

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

function nearestStop(progress) {
  return waypoints.reduce((best, stop) => {
    const distance = Math.abs(wrapSigned(stop.at - progress));
    return !best || distance < best.distance ? { stop, distance } : best;
  }, null);
}

function noteUserInput() {
  const now = performance.now();
  if (now < syntheticScrollUntil) return;
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

function updateLock(progress) {
  const nearest = nearestStop(progress);
  if (!lockedStop && nearest.distance <= LOCK_ACQUIRE_DISTANCE) lockedStop = nearest.stop;
  if (!lockedStop) return;

  const lockedDistance = Math.abs(wrapSigned(lockedStop.at - progress));
  const passed = wrapSigned(lockedStop.at - progress) < -LOCK_RELEASE_DISTANCE;
  const deliberateJump = nearest.stop !== lockedStop
    && nearest.distance < 0.025
    && lockedDistance > 0.105;

  if (passed || lockedDistance > 0.16 || deliberateJump) {
    lockedStop = nearest.distance <= LOCK_ACQUIRE_DISTANCE ? nearest.stop : null;
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

function advanceCoast(dt, rate) {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const remaining = maxScroll - scrollY;
  if (remaining <= 4) return;

  coastCarry += rate * dt;
  if (coastCarry < 0.5) return;

  const distance = Math.min(remaining, coastCarry);
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

  updateLock(flight.progress);
  const field = fieldFor(flight.progress);
  const idleFor = now - lastUserInputTime;
  const canCoast = !reducedMotion && idleFor >= COAST_DELAY_MS && !document.body.classList.contains('reading-brief');
  mode = canCoast ? 'time-pocket' : 'flight';

  const targetCoast = canCoast ? 1 : 0;
  coastStrength += (targetCoast - coastStrength) * (1 - Math.exp(-4.4 * dt));

  if (canCoast) advanceCoast(dt, field.rate);

  window.__portfolioTimePocketDebug = {
    ready: true,
    mode,
    coastStrength,
    timeFieldStrength: field.strength,
    lockedStop: lockedStop?.title || null,
    lockedStopIndex: lockedStop ? waypoints.indexOf(lockedStop) : -1,
    relativeDistance: field.relativeDistance,
    coastRatePxPerSecond: field.rate,
    coastRateFar: COAST_RATE_FAR,
    coastRateNear: COAST_RATE_NEAR,
    timeFieldRadius: TIME_FIELD_RADIUS,
    contract: 'cinematic-time-dilation-pass-v2',
  };

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
