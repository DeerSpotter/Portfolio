import * as THREE from 'three';
import { createShipStub, setShipWarp } from './ship-stub.js';

const canvas = document.getElementById('world');
const loading = document.getElementById('loading');
const fallback = document.getElementById('fallback');
const distanceEl = document.getElementById('distance');
const velocityEl = document.getElementById('velocity');
const bankEl = document.getElementById('bank');
const warpEl = document.getElementById('warp');
const cycleEl = document.getElementById('cycle');
const chapterEl = document.getElementById('chapterName');
const hintEl = document.getElementById('hint');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forcedQuality = new URLSearchParams(window.location.search).get('quality');
const allowedQuality = new Set(['low', 'medium', 'high']);

function chooseAutomaticQuality() {
  if (reducedMotion) return 'low';

  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const physicalPixelLoad = window.innerWidth * window.innerHeight * dpr * dpr;

  let tier = 'high';
  if (cores <= 4 || memory <= 4) tier = 'low';
  else if (cores <= 6 || memory <= 8) tier = 'medium';

  // 4K/high-DPI screens can be harder on a GPU than the scene geometry itself.
  if (physicalPixelLoad > 6_500_000 && tier === 'high') tier = 'medium';
  if (physicalPixelLoad > 9_000_000 && tier === 'medium') tier = 'low';
  return tier;
}

const qualityTier = allowedQuality.has(forcedQuality) ? forcedQuality : chooseAutomaticQuality();
const QUALITY = {
  low: {
    antialias: false,
    maxPixelRatio: 0.85,
    starsFar: 950,
    starsNear: 300,
    nebulaTexture: 256,
    nebulaHaze: 22,
    ribbonCount: 1,
    ribbonSamples: 36,
    ribbonSegments: 88,
    ribbonRadial: 3,
    gateRings: 2,
    gateSegments: 40,
    gateLights: false,
    moonSegments: 16,
    moonRows: 10,
    obstacles: 20,
    obstacleDetail: 0,
    warpStreaks: 44,
    backgroundStride: 3,
  },
  medium: {
    antialias: false,
    maxPixelRatio: 1.05,
    starsFar: 1650,
    starsNear: 600,
    nebulaTexture: 320,
    nebulaHaze: 32,
    ribbonCount: 2,
    ribbonSamples: 48,
    ribbonSegments: 128,
    ribbonRadial: 4,
    gateRings: 2,
    gateSegments: 56,
    gateLights: false,
    moonSegments: 22,
    moonRows: 14,
    obstacles: 30,
    obstacleDetail: 0,
    warpStreaks: 72,
    backgroundStride: 2,
  },
  high: {
    antialias: true,
    maxPixelRatio: 1.35,
    starsFar: 2300,
    starsNear: 900,
    nebulaTexture: 384,
    nebulaHaze: 44,
    ribbonCount: 3,
    ribbonSamples: 60,
    ribbonSegments: 190,
    ribbonRadial: 4,
    gateRings: 3,
    gateSegments: 68,
    gateLights: true,
    moonSegments: 30,
    moonRows: 18,
    obstacles: 40,
    obstacleDetail: 0,
    warpStreaks: 96,
    backgroundStride: 1,
  },
}[qualityTier];

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: QUALITY.antialias,
    alpha: true,
    powerPreference: 'high-performance',
  });
} catch (error) {
  fallback.style.display = 'grid';
  throw error;
}

let renderScale = 1;
let actualPixelRatio = 1;
function applyRenderResolution() {
  const dpr = window.devicePixelRatio || 1;
  actualPixelRatio = Math.max(0.55, Math.min(QUALITY.maxPixelRatio, dpr * renderScale));
  renderer.setPixelRatio(actualPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

applyRenderResolution();
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05091a, 0.00225);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1800);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x96c8ff, 0x12091d, 1.35));
const keyLight = new THREE.DirectionalLight(0xf7fbff, 2.8);
keyLight.position.set(6, 10, 4);
scene.add(keyLight);
const rim = new THREE.PointLight(0x4bbcff, 13, 32, 2);
rim.position.set(0, 3.5, 4.5);
scene.add(rim);

const ship = createShipStub({ quality: qualityTier });
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

const ROUTE_LENGTH = route.getLength();
const worldUp = new THREE.Vector3(0, 1, 0);

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(0x51A7F00D);

