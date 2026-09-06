import { createEngineeringMissionThread, ENGINEERING_MISSION_CONTRACT } from './engineering-mission-thread.js';
import { createOrbitalHandoffRenderer, ORBITAL_HANDOFF_CONTRACT } from './engineering-orbital-handoff.js';

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

const shipCanvas = document.getElementById('ship3d');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const missionRenderer = createEngineeringMissionThread();
const orbitalRenderer = createOrbitalHandoffRenderer();
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
  const ship = window.__portfolioShipDebug;
  let missionState = {
    contract: ENGINEERING_MISSION_CONTRACT,
    active: false,
    phase: null,
    stage: 'waiting-for-flight',
    commandIssued: false,
  };
  let handoffState = {
    contract: ORBITAL_HANDOFF_CONTRACT,
    active: false,
    phase: null,
    stage: 'waiting-for-flight',
    payloadReleased: false,
    shipOpacity: 1,
  };

  if (flight?.ready) {
    const degraded = Boolean(flight.degraded);
    missionState = missionRenderer.render(ctx, cssW, cssH, flight.progress, now, degraded);
    const shipScreen = ship?.ready ? { x: ship.ship?.screenX, y: ship.ship?.screenY } : null;
    handoffState = orbitalRenderer.render(ctx, cssW, cssH, flight.progress, now, degraded, shipScreen);
  }

  // The live Three.js ship is the payload at the end of the story. Hide it while
  // the command/network/launch sequence is in front of the visitor, then reveal
  // that exact renderer at payload separation instead of drawing a substitute.
  if (shipCanvas) {
    if (handoffState.active) shipCanvas.style.opacity = String(handoffState.shipOpacity);
    else shipCanvas.style.removeProperty('opacity');
  }

  const storyActive = Boolean(missionState.active || handoffState.active);
  const storyStage = handoffState.active ? handoffState.stage : missionState.stage;

  window.__portfolioEngineeringMissionDebug = {
    ...missionState,
    ready: true,
    renderer: 'isolated-transparent-canvas',
    input: 'scroll-owned-flight-progress',
    reparenting: false,
    proprietaryUI: false,
    storyArc: 'engineering-to-command-to-orbit-to-live-flight',
    storyActive,
    storyStage,
    orbitalHandoff: handoffState,
    liveShipTransition: handoffState.active ? 'payload-release-to-existing-three-overlay' : 'normal-flight',
  };
  requestAnimationFrame(render);
}

addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(render);
