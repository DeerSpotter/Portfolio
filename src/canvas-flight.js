import { waypoints as stops } from './portfolio-content.js';
import { showWaypoint } from './portfolio-ui.js';

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const velocityEl = document.getElementById('velocity');
const loopEl = document.getElementById('cycle');

const TAU = Math.PI * 2;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const random = mulberry32(0x51a7f00d);
const stars = [];
const paperMarks = [];
const trail = [];
const trailGhost = [];

const COLORS = {
  paper: '#e7d8b8',
  paperLight: '#f0e3c5',
  paperDeep: '#c9ad78',
  ink: '#3b2f21',
  muted: '#8a765a',
  fox: '#cf6f2f',
  rust: '#96543f',
  olive: '#66713f',
  blue: '#4c6378',
  plum: '#694f66',
  gold: '#a9792f',
};

const SCENERY_CONTRACT = 'layered-side-scenes-v1';
const LAYER_OFFSETS = [
  { delta: -0.033, depth: 0.78, sideScale: 0.90, liftDelta: -0.055, detail: 0.56, role: 'lead' },
  { delta: 0.000, depth: 1.00, sideScale: 1.00, liftDelta: 0.000, detail: 1.00, role: 'hero' },
  { delta: 0.031, depth: 1.12, sideScale: 1.07, liftDelta: 0.065, detail: 0.72, role: 'trail' },
];

const scenery = stops.flatMap((stop, stopIndex) => LAYER_OFFSETS.map((layer, layerIndex) => ({
  ...stop,
  at: wrap01(stop.at + layer.delta),
  side: clamp(stop.side * layer.sideScale, -0.86, 0.86),
  lift: clamp(stop.lift + layer.liftDelta, -0.30, 0.30),
  depth: layer.depth,
  detail: layer.detail,
  role: layer.role,
  stopIndex,
  layerIndex,
})));

let cssW = innerWidth;
let cssH = innerHeight;
let renderScale = 0.90;
let pixelRatio = 1;
let frameEmaMs = 16.7;
let frameSamples = 0;
let lastScaleChange = performance.now();
let degraded = false;

let loopCycle = 0;
let targetTravel = 0;
let travel = 0;
let lastTravel = 0;
let velocity = 0;
let lastScrollY = scrollY;
let recyclingScroll = false;
let lastTime = performance.now();
let lastMotionTime = performance.now();
let activeStop = null;
let trailMode = 'follow';

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap01(v) { return ((v % 1) + 1) % 1; }

function wrapSigned(v) {
  let n = wrap01(v);
  if (n > 0.5) n -= 1;
  return n;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function resize() {
  cssW = innerWidth;
  cssH = innerHeight;
  pixelRatio = Math.max(0.55, Math.min(1.15, (devicePixelRatio || 1) * renderScale));
  canvas.width = Math.max(1, Math.round(cssW * pixelRatio));
  canvas.height = Math.max(1, Math.round(cssH * pixelRatio));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  rebuildBackdrop();
}

function rebuildBackdrop() {
  stars.length = 0;
  paperMarks.length = 0;
  const starCount = degraded ? 70 : 140;
  const markCount = degraded ? 30 : 68;

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(),
      y: random(),
      size: 0.4 + random() * 1.4,
      layer: 0.12 + random() * 0.88,
      phase: random() * TAU,
    });
  }

  for (let i = 0; i < markCount; i++) {
    paperMarks.push({
      x: random(),
      y: random(),
      len: 5 + random() * 24,
      tilt: (random() - 0.5) * 0.5,
      alpha: 0.025 + random() * 0.045,
    });
  }
}

function scrollMetrics() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return { maxScroll, local: clamp(scrollY / maxScroll, 0, 1) };
}

function updateTargetFromScroll() {
  const { local } = scrollMetrics();
  targetTravel = loopCycle + local;
  if (Math.abs(scrollY - lastScrollY) > 2) lastMotionTime = performance.now();
  lastScrollY = scrollY;
}

