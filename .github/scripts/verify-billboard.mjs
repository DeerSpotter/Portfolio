import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/billboard.css', 'utf8');
const js = readFileSync('src/billboard-flight.js', 'utf8');
const smoke = readFileSync('src/billboard-smoke.js', 'utf8');

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
  'billboard-scan',
  'billboard-breathe',
]) {
  if (!js.includes(behavior) && !css.includes(behavior)) {
    throw new Error(`Billboard behavior contract missing: ${behavior}`);
  }
}

for (const smokeBehavior of [
  "import { createBillboardSmokeRenderer } from './billboard-smoke.js'",
  'createBillboardSmokeRenderer({ hud, billboard, reducedMotion })',
  "SMOKE_CONTRACT = 'canvas2d-charcoal-wisp-smoke-v2'",
  "canvas.className = 'billboard-smoke-canvas'",
  "canvas.setAttribute('aria-hidden', 'true')",
  "pointerEvents: 'none'",
  "mixBlendMode: 'multiply'",
  'MAX_PARTICLES = 64',
  'function spawn(',
  'function updateParticle(',
  'function drawWisp(',
  'ctx.quadraticCurveTo',
  'createLinearGradient',
  'stateStrength(',
  'emissionRate(',
  'interactionHold ? 0.34',
  "renderer: 'canvas-2d-particle-wisps'",
  'smokeParticleCount: smoke.particleCount',
  'smokeContract: smoke.contract',
]) {
  if (!js.includes(smokeBehavior) && !smoke.includes(smokeBehavior)) {
    throw new Error(`JavaScript charcoal smoke contract missing: ${smokeBehavior}`);
  }
}

if (js.includes("smokeField.className = 'billboard-smoke-field'") || js.includes('SMOKE_PLUME_COUNT')) {
  throw new Error('The old CSS plume smoke renderer is still active in billboard-flight.js.');
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
console.log('[portfolio-billboard] smoke=canvas2d-directional-charcoal-wisps');
console.log('[portfolio-billboard] smokeInteraction=behind-card-pointer-events-none');
