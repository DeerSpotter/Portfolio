import { waypoints } from './portfolio-content.js';
import { showWaypoint } from './portfolio-ui.js';

const billboard = document.querySelector('.detail');
const action = document.getElementById('detailAction');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

let displayed = null;
let lastState = '';

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
  if (activeTitle) {
    const active = waypoints.find(stop => stop.title === activeTitle);
    if (active) return active;
  }

  let best = null;
  let bestScore = Infinity;
  for (const stop of waypoints) {
    const rel = wrapSigned(stop.at - progress);
    if (rel < -0.055 || rel > 0.34) continue;
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

function project(stop, progress) {
  const rel = wrapSigned(stop.at - progress);
  const vp = vanishingPoint(progress);
  const side = billboardSide(stop);

  // The stops are relatively close together, so the depth curve deliberately
  // compresses the final approach. A newly handed-off billboard starts tiny
  // near the vanishing point instead of appearing already half grown.
  const t = clamp((0.20 - rel) / 0.255, 0, 1);
  const pass = rel < 0 ? Math.pow(clamp(-rel / 0.055, 0, 1), 1.12) : 0;

  const lateralPerspective = 0.045 + Math.pow(t, 1.52) * 1.30;
  const forwardPerspective = 0.050 + Math.pow(t, 1.74) * 1.14;
  const laneX = innerWidth * (0.50 + side * 0.47);
  const laneY = innerHeight * 0.49;

  const x = vp.x
    + (laneX - vp.x) * lateralPerspective
    + side * innerWidth * 0.44 * pass;
  const y = vp.y
    + (laneY - vp.y) * forwardPerspective
    + innerHeight * 0.16 * pass;

  const scale = 0.12 + Math.pow(t, 1.44) * 1.10 + pass * 0.18;
  const alpha = clamp(0.10 + t * 1.18 - pass * 0.40, 0.07, 1);

  // The plane is skewed toward the flight corridor. Far away it presents a
  // stronger angle; close up it opens toward the camera, then kicks outward
  // as the ship passes it.
  const yaw = side * (-36 + t * 25 - pass * 20);
  const roll = side * (5.2 - t * 2.6 + pass * 5.8)
    + Math.sin(progress * TAU * 1.35) * 0.8;
  const skew = side * (-6.0 + t * 3.4);

  let state = 'distant';
  if (rel < -0.015) state = 'passing';
  else if (t >= 0.76) state = 'active';
  else if (t >= 0.61) state = 'arming';
  else if (t >= 0.34) state = 'approaching';

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
    state,
    interactive: (state === 'arming' || state === 'active') && rel > -0.02,
  };
}

function updateAccessibility(interactive) {
  billboard.dataset.interactive = interactive ? 'true' : 'false';
  billboard.tabIndex = interactive ? 0 : -1;
  action.tabIndex = interactive ? 0 : -1;
  action.setAttribute('aria-disabled', interactive ? 'false' : 'true');
}

function render() {
  const debug = window.__portfolioCanvasDebug;
  if (!debug?.ready) {
    requestAnimationFrame(render);
    return;
  }

  const stop = chooseStop(debug.progress, debug.activeStop);
  const screen = project(stop, debug.progress);

  if (stop !== displayed) {
    displayed = stop;
    showWaypoint(stop);
  }

  billboard.style.setProperty('--billboard-x', `${screen.x.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-y', `${screen.y.toFixed(2)}px`);
  billboard.style.setProperty('--billboard-scale', screen.scale.toFixed(4));
  billboard.style.setProperty('--billboard-alpha', screen.alpha.toFixed(4));
  billboard.style.setProperty('--billboard-yaw', `${screen.yaw.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-roll', `${screen.roll.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-skew', `${screen.skew.toFixed(2)}deg`);
  billboard.style.setProperty('--billboard-glow', clamp((screen.t - 0.48) / 0.42, 0, 1).toFixed(3));
  billboard.style.setProperty('--billboard-color', stop.color);
  billboard.style.setProperty('--billboard-side', screen.side.toFixed(3));

  if (screen.state !== lastState) {
    lastState = screen.state;
    billboard.dataset.billboardState = screen.state;
  }

  updateAccessibility(screen.interactive || reducedMotion);

  window.__portfolioBillboardDebug = {
    ready: true,
    stop: stop.title,
    state: screen.state,
    interactive: screen.interactive || reducedMotion,
    rel: screen.rel,
    depth: screen.t,
    side: screen.side,
    x: screen.x,
    y: screen.y,
    scale: screen.scale,
    yaw: screen.yaw,
    roll: screen.roll,
    skew: screen.skew,
    contract: 'approaching-skewed-interactive-billboard-v1',
  };

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