function recycleScroll(direction) {
  if (recyclingScroll) return;

  const { maxScroll } = scrollMetrics();
  const edge = 3;

  if (direction > 0 && scrollY >= maxScroll - edge) {
    recyclingScroll = true;
    loopCycle += 1;
    scrollTo(0, edge);
    targetTravel = loopCycle + edge / maxScroll;
    requestAnimationFrame(() => { recyclingScroll = false; });
  } else if (direction < 0 && scrollY <= edge) {
    recyclingScroll = true;
    loopCycle -= 1;
    scrollTo(0, maxScroll - edge);
    targetTravel = loopCycle + (maxScroll - edge) / maxScroll;
    requestAnimationFrame(() => { recyclingScroll = false; });
  }
}

addEventListener('scroll', updateTargetFromScroll, { passive: true });
addEventListener('wheel', event => {
  const direction = Math.sign(event.deltaY);
  if (!direction) return;

  const { maxScroll } = scrollMetrics();
  if ((direction > 0 && scrollY >= maxScroll - 3) || (direction < 0 && scrollY <= 3)) {
    event.preventDefault();
    recycleScroll(direction);
  }
}, { passive: false });
addEventListener('resize', resize, { passive: true });
addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

function vanishingPoint(progress) {
  return {
    x: cssW * (0.50 + Math.sin(progress * TAU * 1.10) * 0.035),
    y: cssH * (0.35 + Math.cos(progress * TAU * 0.75) * 0.025),
  };
}

function shipPoint(progress) {
  return {
    x: cssW * (
      0.50
      + Math.sin(progress * TAU * 1.45) * 0.070
      + Math.sin(progress * TAU * 3.1) * 0.018
    ),
    y: cssH * (0.72 + Math.cos(progress * TAU * 1.20) * 0.030),
  };
}

// Perspective is intentionally asymmetrical. Side scenery grows outward faster
// than it grows vertically, so it feels like the ship is overtaking a layered
// environment rather than scrolling past flat cards.
function projectObject(obj, progress, depthScale = 1) {
  const rel = wrapSigned(obj.at - progress);
  if (rel < -0.078 || rel > 0.425) return null;

  const vp = vanishingPoint(progress);
  const t = clamp((0.425 - rel) / 0.503, 0, 1);
  const forwardScale = 0.055 + Math.pow(t, 1.68) * 1.72 * depthScale;
  const lateralScale = 0.10 + Math.pow(t, 1.48) * 1.72 * depthScale;
  const side = obj.side || 0;
  const lift = obj.lift || 0;
  const laneX = cssW * (0.50 + side * 0.49);
  const laneY = cssH * (0.49 + lift * 0.50);
  const passKick = rel < 0 ? Math.pow(clamp(-rel / 0.078, 0, 1), 1.16) : 0;

  const x = vp.x
    + (laneX - vp.x) * lateralScale
    + side * cssW * 0.42 * passKick;
  const y = vp.y
    + (laneY - vp.y) * forwardScale
    + cssH * 0.21 * passKick;

  const scaleY = 0.08 + Math.pow(t, 1.58) * 1.64 * depthScale;
  const scaleX = scaleY * (0.82 + t * 0.58 + passKick * 0.34);
  const alpha = clamp(t * 3.0, 0.08, 1)
    * clamp((0.46 - rel) * 6.5, 0.18, 1);
  const rotation = -side * (0.035 + t * 0.075);

  return { x, y, scaleX, scaleY, alpha, rel, t, passKick, rotation };
}

