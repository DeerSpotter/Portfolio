import { waypoints } from './portfolio-content.js';
import { showWaypoint } from './portfolio-ui.js';
import { createBillboardFieldRenderer } from './billboard-field.js';
import './time-pocket-flight.js';

const billboard = document.querySelector('.detail');
const action = document.getElementById('detailAction');
const hud = document.getElementById('hud');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const INTERACTION_HOLD_MS = 3500;
const INTERACTION_FIELD_THRESHOLD = 0.72;
const EXIT_START_REL = -0.006;
const EXIT_END_REL = -0.065;
const fieldRenderer = createBillboardFieldRenderer({ hud, billboard, reducedMotion });

let displayed = null;
let lastState = '';
let interactionHold = null;
let interactionHoldUntil = 0;
let interactionHoldConsumedStop = null;
let releasePose = null;

// Navigation is an explicit request to read a stop. Keep its reading plane
// stationary until the visitor resumes flight; ambient scenery keeps moving.
let navigationStop = null;
let navigationPose = null;
let focusPose = null;
let lastPresentedPose = null;

addEventListener('portfolio:waypoint-navigation', event => {
  navigationStop = waypoints.find(stop => stop.title === event.detail?.title) || null;
  navigationPose = null;
  focusPose = null;
  interactionHold = null;
  interactionHoldConsumedStop = null;
  releasePose = null;
  billboard.dataset.readingHold = navigationStop ? 'true' : 'false';
});

function resumeFlight(event) {
  if (event.target instanceof Element) {
    // Destination dialogs own their own scroll transaction. Never turn a
    // briefing swipe into main-flight input.
    if (event.target.closest('dialog')) return;
    // A press on the flight pane may be a tap to open the destination, so keep
    // the reading hold until actual movement occurs. touchmove/wheel/keyboard
    // are explicit resume-flight intents and may release a pane selected from
    // the waypoint navigation.
    if (event.type === 'pointerdown' && event.target.closest('.detail, button, a')) return;
  }
  if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return;
  if (navigationPose || focusPose) releasePose = { ...(navigationPose || focusPose), started: performance.now() };
  navigationStop = null;
  navigationPose = null;
  focusPose = null;
  billboard.dataset.readingHold = 'false';
}
addEventListener('wheel', resumeFlight, { passive: true });
addEventListener('touchmove', resumeFlight, { passive: true });
addEventListener('keydown', resumeFlight);
addEventListener('pointerdown', resumeFlight, { passive: true });

function captureFocusPose() {
  if (billboard.dataset.interactive !== 'true' || !lastPresentedPose) return;
  focusPose = { ...lastPresentedPose };
  billboard.dataset.readingHold = 'true';
}
billboard.addEventListener('pointerenter', captureFocusPose);
billboard.addEventListener('focusin', captureFocusPose);
function releaseFocusPose() {
  if (billboard.matches(':hover') || billboard.contains(document.activeElement)) return;
  if (focusPose) releasePose = { ...focusPose, started: performance.now() };
  focusPose = null;
  billboard.dataset.readingHold = navigationStop ? 'true' : 'false';
}
billboard.addEventListener('pointerleave', releaseFocusPose);
billboard.addEventListener('focusout', () => queueMicrotask(releaseFocusPose));

