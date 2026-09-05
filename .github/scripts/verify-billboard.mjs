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

for (const flameBehavior of [
  "import { createBillboardSmokeRenderer } from './billboard-smoke.js'",
  'createBillboardSmokeRenderer({ hud, billboard, reducedMotion })',
  "FLAME_CONTRACT = 'canvas2d-industrial-edge-flame-v3'",
  'MAX_REAR_PARTICLES = 58',
  'MAX_FRONT_PARTICLES = 34',
  'INDUSTRIAL_PALETTES',
  "makeCanvas('billboard-flame-canvas billboard-flame-canvas-rear', 1)",
  "makeCanvas('billboard-flame-canvas billboard-flame-canvas-front', 3)",
  "canvas.setAttribute('aria-hidden', 'true')",
  "pointerEvents: 'none'",
  'function frontEmissionRate(',
  'function rearEmissionRate(',
  'function drawFlameTongue(',
  'ctx.quadraticCurveTo',
  'createLinearGradient',
  'interactionHold ? 0.33',
  "renderer: 'dual-canvas-2d-industrial-flames'",
  'frontLayer: true',
  'rearLayer: true',
  'smokeFrontParticleCount: smoke.frontParticleCount',
  'smokeRearParticleCount: smoke.rearParticleCount',
  'smokeFrontLayer: smoke.frontLayer',
  'smokeRearLayer: smoke.rearLayer',
  'smokeContract: smoke.contract',
]) {
  if (!js.includes(flameBehavior) && !smoke.includes(flameBehavior)) {
    throw new Error(`Industrial billboard flame contract missing: ${flameBehavior}`);
  }
}

if (js.includes("smokeField.className = 'billboard-smoke-field'") || js.includes('SMOKE_PLUME_COUNT')) {
  throw new Error('The old CSS plume smoke renderer is still active in billboard-flight.js.');
}
if (smoke.includes("canvas.className = 'billboard-smoke-canvas'")) {
  throw new Error('The old single behind-card smoke canvas is still active.');
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
console.log('[portfolio-billboard] flame=dual-canvas-industrial-edge-tongues');
console.log('[portfolio-billboard] flamePalette=charcoal-brown-olive-orange-rust');
console.log('[portfolio-billboard] layering=rear-billboard-front-pointer-events-none');