function clearBackground(progress) {
  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  g.addColorStop(0, COLORS.paperLight);
  g.addColorStop(0.58, COLORS.paper);
  g.addColorStop(1, '#d3bb8c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const vp = vanishingPoint(progress);
  const wash = ctx.createRadialGradient(
    vp.x,
    vp.y,
    0,
    vp.x,
    vp.y,
    Math.max(cssW, cssH) * 0.62,
  );
  wash.addColorStop(0, 'rgba(255,248,225,.76)');
  wash.addColorStop(0.44, 'rgba(207,111,47,.052)');
  wash.addColorStop(1, 'rgba(120,88,45,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  for (const mark of paperMarks) {
    ctx.globalAlpha = mark.alpha;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const x = mark.x * cssW;
    const y = mark.y * cssH;
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(mark.tilt) * mark.len,
      y + Math.sin(mark.tilt) * mark.len,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerspectiveGuide(progress) {
  const vp = vanishingPoint(progress);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(86,68,44,.075)';

  for (const edge of [-0.47, -0.25, 0.25, 0.47]) {
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(cssW * (0.5 + edge), cssH * 1.03);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.055;
  for (let i = 1; i <= 5; i++) {
    const y = vp.y + (cssH - vp.y) * Math.pow(i / 5, 1.72);
    ctx.beginPath();
    ctx.ellipse(vp.x, y, cssW * 0.10 * i, cssH * 0.018 * i, 0, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(progress, now) {
  const vp = vanishingPoint(progress);
  const warp = clamp(Math.abs(velocity) * 4.5, 0, 1);

  ctx.save();
  for (const star of stars) {
    const phase = wrap01(star.x + progress * star.layer * 0.92);
    const depth = 0.10 + phase * 0.90;
    const spread = Math.pow(depth, 1.7);
    const sx = vp.x + (star.x - 0.5) * cssW * 1.10 * spread;
    const sy = vp.y + (star.y - 0.28) * cssH * 0.95 * spread;
    const alpha = 0.10 + star.layer * 0.22
      + Math.sin(now * 0.001 + star.phase) * 0.04;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = star.size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);

    if (warp > 0.10) {
      const dx = sx - vp.x;
      const dy = sy - vp.y;
      ctx.lineTo(sx + dx * 0.055 * warp, sy + dy * 0.055 * warp);
    } else {
      ctx.lineTo(sx + 0.1, sy + 0.1);
    }

    ctx.stroke();
  }
  ctx.restore();
}

function sceneTransform(screen, draw) {
  ctx.save();
  ctx.globalAlpha = screen.alpha;
  ctx.translate(screen.x, screen.y);
  ctx.rotate(screen.rotation);
  ctx.scale(screen.scaleX, screen.scaleY);
  draw();
  ctx.restore();
}

function line(x1, y1, x2, y2, width = 1, color = COLORS.ink) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function outlineRect(x, y, w, h, radius = 5, color = COLORS.ink, width = 1.6) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

function fillRectSoft(x, y, w, h, fill, alpha = 1, radius = 5) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.globalAlpha = previous;
}

function dot(x, y, r, fill = COLORS.ink) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function smallLabel(text, x, y, color = COLORS.ink, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawEntryVista(stop, detail) {
  const c = stop.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  fillRectSoft(-74, -50, 148, 100, COLORS.paperLight, 0.58, 10);
  outlineRect(-74, -50, 148, 100, 10, c, 1.7);

  ctx.strokeStyle = c;
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 3; i++) {
    const x = -42 + i * 42;
    ctx.beginPath();
    ctx.moveTo(x - 12, 30);
    ctx.lineTo(x, -28);
    ctx.lineTo(x + 12, 30);
    ctx.stroke();
    dot(x, -28, 3.8, c);
  }

  ctx.globalAlpha *= 0.62;
  line(-56, 9, 56, 9, 1.1, COLORS.ink);
  line(-45, 20, 45, 20, 1.1, COLORS.ink);
  ctx.globalAlpha /= 0.62;

  if (detail > 0.7) {
    ctx.strokeStyle = COLORS.fox;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-54, -10);
    ctx.bezierCurveTo(-24, -24, 22, -18, 52, -2);
    ctx.stroke();
    smallLabel('BUILD → PROVE → EXPLAIN', 0, 40, COLORS.ink, 'center');
  }
}

function drawEngineeringAssembly(stop, detail) {
  const c = stop.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  fillRectSoft(-78, -55, 156, 110, COLORS.paperLight, 0.50, 7);
  outlineRect(-78, -55, 156, 110, 7, COLORS.ink, 1.5);
  line(-58, 43, -58, -42, 3.0, c);
  line(58, 43, 58, -42, 3.0, c);
  line(-58, -42, 58, -42, 3.0, c);
  line(-58, 30, 58, 30, 1.1, COLORS.ink);

  fillRectSoft(-38, -20, 56, 34, COLORS.paperDeep, 0.52, 3);
  outlineRect(-38, -20, 56, 34, 3, COLORS.ink, 1.4);
  for (const [x, y] of [[-28, -11], [8, -11], [-28, 5], [8, 5]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.stroke();
  }

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(41, -5, 13, 18, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(41, -5, 5, 18, 0, 0, TAU);
  ctx.stroke();

  if (detail > 0.62) {
    ctx.save();
    ctx.translate(-55, 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      const r = i % 2 ? 12 : 16;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.stroke();
    ctx.restore();

    line(-42, -31, 20, -31, 1.0, COLORS.rust);
    line(-42, -35, -42, -27, 1.0, COLORS.rust);
    line(20, -35, 20, -27, 1.0, COLORS.rust);
    smallLabel('NX / TC', 70, 43, c, 'right');
  }
}

function drawAutomationStack(stop, detail) {
  const c = stop.color;
  ctx.lineJoin = 'round';

  for (let i = 3; i >= 0; i--) {
    const ox = -58 + i * 7;
    const oy = -43 + i * 7;
    fillRectSoft(ox, oy, 92, 72, i === 0 ? COLORS.paperLight : COLORS.paperDeep, i === 0 ? 0.86 : 0.40, 4);
    outlineRect(ox, oy, 92, 72, 4, COLORS.ink, 1.2);
    line(ox + 69, oy, ox + 92, oy + 23, 1.0, c);
  }

  line(55, -36, 55, 38, 2.0, c);
  const nodes = [
    { y: -30, label: 'FIND' },
    { y: -8, label: 'REV' },
    { y: 14, label: 'CM' },
    { y: 36, label: 'METRIC' },
  ];
  for (const node of nodes) {
    dot(55, node.y, 4, c);
    if (detail > 0.58) smallLabel(node.label, 66, node.y, COLORS.ink);
  }

  ctx.globalAlpha *= 0.68;
  line(-43, -24, 20, -24, 1.0, COLORS.ink);
  line(-43, -10, 12, -10, 1.0, COLORS.ink);
  line(-43, 4, 28, 4, 1.0, COLORS.ink);
  line(-43, 18, 2, 18, 1.0, COLORS.ink);
  ctx.globalAlpha /= 0.68;

  if (detail > 0.7) {
    fillRectSoft(-42, 31, 25, 12, c, 0.78, 2);
    smallLabel('PDF', -29.5, 37, COLORS.paperLight, 'center');
  }
}

function drawContextPort(stop, detail) {
  const c = stop.color;

  fillRectSoft(-82, -42, 56, 84, COLORS.paperLight, 0.62, 12);
  fillRectSoft(26, -42, 56, 84, COLORS.paperLight, 0.62, 12);
  outlineRect(-82, -42, 56, 84, 12, COLORS.ink, 1.5);
  outlineRect(26, -42, 56, 84, 12, COLORS.ink, 1.5);

  ctx.strokeStyle = c;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -10);
  ctx.bezierCurveTo(-14, -10, -12, 0, -9, 0);
  ctx.bezierCurveTo(4, 0, 10, 10, 26, 10);
  ctx.stroke();

  for (const x of [-58, 58]) {
    for (let row = 0; row < 3; row++) {
      fillRectSoft(x - 16, -23 + row * 20, 32, 10, row === 1 ? c : COLORS.paperDeep, row === 1 ? 0.72 : 0.48, 3);
    }
  }

  if (detail > 0.64) {
    smallLabel('A', -54, -32, c, 'center');
    smallLabel('B', 54, -32, c, 'center');
    smallLabel('MEMORY', 0, 31, COLORS.ink, 'center');
    for (const p of [[-15, 0], [15, 7], [-4, -10]]) dot(p[0], p[1], 2.2, COLORS.fox);
  }
}

function drawRuntimeBridge(stop, detail) {
  const c = stop.color;

  for (let i = 0; i < 4; i++) {
    const y = 26 - i * 14;
    fillRectSoft(-80, y, 92, 10, i === 0 ? c : COLORS.paperDeep, i === 0 ? 0.68 : 0.48, 2);
    outlineRect(-80, y, 92, 10, 2, COLORS.ink, 1.0);
  }

  ctx.strokeStyle = c;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.bezierCurveTo(24, -34, 56, -34, 76, 15);
  ctx.stroke();

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(18, 14);
  ctx.bezierCurveTo(34, -20, 54, -18, 66, 9);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    fillRectSoft(37 + i * 13, 19, 9, 22, i === 1 ? COLORS.fox : COLORS.paperLight, i === 1 ? 0.72 : 0.82, 2);
    outlineRect(37 + i * 13, 19, 9, 22, 2, COLORS.ink, 1.0);
  }

  if (detail > 0.62) {
    smallLabel('IMAGE', -79, -39, c);
    smallLabel('READ', 28, -27, c);
    smallLabel('ABI', 51, 47, COLORS.ink, 'center');
    for (let i = 0; i < 5; i++) {
      line(-70 + i * 15, -28, -70 + i * 15, -20, 1.0, COLORS.ink);
    }
  }
}

function drawClarityMap(stop, detail) {
  const c = stop.color;

  fillRectSoft(-79, -50, 158, 100, COLORS.paperLight, 0.54, 7);
  outlineRect(-79, -50, 158, 100, 7, COLORS.ink, 1.3);

  ctx.globalAlpha *= 0.28;
  for (let x = -60; x <= 60; x += 20) line(x, -38, x, 38, 0.8, COLORS.ink);
  for (let y = -30; y <= 30; y += 15) line(-66, y, 66, y, 0.8, COLORS.ink);
  ctx.globalAlpha /= 0.28;

  ctx.strokeStyle = c;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(-20, 13, 26, 3.6, 6.0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14, 2, 31, 2.9, 5.3);
  ctx.stroke();

  const sources = [[-52, -24], [-43, 27], [44, -27], [55, 21]];
  for (const [x, y] of sources) {
    dot(x, y, 4, c);
    line(x, y, 8, 4, 1.1, COLORS.ink);
  }

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(8, 4, 13, 0, TAU);
  ctx.stroke();
  dot(8, 4, 3.2, COLORS.fox);

  if (detail > 0.65) {
    smallLabel('SOURCE', -67, 42, c);
    smallLabel('DECISION', 68, 42, COLORS.ink, 'right');
    line(-8, -15, 27, -15, 1.0, COLORS.rust);
    line(27, -15, 35, -7, 1.0, COLORS.rust);
  }
}

function drawUnknownScene(stop) {
  fillRectSoft(-60, -40, 120, 80, COLORS.paperLight, 0.55, 6);
  outlineRect(-60, -40, 120, 80, 6, stop.color, 1.5);
  line(-44, -12, 44, -12, 1.2, COLORS.ink);
  line(-44, 6, 20, 6, 1.2, COLORS.ink);
}

function drawSceneArtwork(stop, screen) {
  sceneTransform(screen, () => {
    const detail = stop.detail || 1;

    switch (stop.visual) {
      case 'entry-vista':
        drawEntryVista(stop, detail);
        break;
      case 'engineering-assembly':
        drawEngineeringAssembly(stop, detail);
        break;
      case 'automation-stack':
        drawAutomationStack(stop, detail);
        break;
      case 'context-port':
        drawContextPort(stop, detail);
        break;
      case 'runtime-bridge':
        drawRuntimeBridge(stop, detail);
        break;
      case 'clarity-map':
        drawClarityMap(stop, detail);
        break;
      default:
        drawUnknownScene(stop);
        break;
    }

    if (stop.role !== 'hero') {
      ctx.globalAlpha *= 0.42;
      ctx.strokeStyle = stop.color;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-86, stop.role === 'lead' ? -58 : 58);
      ctx.lineTo(86, stop.role === 'lead' ? -58 : 58);
      ctx.stroke();
    }
  });
}

function drawSceneFocus(stop, screen, now) {
  if (!screen) return;

  const pulse = reducedMotion ? 0 : Math.sin(now * 0.004) * 4;
  const w = 116 * screen.scaleX + pulse;
  const h = 82 * screen.scaleY + pulse * 0.5;

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = 2;

  const corner = 14;
  const left = screen.x - w;
  const right = screen.x + w;
  const top = screen.y - h;
  const bottom = screen.y + h;

  for (const [x, y, sx, sy] of [
    [left, top, 1, 1],
    [right, top, -1, 1],
    [left, bottom, 1, -1],
    [right, bottom, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * corner, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSceneCorridors(progress) {
  const vp = vanishingPoint(progress);

  ctx.save();
  ctx.lineCap = 'round';

  for (const stop of stops) {
    const rel = wrapSigned(stop.at - progress);
    if (rel < -0.03 || rel > 0.34) continue;

    const screen = projectObject(stop, progress, 0.88);
    if (!screen) continue;

    ctx.globalAlpha = 0.09 + screen.t * 0.08;
    ctx.strokeStyle = stop.color;
    ctx.lineWidth = 1 + screen.t * 1.4;
    ctx.setLineDash([6 + screen.t * 8, 9 + screen.t * 7]);
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(screen.x, screen.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawWorldObjects(progress, now) {
  const projected = [];

  for (const object of scenery) {
    const screen = projectObject(object, progress, object.depth || 1);
    if (screen) projected.push({ object, screen });
  }

  projected.sort((a, b) => {
    const sa = a.screen.scaleY * a.screen.scaleX;
    const sb = b.screen.scaleY * b.screen.scaleX;
    return sa - sb;
  });

  for (const item of projected) {
    drawSceneArtwork(item.object, item.screen);
  }

  if (activeStop) {
    const focus = projectObject(activeStop, progress, 1.0);
    drawSceneFocus(activeStop, focus, now);
  }
}

function nearestStop(progress) {
  let best = null;
  let bestDist = Infinity;

  for (const stop of stops) {
    const d = Math.abs(wrapSigned(stop.at - progress));
    if (d < bestDist) {
      best = stop;
      bestDist = d;
    }
  }

  return bestDist < 0.055 ? best : null;
}

function drawTrail(points, color, width, alpha) {
  if (points.length < 3) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) * 0.5;
    const my = (points[i].y + points[i + 1].y) * 0.5;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }

  ctx.stroke();
  ctx.restore();
}

function drawOrbitCurl(stop, progress, now) {
  if (!stop) return;

  const target = projectObject(stop, progress, 1.0);
  if (!target) return;

  const ship = shipPoint(progress);
  const phase = now * 0.00115;

  ctx.save();
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.76;
  ctx.beginPath();
  ctx.moveTo(ship.x - 4, ship.y + 18);
  ctx.bezierCurveTo(
    ship.x - 44,
    ship.y + 56,
    target.x - 54 * Math.sign(stop.side || 1),
    target.y + 28,
    target.x - 28 * Math.sign(stop.side || 1),
    target.y,
  );

  for (let i = 0; i <= 40; i++) {
    const a = phase + i / 40 * TAU * 1.45;
    const rr = 30 - i * 0.42;
    ctx.lineTo(
      target.x + Math.cos(a) * rr,
      target.y + Math.sin(a) * rr * 0.50,
    );
  }
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const a = -phase * 0.72 + i / 34 * TAU * 1.25;
    const rr = 39 - i * 0.54;
    const x = target.x + Math.cos(a) * rr;
    const y = target.y + Math.sin(a) * rr * 0.46;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.restore();
}

function adaptPerformance(dt, now) {
  frameEmaMs = frameEmaMs * 0.96 + Math.min(70, dt * 1000) * 0.04;
  frameSamples++;

  if (frameSamples < 90 || now - lastScaleChange < 2600) return;
  frameSamples = 0;

  let next = renderScale;
  if (frameEmaMs > 23.5) next = Math.max(0.58, renderScale - 0.10);
  else if (frameEmaMs < 15.6) next = Math.min(0.96, renderScale + 0.04);

  if (Math.abs(next - renderScale) > 0.01) {
    renderScale = next;
    lastScaleChange = now;
    resize();
  }

  if (frameEmaMs > 30 && renderScale <= 0.64 && !degraded) {
    degraded = true;
    rebuildBackdrop();
  }
}

function updatePanel(progress) {
  const current = activeStop || stops.reduce((best, stop) => {
    const d = Math.abs(wrapSigned(stop.at - progress));
    return !best || d < best.d ? { stop, d } : best;
  }, null).stop;

  showWaypoint(current);
}

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  adaptPerformance(dt, now);

  travel = damp(travel, targetTravel, reducedMotion ? 18 : 7.2, dt);
  velocity = (travel - lastTravel) / dt;
  lastTravel = travel;
  const progress = wrap01(travel);

  if (Math.abs(velocity) > 0.0025) lastMotionTime = now;
  const settled = now - lastMotionTime > 520 && Math.abs(velocity) < 0.0045;
  activeStop = settled ? nearestStop(progress) : null;
  trailMode = activeStop ? 'orbit' : 'follow';

  const ship = shipPoint(progress);
  trail.push({ x: ship.x, y: ship.y + 20 });
  trailGhost.push({
    x: ship.x + Math.sin(now * 0.0035) * 3.0,
    y: ship.y + 27,
  });
  if (trail.length > 52) trail.shift();
  if (trailGhost.length > 46) trailGhost.shift();

  clearBackground(progress);
  drawPerspectiveGuide(progress);
  drawStars(progress, now);
  drawSceneCorridors(progress);
  drawWorldObjects(progress, now);
  drawTrail(trailGhost, COLORS.olive, 1.0, 0.20);
  drawTrail(trail, COLORS.fox, 2.3, 0.64);

  if (activeStop) drawOrbitCurl(activeStop, progress, now);

  if (now % 100 < 17) {
    velocityEl.textContent = (Math.abs(velocity) * 100).toFixed(1);
    loopEl.textContent = `${loopCycle >= 0 ? '+' : ''}${loopCycle}`;
    updatePanel(progress);
  }

  window.__portfolioCanvasDebug = {
    ready: true,
    travel,
    targetTravel,
    loopCycle,
    progress,
    velocity,
    settled,
    trailMode,
    activeStop: activeStop?.title || null,
    renderScale,
    pixelRatio,
    frameEmaMs,
    degraded,
    engine: 'canvas-2d',
    movement: 'forward-chase-perspective',
    palette: 'fox-paper-earth',
    shipRenderer: 'original-live3d-third-person-chase',
    scenery: SCENERY_CONTRACT,
    sceneryArtworkCount: scenery.length,
    sceneryHeroCount: stops.length,
    lateralPerspective: 'accelerated-side-growth',
  };

  requestAnimationFrame(animate);
}

resize();
updateTargetFromScroll();
requestAnimationFrame(animate);