function makeStars(count, radiusMin, radiusMax, size, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = radiusMin + random() * (radiusMax - radiusMin);
    positions[i * 3] = Math.cos(angle) * radius - 20;
    positions[i * 3 + 1] = (random() - 0.5) * 155;
    positions[i * 3 + 2] = -370 + (random() - 0.5) * 900;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xdcecff,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

const starsFar = makeStars(QUALITY.starsFar, 35, 170, 0.29, 0.72);
const starsNear = makeStars(QUALITY.starsNear, 12, 86, 0.43, 0.92);
scene.add(starsFar, starsNear);

function makeNebulaTexture(inner, mid, outer, seed) {
  const size = QUALITY.nebulaTexture;
  const nebulaCanvas = document.createElement('canvas');
  nebulaCanvas.width = size;
  nebulaCanvas.height = size;
  const ctx = nebulaCanvas.getContext('2d');
  const localRandom = mulberry32(seed);

  ctx.clearRect(0, 0, size, size);
  const base = ctx.createRadialGradient(size * 0.5, size * 0.5, 8, size * 0.5, size * 0.5, size * 0.5);
  base.addColorStop(0, inner);
  base.addColorStop(0.42, mid);
  base.addColorStop(1, outer);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < QUALITY.nebulaHaze; i++) {
    const x = size * (0.18 + localRandom() * 0.64);
    const y = size * (0.18 + localRandom() * 0.64);
    const radius = size * (0.04 + localRandom() * 0.15);
    const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
    haze.addColorStop(0, `rgba(255,255,255,${0.015 + localRandom() * 0.07})`);
    haze.addColorStop(0.4, `rgba(110,170,255,${0.01 + localRandom() * 0.035})`);
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const texture = new THREE.CanvasTexture(nebulaCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function addNebula(at, side, vertical, scale, colors, seed) {
  const point = route.getPointAt(at);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeNebulaTexture(...colors, seed),
    color: 0xffffff,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sprite.position.set(point.x + side, point.y + vertical, point.z - 18);
  sprite.scale.set(scale, scale, 1);
  scene.add(sprite);
  return sprite;
}

const nebulae = [
  addNebula(0.08, -55, 16, 92, ['rgba(70,205,255,.55)', 'rgba(35,74,170,.24)', 'rgba(0,0,0,0)'], 101),
  addNebula(0.31, 58, 4, 108, ['rgba(203,92,255,.52)', 'rgba(77,30,155,.25)', 'rgba(0,0,0,0)'], 202),
  addNebula(0.55, -42, -10, 94, ['rgba(71,255,214,.38)', 'rgba(18,115,128,.19)', 'rgba(0,0,0,0)'], 303),
  addNebula(0.78, 62, 18, 112, ['rgba(255,109,188,.46)', 'rgba(109,37,142,.22)', 'rgba(0,0,0,0)'], 404),
];

function makeEnergyRibbon(offset, color, phase, opacity) {
  const points = [];
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  for (let i = 0; i < QUALITY.ribbonSamples; i++) {
    const t = i / QUALITY.ribbonSamples;
    route.getPointAt(t, p);
    route.getTangentAt(t, tangent);
    right.crossVectors(tangent, worldUp).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    const wave = Math.sin(t * Math.PI * 8 + phase);
    const lift = Math.cos(t * Math.PI * 6 + phase) * offset * 0.45;
    points.push(p.clone().addScaledVector(right, offset + wave * 2.2).addScaledVector(worldUp, lift));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.42);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, QUALITY.ribbonSegments, 0.035, QUALITY.ribbonRadial, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(mesh);
  return mesh;
}

const ribbonDefinitions = [
  [12, 0x45c8ff, 0.0, 0.18],
  [-14, 0xb668ff, 1.8, 0.13],
  [21, 0x5affd5, 3.3, 0.08],
];
const ribbons = reducedMotion
  ? []
  : ribbonDefinitions.slice(0, QUALITY.ribbonCount).map(args => makeEnergyRibbon(...args));

function makeSectorGate(at, color, radius) {
  const group = new THREE.Group();
  const p = route.getPointAt(at);
  const gateTangent = route.getTangentAt(at).normalize();
  group.position.copy(p);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), gateTangent);

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ringSizes = [1, 0.73, 0.47].slice(0, QUALITY.gateRings);
  ringSizes.forEach((factor, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * factor, index === 0 ? 0.085 : 0.038, 6, QUALITY.gateSegments),
      material.clone()
    );
    ring.material.opacity *= 1 - index * 0.24;
    ring.userData.spin = (index % 2 ? -1 : 1) * (0.055 + index * 0.028);
    group.add(ring);
  });

  if (QUALITY.gateLights) {
    const halo = new THREE.PointLight(color, 3.2, radius * 3.6, 2);
    group.add(halo);
  }
  scene.add(group);
  return group;
}

