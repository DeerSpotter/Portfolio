import * as THREE from 'three';
import { createShipStub, setShipWarp } from './ship-stub.js';

const canvas = document.getElementById('ship3d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
camera.position.set(0, 0, 700);
camera.lookAt(0, 0, 0);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xfff6df, 0x7c6648, 1.55));
const key = new THREE.DirectionalLight(0xfffbef, 2.6);
key.position.set(220, 320, 520);
scene.add(key);
const warmFill = new THREE.DirectionalLight(0xd28a51, 1.05);
warmFill.position.set(-260, -80, 360);
scene.add(warmFill);

// Reuse the exact documented procedural ship from the live-3D prototype.
// Only this model is WebGL. The illustrated world remains on #world unchanged.
const model = createShipStub({ quality: 'medium' });
const ship = new THREE.Group();
ship.name = 'canvas-flight-3d-ship-overlay';
ship.add(model);
scene.add(ship);

let cssW = window.innerWidth;
let cssH = window.innerHeight;
let lastTime = performance.now();
let currentX = 0;
let currentY = 0;
let currentBank = 0;
let currentPitch = Math.PI * 0.39;
let currentYaw = 0;
let currentScale = 1;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function resize() {
  cssW = window.innerWidth;
  cssH = window.innerHeight;

  // The background canvas already adapts itself. This overlay is only one small
  // object, so cap DPR to avoid making the 3D ship the expensive part.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(cssW, cssH, false);

  camera.left = -cssW * 0.5;
  camera.right = cssW * 0.5;
  camera.top = cssH * 0.5;
  camera.bottom = -cssH * 0.5;
  camera.updateProjectionMatrix();
}

function shipPoint(progress) {
  return {
    x: cssW * (0.50 + Math.sin(progress * TAU * 1.45) * 0.070 + Math.sin(progress * TAU * 3.1) * 0.018),
    y: cssH * (0.72 + Math.cos(progress * TAU * 1.20) * 0.030),
  };
}

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const state = window.__portfolioCanvasDebug;
  if (state?.ready) {
    const progress = state.progress;
    const point = shipPoint(progress);
    const speed = Math.abs(state.velocity);
    const warp = reducedMotion ? 0 : clamp(speed * 5, 0, 1);

    // Match the same screen position and gentle bob used by the illustrated ship.
    const bob = reducedMotion ? 0 : Math.sin(now * 0.0025) * 1.8;
    const targetX = point.x - cssW * 0.5;
    const targetY = cssH * 0.5 - (point.y + bob);

    currentX = damp(currentX, targetX, 12, dt);
    currentY = damp(currentY, targetY, 12, dt);

    // Preserve the canvas branch's existing bank language instead of inventing
    // a new flight controller for the 3D model.
    const targetBank = clamp(state.velocity * 0.11 + Math.sin(state.travel * TAU * 1.45) * 0.10, -0.34, 0.34);
    const targetYaw = clamp((point.x / cssW - 0.5) * -0.42, -0.18, 0.18);
    const targetPitch = Math.PI * 0.39 + warp * 0.07;

    currentBank = dampAngle(currentBank, targetBank, 8.5, dt);
    currentYaw = dampAngle(currentYaw, targetYaw, 8.0, dt);
    currentPitch = dampAngle(currentPitch, targetPitch, 8.0, dt);

    const targetScale = clamp(0.92 + speed * 0.020, 0.92, 1.12);
    currentScale = damp(currentScale, targetScale, 7.0, dt);

    ship.position.set(currentX, currentY, 0);
    ship.rotation.set(currentPitch, currentYaw, currentBank);

    // The original procedural ship is only a few world units wide. Scale it in
    // orthographic pixel-space so it occupies roughly the same footprint as the
    // old illustrated ship while remaining fully 3D.
    ship.scale.setScalar(28.5 * currentScale);
    setShipWarp(model, warp);
    ship.visible = true;

    window.__portfolioShipDebug = {
      ready: true,
      engine: 'three-overlay',
      model: 'documented-procedural-stub-v2',
      sourceState: 'portfolio-canvas-debug',
      progress,
      x: point.x,
      y: point.y,
      bank: currentBank,
      pitch: currentPitch,
      yaw: currentYaw,
      warp,
      pixelRatio: renderer.getPixelRatio(),
      backgroundRenderer: state.engine,
      movement: state.movement,
      palette: state.palette,
    };
  } else {
    ship.visible = false;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

resize();
requestAnimationFrame(animate);
