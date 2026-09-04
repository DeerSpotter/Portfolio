import * as THREE from 'three';
import { createShipStub, setShipWarp } from './ship-stub.js';

const canvas = document.getElementById('ship3d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight, false);

// This scene deliberately contains only the original procedural ship and its
// lighting. The old 3D stars, nebulae, gates, moons, ribbons, asteroids and
// warp-streak objects are not created here. The illustrated #world canvas is
// the complete environment behind the ship.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1800);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x96c8ff, 0x12091d, 1.35));
const keyLight = new THREE.DirectionalLight(0xf7fbff, 2.8);
keyLight.position.set(6, 10, 4);
scene.add(keyLight);
const rim = new THREE.PointLight(0x4bbcff, 13, 32, 2);
rim.position.set(0, 3.5, 4.5);
scene.add(rim);

// Same procedural ship module used by the first live-3D implementation.
// With the rest of the 3D world removed, the high-detail tier is inexpensive.
const ship = createShipStub({ quality: 'high' });
scene.add(ship);

// Same closed 3D route from the first implementation. It is math only: no 3D
// route geometry is rendered. Canvas progress drives position on this route.
const route = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(2, 0.4, -55),
  new THREE.Vector3(-8, 4.0, -120),
  new THREE.Vector3(12, -2.0, -185),
  new THREE.Vector3(34, 1.0, -255),
  new THREE.Vector3(16, 7.0, -325),
  new THREE.Vector3(-22, 3.0, -350),
  new THREE.Vector3(-55, -4.0, -300),
  new THREE.Vector3(-72, 2.0, -220),
  new THREE.Vector3(-58, 6.0, -135),
  new THREE.Vector3(-30, -2.0, -55),
  new THREE.Vector3(-10, -1.0, 15),
  new THREE.Vector3(-2, 0.1, 60),
], true, 'catmullrom', 0.48);

const worldUp = new THREE.Vector3(0, 1, 0);
const tmpPos = new THREE.Vector3();
const tangent = new THREE.Vector3();
const curvatureProbe = new THREE.Vector3();
const right = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

let lastTime = performance.now();
let warpAmount = 0;

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const state = window.__portfolioCanvasDebug;
  if (!state?.ready) {
    ship.visible = false;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    return;
  }

  ship.visible = true;

  // Use the canvas journey's already-damped progress so the illustrated world
  // and 3D ship stay on the same scroll beat. From this point forward, the ship
  // attitude and chase camera are the original live3d.js implementation.
  const progress = state.progress;
  const velocity = state.velocity;
  const speedSignal = Math.min(1, Math.abs(velocity) * 7.2);
  warpAmount = damp(warpAmount, reducedMotion ? 0 : speedSignal, 5.8, dt);

  route.getPointAt(progress, tmpPos);
  route.getTangentAt(progress, tangent).normalize();
  right.crossVectors(tangent, worldUp).normalize();
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);

  ship.position.copy(tmpPos);
  const yaw = Math.atan2(-tangent.x, -tangent.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));
  route.getTangentAt(wrap01(progress + 0.008), curvatureProbe).normalize();
  const turnSignal = right.dot(curvatureProbe) * -1;
  const targetRoll = reducedMotion ? 0 : THREE.MathUtils.clamp(turnSignal * 2.55 - velocity * 0.26, -0.82, 0.82);

  ship.rotation.y = dampAngle(ship.rotation.y, yaw, 8.5, dt);
  ship.rotation.x = dampAngle(ship.rotation.x, -pitch * 0.86, 8.5, dt);
  ship.rotation.z = dampAngle(ship.rotation.z, targetRoll, 7.2, dt);
  setShipWarp(ship, warpAmount);

  // Exact third-person chase-camera language from the first 3D prototype:
  // camera behind and above the ship, looking forward down the route. This is
  // intentionally NOT an orthographic/top-down screen-space placement.
  desiredCamera.copy(tmpPos)
    .addScaledVector(tangent, -11.6 - warpAmount * 5.5)
    .addScaledVector(worldUp, 4.5 + warpAmount * 0.8)
    .addScaledVector(right, -ship.rotation.z * 0.92);
  camera.position.lerp(desiredCamera, 1 - Math.exp(-5.2 * dt));

  desiredLook.copy(tmpPos)
    .addScaledVector(tangent, 13.5 + warpAmount * 12)
    .addScaledVector(worldUp, 0.35);
  camera.lookAt(desiredLook);

  const nextFov = damp(camera.fov, 48 + warpAmount * 14, 6.2, dt);
  if (Math.abs(nextFov - camera.fov) > 0.015) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }

  window.__portfolioShipDebug = {
    ready: true,
    engine: 'three-overlay',
    model: 'documented-procedural-stub-v2',
    quality: 'high',
    flightContract: 'original-live3d-third-person-chase',
    cameraType: 'perspective',
    progress,
    velocity,
    warpAmount,
    ship: {
      x: ship.position.x,
      y: ship.position.y,
      z: ship.position.z,
      pitch: ship.rotation.x,
      yaw: ship.rotation.y,
      roll: ship.rotation.z,
    },
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      fov: camera.fov,
    },
    backgroundRenderer: state.engine,
    movement: state.movement,
    palette: state.palette,
    rendered3dWorldItems: [],
    pixelRatio: renderer.getPixelRatio(),
  };

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

requestAnimationFrame(animate);