const gates = [
  makeSectorGate(0.16, 0x55c8ff, 8.0),
  makeSectorGate(0.34, 0xb56cff, 9.8),
  makeSectorGate(0.53, 0x5ff0cf, 8.7),
  makeSectorGate(0.71, 0xff6fbd, 10.5),
  makeSectorGate(0.89, 0x8aa7ff, 9.0),
];

function addMoon(at, side, lift, radius, color) {
  const p = route.getPointAt(at);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, QUALITY.moonSegments, QUALITY.moonRows),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 })
  );
  mesh.position.set(p.x + side, p.y + lift, p.z - 32);
  scene.add(mesh);
  return mesh;
}
const moons = [
  addMoon(0.24, 34, 19, 6.4, 0x26385d),
  addMoon(0.63, -41, -9, 8.8, 0x3b254a),
  addMoon(0.86, 28, 22, 4.8, 0x203c4d),
];

const obstacleMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x273146, metalness: 0.2, roughness: 0.86, emissive: 0x07111d }),
  new THREE.MeshStandardMaterial({ color: 0x3b2748, metalness: 0.14, roughness: 0.88, emissive: 0x16051b }),
  new THREE.MeshStandardMaterial({ color: 0x1d3c43, metalness: 0.18, roughness: 0.8, emissive: 0x041819 }),
];

// The old version used one Mesh and one draw call per asteroid. These are static
// scenery, so three InstancedMesh batches preserve the field while collapsing
// dozens of draw calls down to one per material.
function makeObstacleField() {
  const matricesByMaterial = [[], [], []];
  const tangentTmp = new THREE.Vector3();
  const rightTmp = new THREE.Vector3();
  const dummy = new THREE.Object3D();

  for (let i = 0; i < QUALITY.obstacles; i++) {
    const t = 0.02 + random() * 0.96;
    const p = route.getPointAt(t);
    route.getTangentAt(t, tangentTmp);
    rightTmp.crossVectors(tangentTmp, worldUp).normalize();
    if (rightTmp.lengthSq() < 0.001) rightTmp.set(1, 0, 0);

    const side = (random() > 0.5 ? 1 : -1) * (5.5 + random() * 19);
    const radius = 0.45 + random() * 1.8;
    dummy.position.copy(p)
      .addScaledVector(rightTmp, side)
      .addScaledVector(worldUp, (random() - 0.5) * 17)
      .addScaledVector(tangentTmp, (random() - 0.5) * 20);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    dummy.scale.set(radius, radius * (0.72 + random() * 0.5), radius * (0.78 + random() * 0.45));
    dummy.updateMatrix();
    matricesByMaterial[i % matricesByMaterial.length].push(dummy.matrix.clone());
  }

  const geometry = new THREE.IcosahedronGeometry(1, QUALITY.obstacleDetail);
  const batches = [];
  for (let materialIndex = 0; materialIndex < matricesByMaterial.length; materialIndex++) {
    const matrices = matricesByMaterial[materialIndex];
    if (!matrices.length) continue;
    const batch = new THREE.InstancedMesh(geometry, obstacleMaterials[materialIndex], matrices.length);
    matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.frustumCulled = false;
    scene.add(batch);
    batches.push(batch);
  }
  return batches;
}
const obstacleBatches = makeObstacleField();

function makeWarpStreaks() {
  const count = reducedMotion ? 0 : QUALITY.warpStreaks;
  const positions = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * 34;
    const y = (random() - 0.5) * 20;
    const z = -8 - random() * 72;
    const length = 1.2 + random() * 6.5;
    const j = i * 6;
    positions[j] = x;
    positions[j + 1] = y;
    positions[j + 2] = z;
    positions[j + 3] = x;
    positions[j + 4] = y;
    positions[j + 5] = z + length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x9fdcff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}
