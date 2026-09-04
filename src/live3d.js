import * as THREE from 'three';
import { createShipStub, setShipWarp } from './ship-stub.js';

const canvas = document.getElementById('world');
const loading = document.getElementById('loading');
const fallback = document.getElementById('fallback');
const distanceEl = document.getElementById('distance');
const velocityEl = document.getElementById('velocity');
const bankEl = document.getElementById('bank');
const warpEl = document.getElementById('warp');
const chapterEl = document.getElementById('chapterName');
const hintEl = document.getElementById('hint');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (error) {
  fallback.style.display = 'grid';
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01030a);
scene.fog = new THREE.FogExp2(0x020713, 0.0042);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1600);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x8cb8ff, 0x080b16, 1.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(5, 9, 3);
scene.add(keyLight);
const rim = new THREE.PointLight(0x409cff, 12, 28, 2);
rim.position.set(0, 2.5, 3.5);
scene.add(rim);

const ship = createShipStub();
scene.add(ship);

const route = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(3.0, 1.3, -45),
  new THREE.Vector3(-5.0, 3.8, -95),
  new THREE.Vector3(7.5, -1.8, -150),
  new THREE.Vector3(-9.0, -4.2, -215),
  new THREE.Vector3(2.5, 6.0, -285),
  new THREE.Vector3(11.0, 1.0, -360),
  new THREE.Vector3(-8.5, 4.0, -445),
  new THREE.Vector3(0, 0, -540),
], false, 'catmullrom', 0.48);

const ROUTE_LENGTH = route.getLength();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeStars() {
  const count = reducedMotion ? 1400 : 3600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 30 + Math.random() * 130;
    const theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 105;
    positions[i * 3 + 2] = -Math.random() * 720 + 70;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xdce9ff,
    size: 0.34,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Points(geometry, material);
}
const stars = makeStars();
scene.add(stars);

function makeSectorGate(z, color, radius = 7.5) {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.09, 10, 72), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.035, 8, 64), ringMaterial.clone());
  inner.material.opacity = 0.14;
  inner.rotation.x = Math.PI / 2;
  group.add(inner);
  group.position.z = z;
  return group;
}

const gates = [
  makeSectorGate(-82, 0x56b4ff, 8.0),
  makeSectorGate(-175, 0xc587ff, 10.0),
  makeSectorGate(-285, 0x62e6c8, 8.8),
  makeSectorGate(-395, 0xffa75a, 10.8),
  makeSectorGate(-505, 0x8ab4ff, 9.2),
];
gates.forEach((gate, i) => {
  gate.position.x = [2, -5, 5, -4, 0][i];
  gate.position.y = [1, 3, -2, 4, 0][i];
  scene.add(gate);
});

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x303849, metalness: 0.2, roughness: 0.82 });
for (let i = 0; i < 38; i++) {
  const geometry = new THREE.IcosahedronGeometry(0.5 + Math.random() * 1.65, 1);
  const rock = new THREE.Mesh(geometry, obstacleMaterial);
  const t = 0.08 + Math.random() * 0.9;
  const p = route.getPointAt(t);
  const side = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 17);
  rock.position.set(p.x + side, p.y + (Math.random() - 0.5) * 15, p.z + (Math.random() - 0.5) * 16);
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(rock);
}

const chapters = [
  { at: 0.00, name: 'Departure' },
  { at: 0.18, name: 'Engineering Foundations' },
  { at: 0.36, name: 'Automation' },
  { at: 0.55, name: 'AI Systems' },
  { at: 0.73, name: 'Runtime Engineering' },
  { at: 0.90, name: 'Next Sector' },
];

function currentChapter(progress) {
  let chapter = chapters[0];
  for (const candidate of chapters) if (progress >= candidate.at) chapter = candidate;
  return chapter.name;
}

let targetProgress = 0;
let progress = 0;
let lastProgress = 0;
let velocity = 0;
let warpAmount = 0;
let lastTime = performance.now();
let lastScrollY = window.scrollY;

