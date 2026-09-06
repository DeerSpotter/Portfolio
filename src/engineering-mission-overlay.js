import {
  createLoadingPrologueRenderer,
  LOADING_PROLOGUE_CONTRACT,
  LOADING_PROLOGUE_DURATION_MS,
} from './engineering-loading-prologue.js';
import {
  createEngineeringSketchField,
  ENGINEERING_SKETCH_FIELD_CONTRACT,
} from './engineering-sketch-field.js';

const canvas = document.createElement('canvas');
canvas.id = 'engineeringMissionThread';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'auto',
  zIndex: '20',
});

document.body.insertBefore(canvas, document.getElementById('ship3d'));

const shipCanvas = document.getElementById('ship3d');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const prologueRenderer = createLoadingPrologueRenderer(canvas);
const sketchRenderer = createEngineeringSketchField();
const params = new URLSearchParams(location.search);
const forcePrologueForAutomation = params.has('prologue-test');
const skipPrologue = params.has('brief') || (navigator.webdriver && !forcePrologueForAutomation);

let cssW = 1;
let cssH = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let prologueComplete = skipPrologue;
let forcedPhase = skipPrologue ? 1 : null;
let lastStage = skipPrologue ? 'complete' : 'ignition';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function resize() {
  cssW = innerWidth;
  cssH = innerHeight;
  pixelRatio = Math.max(0.7, Math.min(1.25, devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.round(cssW * pixelRatio));
  canvas.height = Math.max(1, Math.round(cssH * pixelRatio));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function blockFlightInput(event) {
  if (prologueComplete) return;
  if (event.type === 'keydown') {
    const blockedKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
    if (!blockedKeys.has(event.key)) return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}

addEventListener('wheel', blockFlightInput, { passive: false, capture: true });
addEventListener('touchmove', blockFlightInput, { passive: false, capture: true });
addEventListener('keydown', blockFlightInput, { capture: true });

function finishPrologue() {
  if (prologueComplete) return;
  prologueComplete = true;
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  prologueRenderer.hide();
  if (shipCanvas) shipCanvas.style.removeProperty('opacity');
  dispatchEvent(new CustomEvent('portfolio-loading-prologue-complete'));
}

window.__portfolioSetProloguePhaseForTest = value => {
  if (!forcePrologueForAutomation) return false;
  const phase = Number(value);
  if (!Number.isFinite(phase)) return false;
  forcedPhase = clamp(phase);
  if (forcedPhase < 1) {
    prologueComplete = false;
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '20';
    prologueRenderer.show();
  }
  return true;
};

function render(now) {
  ctx.clearRect(0, 0, cssW, cssH);
  const flight = window.__portfolioCanvasDebug;
  const ship = window.__portfolioShipDebug;
  const appReady = Boolean(flight?.ready && ship?.ready);
  const shipScreen = ship?.ready
    ? { x: ship.ship?.screenX, y: ship.ship?.screenY }
    : null;

  let prologueState = {
    contract: LOADING_PROLOGUE_CONTRACT,
    phase: 1,
    stage: 'complete',
    softwareFocused: false,
    commandIssued: false,
    payloadReleased: true,
    loadingProgress: 1,
    shipOpacity: 1,
    appReady,
    complete: true,
    renderer: 'three-launch-background',
  };

  if (!prologueComplete) {
    const elapsedPhase = (now - startedAt) / LOADING_PROLOGUE_DURATION_MS;
    let phase = forcedPhase ?? elapsedPhase;
    if (!appReady && phase >= 1) phase = 0.997;
    phase = clamp(phase);

    prologueState = prologueRenderer.render(ctx, cssW, cssH, phase, appReady, shipScreen);
    lastStage = prologueState.stage;

    if (shipCanvas) shipCanvas.style.opacity = String(prologueState.shipOpacity);

    if (phase >= 1 && appReady) finishPrologue();
  }

  let sketchState = {
    contract: ENGINEERING_SKETCH_FIELD_CONTRACT,
    active: false,
    motifCount: 0,
    visibleCount: 0,
    visible: [],
    style: 'technical-notebook-linework',
    timeline: 'full-loop',
  };

  if (prologueComplete && flight?.ready) {
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    sketchState = sketchRenderer.render(ctx, cssW, cssH, flight.progress, Boolean(flight.degraded));
  }

  window.__portfolioEngineeringMissionDebug = {
    ready: true,
    renderer: 'three-launch-loading-plus-persistent-sketch-canvas',
    input: prologueComplete ? 'scroll-owned-flight-progress' : 'loading-sequence-time',
    reparenting: false,
    proprietaryUI: false,
    storyArc: 'three-launch-to-live-flight',
    storyActive: !prologueComplete,
    storyStage: prologueComplete ? 'normal-flight' : lastStage,
    prologue: prologueState,
    sketchField: sketchState,
    loadingDurationMs: LOADING_PROLOGUE_DURATION_MS,
    loadingInputBlocked: !prologueComplete,
    loadingUi: 'progress-bar-only',
    liveShipTransition: prologueComplete ? 'normal-flight' : 'payload-release-to-existing-three-overlay',
  };

  requestAnimationFrame(render);
}

addEventListener('resize', resize, { passive: true });
addEventListener('visibilitychange', () => {
  if (!document.hidden && !prologueComplete && forcedPhase === null) startedAt = performance.now();
});
resize();
if (skipPrologue) {
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  prologueRenderer.hide();
}
requestAnimationFrame(render);