const warpStreaks = makeWarpStreaks();
camera.add(warpStreaks);

const chapters = [
  { at: 0.00, name: 'Departure', color: 0x4bbcff },
  { at: 0.16, name: 'Engineering Foundations', color: 0x65b9ff },
  { at: 0.34, name: 'Automation', color: 0xa66dff },
  { at: 0.53, name: 'AI Systems', color: 0x5ee4ca },
  { at: 0.71, name: 'Runtime Engineering', color: 0xff6fae },
  { at: 0.89, name: 'Next Sector', color: 0x8f9cff },
];

function currentChapter(progress) {
  let chapter = chapters[0];
  for (const candidate of chapters) if (progress >= candidate.at) chapter = candidate;
  return chapter;
}

let loopCycle = 0;
let targetTravel = 0;
let travel = 0;
let lastTravel = 0;
let velocity = 0;
let warpAmount = 0;
let lastTime = performance.now();
let lastScrollY = window.scrollY;
let recyclingScroll = false;

function scrollMetrics() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return { maxScroll, local: THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1) };
}

function updateTargetFromScroll() {
  const { local } = scrollMetrics();
  targetTravel = loopCycle + local;
  if (Math.abs(window.scrollY - lastScrollY) > 12) hintEl.style.opacity = '0.42';
  lastScrollY = window.scrollY;
}
window.addEventListener('scroll', updateTargetFromScroll, { passive: true });

function recycleScroll(direction) {
  if (recyclingScroll) return;
  const { maxScroll } = scrollMetrics();
  const edge = 3;
  if (direction > 0 && window.scrollY >= maxScroll - edge) {
    recyclingScroll = true;
    loopCycle += 1;
    window.scrollTo(0, edge);
    targetTravel = loopCycle + edge / maxScroll;
    requestAnimationFrame(() => { recyclingScroll = false; });
  } else if (direction < 0 && window.scrollY <= edge) {
    recyclingScroll = true;
    loopCycle -= 1;
    window.scrollTo(0, maxScroll - edge);
    targetTravel = loopCycle + (maxScroll - edge) / maxScroll;
    requestAnimationFrame(() => { recyclingScroll = false; });
  }
}

window.addEventListener('wheel', event => {
  const direction = Math.sign(event.deltaY);
  if (!direction) return;
  const { maxScroll } = scrollMetrics();
  const atForwardEdge = direction > 0 && window.scrollY >= maxScroll - 3;
  const atBackwardEdge = direction < 0 && window.scrollY <= 3;
  if (atForwardEdge || atBackwardEdge) {
    event.preventDefault();
    recycleScroll(direction);
  }
}, { passive: false });

window.addEventListener('keydown', event => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const forward = event.key === 'PageDown' || event.key === 'ArrowDown' || event.key === 'End';
  const backward = event.key === 'PageUp' || event.key === 'ArrowUp' || event.key === 'Home';
  if (forward) recycleScroll(1);
  if (backward) recycleScroll(-1);
});

updateTargetFromScroll();

const tmpPos = new THREE.Vector3();
const tangent = new THREE.Vector3();
const curvatureProbe = new THREE.Vector3();
const right = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const targetFog = new THREE.Color();
const targetChapterColor = new THREE.Color();

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

let frameEmaMs = 16.7;
let performanceFrames = 0;
let lastResolutionChange = performance.now();
let runtimeFallback = false;

function engageRuntimeFallback() {
  if (runtimeFallback) return;
  runtimeFallback = true;
  starsNear.visible = false;
  ribbons.forEach((ribbon, index) => { ribbon.visible = index === 0; });
  nebulae.forEach((nebula, index) => { nebula.visible = index % 2 === 0; });
  for (const gate of gates) {
    let visibleRingSeen = false;
    for (const child of gate.children) {
      if (!child.isMesh) continue;
      if (!visibleRingSeen) visibleRingSeen = true;
      else child.visible = false;
    }
  }
}