function updateTargetFromScroll() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  targetProgress = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1);
  if (Math.abs(window.scrollY - lastScrollY) > 12) hintEl.style.opacity = '0.48';
  lastScrollY = window.scrollY;
}
window.addEventListener('scroll', updateTargetFromScroll, { passive: true });
updateTargetFromScroll();

const tmpPos = new THREE.Vector3();
const tmpAhead = new THREE.Vector3();
const tangent = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const progressLambda = reducedMotion ? 18 : 6.4;
  progress = damp(progress, targetProgress, progressLambda, dt);
  velocity = (progress - lastProgress) / dt;
  lastProgress = progress;

  const speedSignal = Math.min(1, Math.abs(velocity) * 7.5);
  warpAmount = damp(warpAmount, reducedMotion ? 0 : speedSignal, 5.5, dt);

  route.getPointAt(progress, tmpPos);
  route.getPointAt(Math.min(1, progress + 0.006), tmpAhead);
  tangent.copy(tmpAhead).sub(tmpPos).normalize();

  ship.position.copy(tmpPos);
  const yaw = Math.atan2(-tangent.x, -tangent.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));
  const sideSignal = THREE.MathUtils.clamp((tmpAhead.x - tmpPos.x) * 2.8, -1, 1);
  const targetRoll = reducedMotion ? 0 : -sideSignal * 0.72 - THREE.MathUtils.clamp(velocity * 1.7, -0.28, 0.28);
  ship.rotation.y = damp(ship.rotation.y, yaw, 8, dt);
  ship.rotation.x = damp(ship.rotation.x, -pitch * 0.78, 8, dt);
  ship.rotation.z = damp(ship.rotation.z, targetRoll, 7, dt);
  setShipWarp(ship, warpAmount);

  desiredCamera.copy(tmpPos)
    .addScaledVector(tangent, -8.6 - warpAmount * 4.8)
    .addScaledVector(up, 3.8 + warpAmount * 0.8);
  desiredCamera.x += Math.sin(progress * Math.PI * 5) * 0.45;
  camera.position.lerp(desiredCamera, 1 - Math.exp(-5.6 * dt));
  desiredLook.copy(tmpPos).addScaledVector(tangent, 12 + warpAmount * 10);
  camera.lookAt(desiredLook);
  camera.fov = damp(camera.fov, 46 + warpAmount * 12, 6, dt);
  camera.updateProjectionMatrix();

  stars.material.size = 0.34 + warpAmount * 0.36;
  stars.rotation.z += dt * 0.002;
  for (let i = 0; i < gates.length; i++) {
    gates[i].rotation.z += dt * (0.08 + i * 0.015);
    gates[i].children[0].material.opacity = 0.25 + Math.sin(now * 0.0015 + i) * 0.06;
  }

  const traveled = Math.round(progress * ROUTE_LENGTH);
  distanceEl.textContent = String(traveled).padStart(4, '0');
  velocityEl.textContent = (Math.abs(velocity) * ROUTE_LENGTH).toFixed(2);
  bankEl.textContent = `${Math.round(THREE.MathUtils.radToDeg(ship.rotation.z))}°`;
  warpEl.textContent = `${Math.round(warpAmount * 100)}%`;
  chapterEl.textContent = currentChapter(progress);

  window.__portfolioDebug = {
    ready: true,
    targetProgress,
    progress,
    routeLength: ROUTE_LENGTH,
    ship: {
      x: ship.position.x,
      y: ship.position.y,
      z: ship.position.z,
      pitch: ship.rotation.x,
      yaw: ship.rotation.y,
      roll: ship.rotation.z,
    },
    camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov },
    warpAmount,
    chapter: currentChapter(progress),
    shipAsset: 'documented-procedural-stub',
  };

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize, { passive: true });

loading.classList.add('done');
requestAnimationFrame(animate);
