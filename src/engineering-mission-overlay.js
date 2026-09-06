import { createEngineeringMissionThread, ENGINEERING_MISSION_CONTRACT } from './engineering-mission-thread.js';

const canvas = document.createElement('canvas');
canvas.id = 'engineeringMissionThread';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
  zIndex: '1',
});

document.body.insertBefore(canvas, document.getElementById('ship3d'));

const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const renderer = createEngineeringMissionThread();
let cssW = 1;
let cssH = 1;
let pixelRatio = 1;

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

function render(now) {
  ctx.clearRect(0, 0, cssW, cssH);
  const flight = window.__portfolioCanvasDebug;
  let state = {
    contract: ENGINEERING_MISSION_CONTRACT,
    active: false,
    phase: null,
    stage: 'waiting-for-flight',
    commandIssued: false,
  };

  if (flight?.ready) {
    state = renderer.render(ctx, cssW, cssH, flight.progress, now, Boolean(flight.degraded));
  }

  window.__portfolioEngineeringMissionDebug = {
    ...state,
    ready: true,
    renderer: 'isolated-transparent-canvas',
    input: 'scroll-owned-flight-progress',
    reparenting: false,
    proprietaryUI: false,
  };
  requestAnimationFrame(render);
}

addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(render);