function adaptPerformance(dt, now) {
  if (reducedMotion) return;
  const frameMs = Math.min(80, dt * 1000);
  frameEmaMs = frameEmaMs * 0.95 + frameMs * 0.05;
  performanceFrames += 1;

  if (performanceFrames < 90 || now - lastResolutionChange < 2500) return;
  performanceFrames = 0;

  let nextScale = renderScale;
  if (frameEmaMs > 24) nextScale = Math.max(0.58, renderScale - 0.12);
  else if (frameEmaMs < 16.0) nextScale = Math.min(1, renderScale + 0.05);

  if (Math.abs(nextScale - renderScale) > 0.01) {
    renderScale = nextScale;
    applyRenderResolution();
    lastResolutionChange = now;
  }

  // If resolution scaling alone cannot recover frame time, reduce only distant
  // decorative effects. Flight/camera/scroll logic is never degraded.
  if (frameEmaMs > 31 && renderScale <= 0.64) engageRuntimeFallback();
}

let frameIndex = 0;
let lastHudUpdate = 0;
let lastDebugUpdate = 0;

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  frameIndex += 1;
  adaptPerformance(dt, now);

  const travelLambda = reducedMotion ? 18 : 6.8;
  travel = damp(travel, targetTravel, travelLambda, dt);
  velocity = (travel - lastTravel) / dt;
  lastTravel = travel;

  const progress = wrap01(travel);
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

  starsFar.material.size = 0.29 + warpAmount * 0.13;
  starsNear.material.size = 0.43 + warpAmount * 0.42;
  warpStreaks.material.opacity = warpAmount * 0.52;
  warpStreaks.scale.z = 1 + warpAmount * 2.1;

  if (frameIndex % QUALITY.backgroundStride === 0) {
    const backgroundDt = dt * QUALITY.backgroundStride;
    starsFar.rotation.y += backgroundDt * 0.00055;
    starsNear.rotation.z += backgroundDt * 0.0014;

    for (const gate of gates) {
      for (const ring of gate.children) {
        if (ring.userData?.spin) ring.rotation.z += backgroundDt * ring.userData.spin * (1 + warpAmount * 1.5);
      }
    }
    for (let i = 0; i < nebulae.length; i++) {
      nebulae[i].material.opacity = 0.50 + Math.sin(now * 0.00012 + i * 1.7) * 0.08;
    }
    for (let i = 0; i < ribbons.length; i++) ribbons[i].rotation.y = Math.sin(now * 0.00008 + i) * 0.002;
    for (let i = 0; i < moons.length; i++) moons[i].rotation.y += backgroundDt * (0.004 + i * 0.002);
  }

  const chapter = currentChapter(progress);
  targetChapterColor.setHex(chapter.color);
  rim.color.lerp(targetChapterColor, 1 - Math.exp(-2.1 * dt));
  targetFog.copy(targetChapterColor).multiplyScalar(0.075);
  scene.fog.color.lerp(targetFog, 1 - Math.exp(-1.3 * dt));

  if (now - lastHudUpdate > 90) {
    lastHudUpdate = now;
    const traveled = Math.round(Math.abs(travel) * ROUTE_LENGTH);
    distanceEl.textContent = String(traveled).padStart(4, '0');
    velocityEl.textContent = (Math.abs(velocity) * ROUTE_LENGTH).toFixed(2);
    bankEl.textContent = `${Math.round(THREE.MathUtils.radToDeg(ship.rotation.z))}°`;
    warpEl.textContent = `${Math.round(warpAmount * 100)}%`;
    if (cycleEl) cycleEl.textContent = `${loopCycle >= 0 ? '+' : ''}${loopCycle}`;
    chapterEl.textContent = chapter.name;
  }

  if (now - lastDebugUpdate > 90) {
    lastDebugUpdate = now;
    window.__portfolioDebug = {
      ready: true,
      targetTravel,
      travel,
      loopCycle,
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
      chapter: chapter.name,
      shipAsset: 'documented-procedural-stub-v2',
      surrealEffects: ['svg-nebula-backdrop', 'procedural-nebulae', 'energy-ribbons', 'sector-gates', 'warp-streaks'],
      performance: {
        qualityTier,
        forcedQuality: allowedQuality.has(forcedQuality),
        pixelRatio: actualPixelRatio,
        renderScale,
        frameEmaMs,
        runtimeFallback,
        obstacleDrawBatches: obstacleBatches.length,
      },
    };
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  applyRenderResolution();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

loading.classList.add('done');
requestAnimationFrame(animate);
