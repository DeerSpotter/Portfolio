import * as THREE from 'three';
import { createShipStub, setShipEngineState } from './ship-stub.js';

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

const ship = createShipStub({ quality: 'high' });
scene.add(ship);

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
const routePos = new THREE.Vector3();
const smoothPos = new THREE.Vector3();
const tangent = new THREE.Vector3();
const smoothTangent = new THREE.Vector3(0, 0, -1);
const curvatureProbe = new THREE.Vector3();
const right = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
let poseInitialized = false;
let activeBankSide = 0;

const BANK_DEADBAND = 0.035;
const BANK_CENTER_EPSILON = 0.025;

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
let coastAmount = 0;
let timeFieldAmount = 0;
let filteredVelocity = 0;

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

  const progress = state.progress;
  const velocity = state.velocity;
  const pocket = window.__portfolioTimePocketDebug;
  coastAmount = damp(coastAmount, reducedMotion ? 0 : (pocket?.coastStrength || 0), 4.6, dt);
  timeFieldAmount = damp(timeFieldAmount, reducedMotion ? 0 : (pocket?.timeFieldStrength || 0), 4.0, dt);
  filteredVelocity = damp(filteredVelocity, velocity, coastAmount > 0.2 ? 4.2 : 7.8, dt);

  const speedSignal = Math.min(1, Math.abs(filteredVelocity) * 7.2);
  warpAmount = damp(warpAmount, reducedMotion ? 0 : speedSignal, coastAmount > 0.2 ? 3.4 : 5.8, dt);

  route.getPointAt(progress, routePos);
  route.getTangentAt(progress, tangent).normalize();

  if (!poseInitialized) {
    smoothPos.copy(routePos);
    smoothTangent.copy(tangent);
    poseInitialized = true;
  } else {
    const positionLambda = 9.0 - coastAmount * 3.2 - timeFieldAmount * 1.4;
    const tangentLambda = 7.5 - coastAmount * 2.6 - timeFieldAmount * 1.3;
    smoothPos.lerp(routePos, 1 - Math.exp(-Math.max(3.2, positionLambda) * dt));
    smoothTangent.lerp(tangent, 1 - Math.exp(-Math.max(2.8, tangentLambda) * dt)).normalize();
  }

  right.crossVectors(smoothTangent, worldUp).normalize();
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);

  ship.position.copy(smoothPos);
  const yaw = Math.atan2(-smoothTangent.x, -smoothTangent.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(smoothTangent.y, -1, 1));
  route.getTangentAt(wrap01(progress + 0.008), curvatureProbe).normalize();
  const turnSignal = right.dot(curvatureProbe) * -1;
  const coastCalm = Math.max(0.18, 1 - coastAmount * 0.45 - timeFieldAmount * 0.36);
  const targetRoll = reducedMotion ? 0 : THREE.MathUtils.clamp(
    (turnSignal * 2.55 - filteredVelocity * 0.26) * coastCalm,
    -0.82,
    0.82,
  );

  // Bank is the only presentation behavior changed here. Never swing directly
  // from one side to the other: ease the current bank back through level first,
  // then allow the opposite bank to begin. Position, yaw, pitch and camera keep
  // the established flight response unchanged.
  const requestedBankSide = Math.abs(targetRoll) > BANK_DEADBAND ? Math.sign(targetRoll) : 0;
  let bankTargetRoll = targetRoll;
  if (reducedMotion || requestedBankSide === 0) {
    bankTargetRoll = 0;
    if (Math.abs(ship.rotation.z) <= BANK_CENTER_EPSILON) activeBankSide = 0;
  } else if (activeBankSide === 0) {
    activeBankSide = requestedBankSide;
  } else if (requestedBankSide !== activeBankSide) {
    bankTargetRoll = 0;
    if (Math.abs(ship.rotation.z) <= BANK_CENTER_EPSILON) {
      activeBankSide = requestedBankSide;
      bankTargetRoll = targetRoll;
    }
  }

  const attitudeLambda = Math.max(3.4, 8.5 - coastAmount * 3.2 - timeFieldAmount * 1.2);
  ship.rotation.y = dampAngle(ship.rotation.y, yaw, attitudeLambda, dt);
  ship.rotation.x = dampAngle(ship.rotation.x, -pitch * 0.86, attitudeLambda, dt);
  ship.rotation.z = dampAngle(ship.rotation.z, bankTargetRoll, Math.max(3.0, 7.2 - coastAmount * 2.8 - timeFieldAmount), dt);

  setShipEngineState(ship, {
    thrust: warpAmount,
    coast: coastAmount,
    time: reducedMotion ? 0 : now * 0.001,
  });

  desiredCamera.copy(smoothPos)
    .addScaledVector(smoothTangent, -11.6 - warpAmount * 5.5)
    .addScaledVector(worldUp, 4.5 + warpAmount * 0.8)
    .addScaledVector(right, -ship.rotation.z * 0.92);
  const cameraLambda = Math.max(3.0, 5.2 - coastAmount * 1.15 - timeFieldAmount * 0.55);
  camera.position.lerp(desiredCamera, 1 - Math.exp(-cameraLambda * dt));

  desiredLook.copy(smoothPos)
    .addScaledVector(smoothTangent, 13.5 + warpAmount * 12)
    .addScaledVector(worldUp, 0.35);
  camera.lookAt(desiredLook);

  const fovLambda = Math.max(3.0, 6.2 - coastAmount * 1.8 - timeFieldAmount * 0.7);
  const nextFov = damp(camera.fov, 48 + warpAmount * 14, fovLambda, dt);
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
    motionContract: 'known-good-flight-centered-bank-v1',
    cameraType: 'perspective',
    progress,
    velocity,
    filteredVelocity,
    warpAmount,
    coastAmount,
    timeFieldAmount,
    bank: {
      activeSide: activeBankSide,
      requestedSide: requestedBankSide,
      targetRoll,
      appliedTargetRoll: bankTargetRoll,
    },
    exhaust: 'turbulent-nozzle-rooted-shader-v1',
    engineState: coastAmount > 0.45 ? 'idle-drift' : warpAmount > 0.16 ? 'thrust' : 'cruise',
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