// Reading and interaction holds are screen-space poses. A phone rotation or
// viewport resize invalidates their x/y/scale immediately. Reproject the same
// selected waypoint into the new viewport instead of carrying stale geometry
// forward from the previous orientation.
function refreshViewportPose() {
  const debug = window.__portfolioCanvasDebug;
  if (!debug?.ready) return;

  const pocket = window.__portfolioTimePocketDebug;
  const coastStrength = reducedMotion ? 0 : (pocket?.coastStrength || 0);
  const stop = navigationStop || chooseStop(debug.progress, debug.activeStop);
  const projected = project(stop, debug.progress, coastStrength);
  const focusActive = billboard.matches(':hover') || billboard.contains(document.activeElement);

  interactionHold = null;
  interactionHoldUntil = 0;
  interactionHoldConsumedStop = null;
  releasePose = null;
  navigationPose = navigationStop && projected.interactive
    ? { ...projected, stopTitle: stop.title }
    : null;
  focusPose = !navigationStop && focusActive && projected.interactive
    ? { ...projected, stopTitle: stop.title }
    : null;

  const screen = { ...(navigationPose || focusPose || projected) };
  for (const key of ['x', 'y', 'scale', 'yaw', 'roll', 'skew']) {
    screen[key] = Number(screen[key].toFixed(key === 'scale' ? 4 : 2));
  }
  lastPresentedPose = { ...screen, stopTitle: stop.title };
  billboard.style.setProperty('--billboard-x', `${screen.x.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-y', `${screen.y.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-scale', screen.scale.toFixed(4));
  billboard.style.setProperty('--billboard-alpha', projected.alpha.toFixed(4));
  billboard.style.setProperty('--billboard-yaw', `${screen.yaw.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-roll', `${screen.roll.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-skew', `${screen.skew.toFixed(2)}deg`);
  billboard.dataset.readingHold = navigationStop || focusPose ? 'true' : 'false';
}
addEventListener('resize', refreshViewportPose, { passive: true });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function wrapSigned(value) {
  let wrapped = wrap01(value);
  if (wrapped > 0.5) wrapped -= 1;
  return wrapped;
}

function vanishingPoint(progress) {
  return {
    x: innerWidth * (0.50 + Math.sin(progress * TAU * 1.10) * 0.035),
    y: innerHeight * (0.35 + Math.cos(progress * TAU * 0.75) * 0.025),
  };
}

function billboardSide(stop) {
  const artSide = Math.sign(stop.side || 1);
  return -artSide * 0.46;
}

function chooseStop(progress, activeTitle) {
  const lockedTitle = window.__portfolioTimePocketDebug?.lockedStop;
  if (lockedTitle) {
    const locked = waypoints.find(stop => stop.title === lockedTitle);
    if (locked) return locked;
  }

  if (activeTitle) {
    const active = waypoints.find(stop => stop.title === activeTitle);
    if (active) return active;
  }

  // Keep the currently visible pane alive through its full side-fade exit.
  // Content changes only after the old pane is effectively transparent, so
  // there is no abrupt disappearance at the reading-plane handoff.
  if (displayed) {
    const displayedRel = wrapSigned(displayed.at - progress);
    if (displayedRel < EXIT_START_REL && displayedRel > EXIT_END_REL) return displayed;
  }

  let best = null;
  let bestScore = Infinity;
  for (const stop of waypoints) {
    const rel = wrapSigned(stop.at - progress);
    if (rel < -0.012 || rel > 0.34) continue;
    const score = rel < 0 ? Math.abs(rel) * 0.6 : rel;
    if (score < bestScore) {
      best = stop;
      bestScore = score;
    }
  }

  if (best) return best;
  return waypoints.reduce((candidate, stop) => {
    const distance = wrap01(stop.at - progress);
    return !candidate || distance < candidate.distance ? { stop, distance } : candidate;
  }, null).stop;
}

function project(stop, progress, coastStrength) {
  const rel = wrapSigned(stop.at - progress);
  const vp = vanishingPoint(progress);
  const side = billboardSide(stop);
  const t = clamp((0.20 - rel) / 0.255, 0, 1);
  const exitProgress = rel < 0 ? clamp(-rel / Math.abs(EXIT_END_REL), 0, 1) : 0;
  const pass = Math.pow(exitProgress, 1.12);

  const lateralPerspective = 0.045 + Math.pow(t, 1.52) * 1.30;
  const forwardPerspective = 0.050 + Math.pow(t, 1.74) * 1.14;
  const laneX = innerWidth * (0.50 + side * 0.47);
  const laneY = innerHeight * 0.49;
  const pocketEase = 1 - coastStrength * 0.10;

  const x = vp.x
    + (laneX - vp.x) * lateralPerspective * pocketEase
    + side * innerWidth * 0.44 * pass;
  let y = vp.y
    + (laneY - vp.y) * forwardPerspective
    + innerHeight * 0.16 * pass;

  let scale = 0.12 + Math.pow(t, 1.44) * 1.10 + pass * 0.18;
  // Short landscape phones have far less vertical flight corridor between the
  // identity HUD and waypoint controls. Compact the actual projected pose so
  // the text card and both procedural field planes remain numerically aligned.
  const shortLandscape = innerWidth <= 900 && innerWidth > innerHeight && innerHeight <= 500;
  if (shortLandscape) {
    scale *= 0.78;
    y -= innerHeight * 0.045;
  }

  const baseAlpha = clamp(0.10 + t * 1.18, 0.07, 1);
  const smoothExit = pass * pass * (3 - 2 * pass);
  const alpha = baseAlpha * (1 - smoothExit);

  const yaw = side * (-36 + t * 25 - pass * 20);
  const rollBase = side * (5.2 - t * 2.6 + pass * 5.8);
  const flightWobble = Math.sin(progress * TAU * 1.35) * 0.8 * (1 - coastStrength * 0.84);
  const roll = rollBase + flightWobble;
  const skew = side * (-6.0 + t * 3.4);

  let state = 'distant';
  if (rel < EXIT_START_REL) state = 'passing';
  else if (t >= 0.76) state = 'active';
  else if (t >= 0.61) state = 'arming';
  else if (t >= 0.34) state = 'approaching';

  if (coastStrength > 0.55 && rel > -0.045 && rel < 0.065) state = 'active';

  return {
    x,
    y,
    scale,
    alpha,
    yaw,
    roll,
    skew,
    t,
    rel,
    side,
    pass,
    exitProgress,
    state,
    interactive: (state === 'arming' || state === 'active') && rel > -0.045,
  };
}

function captureInteractionHold(stop, screen, now) {
  interactionHold = {
    stopTitle: stop.title,
    x: screen.x,
    y: screen.y,
    scale: screen.scale,
    yaw: screen.yaw,
    roll: screen.roll,
    skew: screen.skew,
  };
  interactionHoldUntil = now + INTERACTION_HOLD_MS;
  interactionHoldConsumedStop = stop.title;
}

function heldScreen(stop, screen, pocket, timeFieldStrength, now) {
  const inInteractionZone = !reducedMotion
    && pocket?.mode === 'time-pocket'
    && screen.state === 'active'
    && screen.interactive
    && timeFieldStrength >= INTERACTION_FIELD_THRESHOLD;

  if (!inInteractionZone) {
    if (interactionHold) releasePose = { ...interactionHold, started: now };
    interactionHold = null;
    interactionHoldUntil = 0;
    if (interactionHoldConsumedStop !== stop.title) interactionHoldConsumedStop = null;
    return { screen, held: false };
  }

  if (!interactionHold && interactionHoldConsumedStop !== stop.title) {
    captureInteractionHold(stop, screen, now);
  }

  if (!interactionHold || interactionHold.stopTitle !== stop.title) {
    return { screen, held: false };
  }

  const focusInside = billboard.matches(':hover') || billboard.contains(document.activeElement);
  if (focusInside) interactionHoldUntil = Math.max(interactionHoldUntil, now + 350);

  if (now >= interactionHoldUntil && !focusInside) {
    releasePose = { ...interactionHold, started: now };
    interactionHold = null;
    return { screen, held: false };
  }

  return {
    screen: {
      ...screen,
      x: interactionHold.x,
      y: interactionHold.y,
      scale: interactionHold.scale,
      yaw: interactionHold.yaw,
      roll: interactionHold.roll,
      skew: interactionHold.skew,
    },
    held: true,
  };
}

function updateAccessibility(interactive) {
  billboard.dataset.interactive = interactive ? 'true' : 'false';
  billboard.tabIndex = interactive ? 0 : -1;
  action.tabIndex = interactive ? 0 : -1;
  action.setAttribute('aria-disabled', interactive ? 'false' : 'true');
}

function render(now = performance.now()) {
  const debug = window.__portfolioCanvasDebug;
  if (!debug?.ready) {
    requestAnimationFrame(render);
    return;
  }

  const pocket = window.__portfolioTimePocketDebug;
  const coastStrength = reducedMotion ? 0 : (pocket?.coastStrength || 0);
  const timeFieldStrength = reducedMotion ? 0 : (pocket?.timeFieldStrength || 0);
  const stop = navigationStop || chooseStop(debug.progress, debug.activeStop);
  const projected = project(stop, debug.progress, coastStrength);
  const hold = heldScreen(stop, projected, pocket, timeFieldStrength, now);
  if (navigationStop && !navigationPose && debug.settled && projected.interactive) {
    navigationPose = { ...projected, stopTitle: stop.title };
  }
  if (!navigationStop && !focusPose
      && projected.interactive
      && (billboard.matches(':hover') || billboard.contains(document.activeElement))) {
    focusPose = { ...projected, stopTitle: stop.title };
  }
  const readingPose = navigationPose || (focusPose?.stopTitle === stop.title ? focusPose : null);
  const screen = { ...hold.screen };
  if (readingPose) {
    for (const key of ['x', 'y', 'scale', 'yaw', 'roll', 'skew']) screen[key] = readingPose[key];
  }
  billboard.dataset.readingHold = navigationStop || readingPose ? 'true' : 'false';
  if (releasePose && !hold.held && !readingPose && releasePose.stopTitle === stop.title) {
    const remaining = Math.exp(-(now - releasePose.started) / 180);
    for (const key of ['x', 'y', 'scale', 'yaw', 'roll', 'skew']) {
      screen[key] += (releasePose[key] - screen[key]) * remaining;
    }
    if (remaining < .001) releasePose = null;
  } else if (hold.held || readingPose || releasePose?.stopTitle !== stop.title) releasePose = null;
  // Give the text and both effect planes exactly the same numeric pose.
  for (const key of ['x', 'y', 'scale', 'yaw', 'roll', 'skew']) {
    screen[key] = Number(screen[key].toFixed(key === 'scale' ? 4 : 2));
  }

  lastPresentedPose = { ...screen, stopTitle: stop.title };

  if (stop !== displayed) {
    displayed = stop;
    showWaypoint(stop);
    billboard.dataset.waypoint = stop.section;
  }

  billboard.style.setProperty('--billboard-x', `${screen.x.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-y', `${screen.y.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-scale', screen.scale.toFixed(4));
  billboard.style.setProperty('--billboard-alpha', projected.alpha.toFixed(4));
  billboard.style.setProperty('--billboard-yaw', `${screen.yaw.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-roll', `${screen.roll.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-skew', `${screen.skew.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-glow', clamp((projected.t - 0.48) / 0.42, 0, 1).toFixed(3));
  billboard.style.setProperty('--billboard-color', stop.color);
  billboard.style.setProperty('--billboard-side', projected.side.toFixed(3));
  billboard.style.setProperty('--coast-strength', coastStrength.toFixed(3));
  billboard.style.setProperty('--time-field', timeFieldStrength.toFixed(3));
  billboard.dataset.timePocket = coastStrength > 0.45 ? 'true' : 'false';
  billboard.dataset.interactionHold = hold.held ? 'true' : 'false';

  const field = fieldRenderer.render({
    screen,
    projected,
    vanishingPoint: vanishingPoint(debug.progress),
    timeFieldStrength,
    seed: 3107 + waypoints.indexOf(stop) * 7919,
    interactionHold: hold.held,
  });

  if (projected.state !== lastState) {
    lastState = projected.state;
    billboard.dataset.billboardState = projected.state;
  }

  updateAccessibility(projected.interactive || reducedMotion);

  window.__portfolioBillboardDebug = {
    ready: true,
    stop: stop.title,
    state: projected.state,
    interactive: projected.interactive || reducedMotion,
    readingHold: Boolean(readingPose),
    navigationHold: Boolean(navigationPose),
    interactionHold: hold.held,
    interactionHoldConsumed: interactionHoldConsumedStop === stop.title,
    interactionHoldMs: INTERACTION_HOLD_MS,
    rel: projected.rel,
    depth: projected.t,
    side: projected.side,
    x: screen.x,
    y: screen.y,
    scale: screen.scale,
    alpha: projected.alpha,
    pass: projected.pass,
    exitProgress: projected.exitProgress,
    yaw: screen.yaw,
    roll: screen.roll,
    skew: screen.skew,
    coastStrength,
    timeFieldStrength,
    fieldStrength: field.strength,
    flameCount: field.particleCount,
    rearFlameCount: field.rearParticleCount,
    frontFlameCount: field.frontParticleCount,
    maxFlames: field.maxParticles,
    fieldRenderer: field.renderer,
    fieldFrontLayer: field.frontLayer,
    fieldRearLayer: field.rearLayer,
    fieldContract: field.contract,
    proceduralSeed: field.seed,
    moonCount: field.moonCount,
    asteroidCount: field.asteroidCount,
    contract: 'approaching-skewed-interactive-billboard-v3',
  };

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
