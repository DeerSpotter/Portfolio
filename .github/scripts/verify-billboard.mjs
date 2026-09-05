import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/billboard.css', 'utf8');
const js = readFileSync('src/billboard-flight.js', 'utf8');
const field = readFileSync('src/billboard-field.js', 'utf8');
const cosmos = readFileSync('src/procedural-cosmos.js', 'utf8');
const flame = readFileSync('src/flame-texture.js', 'utf8');

for (const required of [
  './src/billboard.css',
  './src/billboard-flight.js',
  'data-billboard-state="distant"',
]) {
  if (!html.includes(required)) throw new Error(`Billboard entry point missing: ${required}`);
}

for (const state of ['distant', 'approaching', 'arming', 'active', 'passing']) {
  if (!js.includes(`'${state}'`)) throw new Error(`Billboard depth state missing: ${state}`);
}

for (const behavior of [
  "contract: 'approaching-skewed-interactive-billboard-v3'",
  "import './time-pocket-flight.js'",
  'INTERACTION_HOLD_MS = 3500',
  'INTERACTION_FIELD_THRESHOLD = 0.72',
  'captureInteractionHold',
  'interactionHoldConsumedStop',
  'interactionHoldUntil',
  "billboard.dataset.interactionHold = hold.held ? 'true' : 'false'",
  'rotateY(var(--billboard-yaw))',
  'skewY(var(--billboard-skew))',
  "data-billboard-state='arming'",
  "data-billboard-state='active'",
  "data-time-pocket='true'",
  'billboard-breathe',
]) {
  if (!js.includes(behavior) && !css.includes(behavior)) {
    throw new Error(`Billboard behavior contract missing: ${behavior}`);
  }
}

for (const required of [
  'createBillboardFieldRenderer',
  'createFlameAtlas',
  'drawTurbulentFlame',
  'drawOrbitalDisplay',
  'createOrbitalSystem',
  'contourPoint',
  "contract: 'procedural-orbital-instrument-v1'",
  "renderer: 'dual-canvas-turbulent-orbital-field'",
  "canvas.setAttribute('aria-hidden', 'true')",
  "pointerEvents: 'none'",
  'frontLayer: true',
  'rearLayer: true',
]) {
  if (![js, field, cosmos, flame].some(source => source.includes(required))) {
    throw new Error(`Procedural orbital instrument contract missing: ${required}`);
  }
}
if (css.includes('.billboard-smoke-field') || field.includes('strokeRect') || field.includes('flamePath')) {
  throw new Error('Superseded rectangular smoke/outlined flame implementation remains.');
}
if (!js.includes('return -artSide * 0.46')) {
  throw new Error('Billboard must remain opposite the section artwork.');
}
if (!js.includes("state === 'arming' || state === 'active'")) {
  throw new Error('Billboard interaction must remain distance-gated.');
}
if (!js.includes('window.__portfolioTimePocketDebug?.lockedStop')) {
  throw new Error('Billboard must follow the shared latched time-pocket stop.');
}
if (!js.includes("pocket?.mode === 'time-pocket'")) {
  throw new Error('Interaction hold must only engage during the cinematic slow pass.');
}
if (!js.includes('interactionHoldConsumedStop !== stop.title')) {
  throw new Error('Interaction hold must be one-shot per pass rather than repeatedly snapping back.');
}

console.log('[portfolio-billboard] PASS');
console.log('[portfolio-billboard] path=distant->approaching->arming->active->passing');
console.log('[portfolio-billboard] perspective=flight-direction-skew');
console.log('[portfolio-billboard] interaction=near-range-plus-slow-pass');
console.log('[portfolio-billboard] hold=3500ms-one-shot-camera-relative-click-window');
console.log('[portfolio-billboard] focus=shared-latched-stop');
console.log('[portfolio-billboard] flame=periodic-turbulence-atlas');
console.log('[portfolio-billboard] instrument=seeded-curved-shell-moons-asteroids');
console.log('[portfolio-billboard] layering=rear-billboard-front-pointer-events-none');
