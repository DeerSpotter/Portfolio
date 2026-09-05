import { waypoints } from './portfolio-content.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COAST_DELAY_MS = 170;
const COAST_RATE_PX_PER_SECOND = 9;
const LOCK_RELEASE_DISTANCE = 0.072;
const LOCK_ACQUIRE_DISTANCE = 0.10;

let lastUserInputTime = performance.now();
let lastTime = performance.now();
let syntheticScroll = false;
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

function nearestStop(progress) {
  return waypoints.reduce((best, stop) => {
    const distance = Math.abs(wrapSigned(stop.at - progress));
    return !best || distance < best.distance ? { stop, distance } : best;
  }, null);
}

function noteUserInput() {
  if (syntheticScroll) return;
  lastUserInputTime = performance.now();
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
  if (passed || lockedDistance > 0.16) {
    lockedStop = nearest.distance <= LOCK_ACQUIRE_DISTANCE ? nearest.stop : null;
  }
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
  const idleFor = now - lastUserInputTime;
  const canCoast = !reducedMotion && idleFor >= COAST_DELAY_MS && !document.body.classList.contains('reading-brief');
  mode = canCoast ? 'time-pocket' : 'flight';

  const targetCoast = canCoast ? 1 : 0;
  coastStrength += (targetCoast - coastStrength) * (1 - Math.exp(-4.4 * dt));

  if (canCoast) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const remaining = maxScroll - scrollY;
    if (remaining > 4) {
      syntheticScroll = true;
      scrollBy(0, Math.min(remaining, COAST_RATE_PX_PER_SECOND * dt));
      requestAnimationFrame(() => { syntheticScroll = false; });
    }
  }

  const relativeDistance = lockedStop ? wrapSigned(lockedStop.at - flight.progress) : null;
  window.__portfolioTimePocketDebug = {
    ready: true,
    mode,
    coastStrength,
    lockedStop: lockedStop?.title || null,
    lockedStopIndex: lockedStop ? waypoints.indexOf(lockedStop) : -1,
    relativeDistance,
    coastRatePxPerSecond: COAST_RATE_PX_PER_SECOND,
    contract: 'cinematic-slow-pass-v1',
  };

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
