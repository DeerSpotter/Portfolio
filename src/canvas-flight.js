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

const COLORS = {
  paper: '#e7d8b8',
  paperLight: '#f0e3c5',
  paperDeep: '#c9ad78',
  paperShade: '#b99c68',
  ink: '#3b2f21',
  muted: '#8a765a',
  fox: '#cf6f2f',
  rust: '#96543f',
  olive: '#66713f',
  blue: '#4c6378',
  plum: '#694f66',
  gold: '#a9792f',
};

// Art direction: each stop is a single readable environmental composition.
// Lead/trail layers are supporting silhouettes, never duplicate copies of the
// hero scene. The ship passes between the hero station and the text billboard.
const SCENERY_CONTRACT = 'art-directed-flight-stations-v2';
const RIBBON_CONTRACT = 'perspective-navigation-wake-v2';
const WAKE_MAX_RADIUS = 0.072;
const LAYER_OFFSETS = [
  { delta: -0.048, depth: 0.70, sideScale: 0.86, liftDelta: -0.035, detail: 0.34, role: 'lead' },
  { delta: 0.000, depth: 1.00, sideScale: 1.00, liftDelta: 0.000, detail: 1.00, role: 'hero' },
  { delta: 0.044, depth: 1.16, sideScale: 1.06, liftDelta: 0.055, detail: 0.38, role: 'trail' },
];

const scenery = stops.flatMap((stop, stopIndex) => LAYER_OFFSETS.map((layer, layerIndex) => ({
  ...stop,
  at: wrap01(stop.at + layer.delta),
  side: clamp(stop.side * layer.sideScale, -0.84, 0.84),
  lift: clamp(stop.lift + layer.liftDelta, -0.28, 0.28),
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
  const starCount = degraded ? 56 : 110;
  const markCount = degraded ? 24 : 48;

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(),
      y: random(),
      size: 0.4 + random() * 1.3,
      layer: 0.12 + random() * 0.88,
      phase: random() * TAU,
    });
  }

  for (let i = 0; i < markCount; i++) {
    paperMarks.push({
      x: random(),
      y: random(),
      len: 4 + random() * 19,
      tilt: (random() - 0.5) * 0.5,
      alpha: 0.018 + random() * 0.032,
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

// Screen-space perspective is still deliberately wider than it is tall, but
// the near scale is capped so a station can feel monumental without becoming
// an accidental cropped wall of linework.
function projectObject(obj, progress, depthScale = 1) {
  const rel = wrapSigned(obj.at - progress);
  if (rel < -0.078 || rel > 0.39) return null;

  const vp = vanishingPoint(progress);
  const t = clamp((0.39 - rel) / 0.468, 0, 1);
  const forwardScale = 0.050 + Math.pow(t, 1.68) * 1.42 * depthScale;
  const lateralScale = 0.075 + Math.pow(t, 1.48) * 1.46 * depthScale;
  const side = obj.side || 0;
  const lift = obj.lift || 0;
  const laneX = cssW * (0.50 + side * 0.45);
  const laneY = cssH * (0.48 + lift * 0.45);
  const passKick = rel < 0 ? Math.pow(clamp(-rel / 0.078, 0, 1), 1.18) : 0;

  const x = vp.x
    + (laneX - vp.x) * lateralScale
    + side * cssW * 0.34 * passKick;
  const y = vp.y
    + (laneY - vp.y) * forwardScale
    + cssH * 0.18 * passKick;

  const scaleY = 0.060 + Math.pow(t, 1.54) * 1.36 * depthScale;
  const scaleX = scaleY * (0.90 + t * 0.34 + passKick * 0.18);
  const alpha = clamp(t * 2.8, 0.06, 1)
    * clamp((0.42 - rel) * 6.0, 0.14, 1);
  const rotation = -side * (0.025 + t * 0.055);

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
  const wash = ctx.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, Math.max(cssW, cssH) * 0.62);
  wash.addColorStop(0, 'rgba(255,248,225,.78)');
  wash.addColorStop(0.40, 'rgba(207,111,47,.045)');
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
    ctx.lineTo(x + Math.cos(mark.tilt) * mark.len, y + Math.sin(mark.tilt) * mark.len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerspectiveGuide(progress) {
  const vp = vanishingPoint(progress);
  ctx.save();
  ctx.strokeStyle = 'rgba(86,68,44,.060)';
  ctx.lineWidth = 1;

  for (const edge of [-0.42, -0.20, 0.20, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(cssW * (0.5 + edge), cssH * 1.02);
    ctx.stroke();
  }

  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const y = vp.y + (cssH - vp.y) * Math.pow(t, 1.68);
    const half = cssW * 0.42 * Math.pow(t, 1.45);
    ctx.globalAlpha = 0.30 + t * 0.32;
    ctx.beginPath();
    ctx.moveTo(vp.x - half, y);
    ctx.lineTo(vp.x + half, y);
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
    const alpha = 0.07 + star.layer * 0.18 + Math.sin(now * 0.001 + star.phase) * 0.025;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = star.size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    if (warp > 0.10) {
      const dx = sx - vp.x;
      const dy = sy - vp.y;
      ctx.lineTo(sx + dx * 0.048 * warp, sy + dy * 0.048 * warp);
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

function fillRectSoft(x, y, w, h, fill, alpha = 1, radius = 5) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.globalAlpha = previous;
}

function outlineRect(x, y, w, h, radius = 5, color = COLORS.ink, width = 1.4) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

function polygon(points, fill, stroke = COLORS.ink, width = 1.2, alpha = 1) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.globalAlpha = previous;
}

function disc(x, y, r, fill, stroke = null, width = 1, alpha = 1) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.globalAlpha = previous;
}

function ellipse(x, y, rx, ry, fill, stroke = null, width = 1, alpha = 1, rotation = 0) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.globalAlpha = previous;
}

function smallLabel(text, x, y, color = COLORS.ink, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function stationShadow(screen, stop) {
  if (stop.role !== 'hero') return;
  ctx.save();
  ctx.globalAlpha = screen.alpha * 0.13;
  ctx.fillStyle = stop.color;
  ctx.beginPath();
  ctx.ellipse(
    screen.x + Math.sign(stop.side || 1) * 12 * screen.scaleX,
    screen.y + 66 * screen.scaleY,
    92 * screen.scaleX,
    Math.max(7, 13 * screen.scaleY),
    screen.rotation,
    0,
    TAU,
  );
  ctx.fill();
  ctx.restore();
}

function drawEntryVista(stop) {
  const c = stop.color;
  polygon([[-82, 45], [-68, -26], [-49, -42], [-39, 45]], COLORS.paperDeep, COLORS.ink, 1.6);
  polygon([[39, 45], [49, -42], [68, -26], [82, 45]], COLORS.paperDeep, COLORS.ink, 1.6);
  fillRectSoft(-96, 42, 192, 13, COLORS.paperShade, 0.70, 4);
  outlineRect(-96, 42, 192, 13, 4, COLORS.ink, 1.2);

  ctx.strokeStyle = c;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 3, 60, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha *= 0.48;
  ctx.beginPath();
  ctx.arc(0, 3, 48, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.globalAlpha /= 0.48;

  for (const x of [-42, 0, 42]) {
    disc(x, 28, 5, c, COLORS.ink, 1.0);
    line(x, 23, x * 0.18, -4, 1.1, COLORS.ink);
  }
  smallLabel('BUILD', -58, 58, c, 'center');
  smallLabel('PROVE', 0, 58, COLORS.ink, 'center');
  smallLabel('EXPLAIN', 58, 58, c, 'center');
}

function drawEngineeringAssembly(stop) {
  const c = stop.color;
  fillRectSoft(-96, -53, 192, 12, COLORS.paperShade, 0.80, 3);
  fillRectSoft(-88, 38, 176, 10, COLORS.paperShade, 0.65, 3);
  fillRectSoft(-87, -42, 10, 82, c, 0.78, 3);
  fillRectSoft(77, -42, 10, 82, c, 0.78, 3);

  ellipse(-53, -1, 24, 30, COLORS.paperDeep, COLORS.ink, 1.5);
  ellipse(-53, -1, 10, 15, COLORS.paperLight, c, 2.0);
  fillRectSoft(-28, -22, 42, 44, COLORS.paperLight, 0.96, 5);
  outlineRect(-28, -22, 42, 44, 5, COLORS.ink, 1.6);
  for (const [x, y] of [[-20, -13], [6, -13], [-20, 13], [6, 13]]) disc(x, y, 2.6, c);

  fillRectSoft(24, -10, 35, 20, c, 0.76, 3);
  outlineRect(24, -10, 35, 20, 3, COLORS.ink, 1.2);
  ellipse(70, -1, 19, 29, COLORS.paperLight, COLORS.ink, 1.4);
  ellipse(70, -1, 9, 20, null, c, 2.2);

  line(-29, -33, 60, -33, 1.1, COLORS.rust);
  line(-29, -38, -29, -28, 1.1, COLORS.rust);
  line(60, -38, 60, -28, 1.1, COLORS.rust);
  smallLabel('EXPLODED FIT', 16, -42, COLORS.rust, 'center');
  smallLabel('NX / TC', 91, 55, c, 'right');
}

function drawAutomationStack(stop) {
  const c = stop.color;
  fillRectSoft(-92, 35, 184, 12, COLORS.paperShade, 0.72, 4);
  for (const x of [-66, -20, 26, 72]) disc(x, 41, 5, COLORS.ink, null, 1, 0.52);

  fillRectSoft(35, -48, 12, 82, c, 0.74, 4);
  fillRectSoft(80, -48, 12, 82, c, 0.74, 4);
  fillRectSoft(35, -48, 57, 10, COLORS.paperShade, 0.92, 4);
  outlineRect(35, -48, 57, 82, 4, COLORS.ink, 1.2);

  const sheets = [
    { x: -76, y: 8, r: -0.12, a: 0.72 },
    { x: -34, y: -4, r: -0.05, a: 0.90 },
    { x: 4, y: 4, r: 0.04, a: 1.00 },
  ];
  for (const sheet of sheets) {
    ctx.save();
    ctx.translate(sheet.x, sheet.y);
    ctx.rotate(sheet.r);
    fillRectSoft(-22, -28, 44, 56, COLORS.paperLight, sheet.a, 3);
    outlineRect(-22, -28, 44, 56, 3, COLORS.ink, 1.2);
    line(-14, -12, 14, -12, 1.0, c);
    line(-14, -2, 10, -2, 0.8, COLORS.ink);
    line(-14, 8, 14, 8, 0.8, COLORS.ink);
    ctx.restore();
  }

  ctx.strokeStyle = COLORS.fox;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(39, -12);
  ctx.lineTo(88, -12);
  ctx.stroke();
  disc(63.5, -12, 4, COLORS.paperLight, COLORS.fox, 2);
  smallLabel('SCAN', 64, -58, c, 'center');
  smallLabel('REV → CM → PDF', -26, 56, COLORS.ink, 'center');
}

function drawContextPort(stop) {
  const c = stop.color;
  polygon([[-96, 44], [-91, -38], [-68, -53], [-52, -38], [-48, 44]], COLORS.paperDeep, COLORS.ink, 1.5);
  polygon([[48, 44], [52, -38], [68, -53], [91, -38], [96, 44]], COLORS.paperDeep, COLORS.ink, 1.5);
  fillRectSoft(-103, 42, 206, 12, COLORS.paperShade, 0.66, 4);

  ctx.strokeStyle = c;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(-67, -1, 24, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(67, -1, 24, 0, TAU);
  ctx.stroke();

  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-43, -1);
  ctx.bezierCurveTo(-22, -18, 22, 18, 43, -1);
  ctx.stroke();
  ctx.globalAlpha *= 0.38;
  ctx.beginPath();
  ctx.moveTo(-43, 9);
  ctx.bezierCurveTo(-22, -8, 22, 28, 43, 9);
  ctx.stroke();
  ctx.globalAlpha /= 0.38;

  for (const p of [[-22, -10], [0, 4], [25, 10]]) disc(p[0], p[1], 4, COLORS.fox, COLORS.ink, 0.7);
  smallLabel('MEMORY', 0, -39, c, 'center');
  smallLabel('A', -67, 34, COLORS.ink, 'center');
  smallLabel('B', 67, 34, COLORS.ink, 'center');
}

function drawRuntimeBridge(stop) {
  const c = stop.color;
  for (let i = 0; i < 4; i++) {
    fillRectSoft(-98, 27 - i * 16, 72, 11, i === 0 ? c : COLORS.paperDeep, i === 0 ? 0.78 : 0.52, 3);
    outlineRect(-98, 27 - i * 16, 72, 11, 3, COLORS.ink, 1.0);
  }

  fillRectSoft(38, -36, 56, 72, COLORS.paperDeep, 0.64, 5);
  outlineRect(38, -36, 56, 72, 5, COLORS.ink, 1.3);
  for (let i = 0; i < 3; i++) {
    fillRectSoft(49, -24 + i * 22, 34, 12, i === 1 ? COLORS.fox : COLORS.paperLight, i === 1 ? 0.76 : 0.88, 2);
    outlineRect(49, -24 + i * 22, 34, 12, 2, COLORS.ink, 0.9);
  }

  ctx.strokeStyle = c;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-24, 22);
  ctx.bezierCurveTo(-8, -31, 20, -31, 40, 5);
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.bezierCurveTo(-4, -20, 19, -20, 35, 8);
  ctx.stroke();

  smallLabel('IMAGE', -98, -43, c);
  smallLabel('DIRECT READ', 4, -35, c, 'center');
  smallLabel('ABI', 66, 47, COLORS.ink, 'center');
}

function drawClarityMap(stop) {
  const c = stop.color;
  ellipse(0, 2, 65, 42, COLORS.paperLight, COLORS.ink, 1.4, 0.72, -0.08);
  ellipse(0, 2, 52, 33, null, c, 2.0, 0.86, -0.08);
  ellipse(0, 2, 30, 19, null, COLORS.ink, 1.0, 0.48, -0.08);

  const sources = [[-77, -29], [-84, 27], [77, -26], [82, 31]];
  for (const [x, y] of sources) {
    disc(x, y, 5, c, COLORS.ink, 1.0);
    line(x, y, 10, 3, 1.2, COLORS.ink);
  }

  disc(10, 3, 8, COLORS.fox, COLORS.ink, 1.0);
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.arc(10, 3, 32, Math.PI * 1.10, Math.PI * 1.78);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(10, 3, 47, Math.PI * 1.10, Math.PI * 1.78);
  ctx.stroke();
  smallLabel('SOURCE', -84, 51, c);
  smallLabel('DECISION', 84, 51, COLORS.ink, 'right');
}

function drawUnknownScene(stop) {
  fillRectSoft(-60, -28, 120, 56, COLORS.paperDeep, 0.60, 8);
  outlineRect(-60, -28, 120, 56, 8, stop.color, 1.5);
}

function drawStationCompanion(stop) {
  const c = stop.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (stop.visual) {
    case 'entry-vista':
      polygon([[-14, 36], [-8, -28], [0, -40], [8, -28], [14, 36]], COLORS.paperDeep, COLORS.ink, 1.2, 0.74);
      disc(0, -40, 5, c, COLORS.ink, 0.8);
      break;
    case 'engineering-assembly':
      ellipse(0, 0, 34, 34, COLORS.paperDeep, COLORS.ink, 1.4, 0.72);
      ellipse(0, 0, 17, 17, COLORS.paperLight, c, 2.0, 0.92);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        line(Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * 43, Math.sin(a) * 43, 3, c);
      }
      break;
    case 'automation-stack':
      fillRectSoft(-32, -40, 64, 80, COLORS.paperLight, 0.72, 5);
      outlineRect(-32, -40, 64, 80, 5, COLORS.ink, 1.1);
      line(-20, -18, 18, -18, 2.0, c);
      line(-20, -2, 10, -2, 1.0, COLORS.ink);
      line(-20, 14, 18, 14, 1.0, COLORS.ink);
      break;
    case 'context-port':
      ellipse(0, 0, 34, 34, null, c, 6.0, 0.76);
      ellipse(0, 0, 22, 22, null, COLORS.ink, 1.1, 0.56);
      break;
    case 'runtime-bridge':
      fillRectSoft(-42, 18, 84, 11, c, 0.66, 3);
      for (let i = 0; i < 3; i++) fillRectSoft(-38, 2 - i * 15, 76, 9, COLORS.paperDeep, 0.46, 2);
      break;
    case 'clarity-map':
      ellipse(0, 0, 42, 25, null, c, 2.4, 0.64, -0.10);
      disc(0, 0, 5, COLORS.fox, COLORS.ink, 0.8);
      line(-51, 18, 0, 0, 1.0, COLORS.ink);
      break;
    default:
      drawUnknownScene(stop);
      break;
  }
}

function drawSceneArtwork(stop, screen) {
  stationShadow(screen, stop);
  sceneTransform(screen, () => {
    if (stop.role !== 'hero') {
      ctx.globalAlpha *= stop.role === 'lead' ? 0.54 : 0.42;
      drawStationCompanion(stop);
      return;
    }

    switch (stop.visual) {
      case 'entry-vista':
        drawEntryVista(stop);
        break;
      case 'engineering-assembly':
        drawEngineeringAssembly(stop);
        break;
      case 'automation-stack':
        drawAutomationStack(stop);
        break;
      case 'context-port':
        drawContextPort(stop);
        break;
      case 'runtime-bridge':
        drawRuntimeBridge(stop);
        break;
      case 'clarity-map':
        drawClarityMap(stop);
        break;
      default:
        drawUnknownScene(stop);
        break;
    }
  });
}

function drawSceneFocus(stop, screen, now) {
  if (!screen) return;
  const pulse = reducedMotion ? 0 : (Math.sin(now * 0.003) + 1) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.18 + pulse * 0.10;
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 58 * screen.scaleY, 102 * screen.scaleX, 15 * screen.scaleY, screen.rotation, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawSceneCorridors(progress) {
  const upcoming = stops
    .map(stop => ({ stop, rel: wrap01(stop.at - progress) }))
    .filter(item => item.rel > 0.015 && item.rel < 0.32)
    .sort((a, b) => a.rel - b.rel)[0];
  if (!upcoming) return;

  const vp = vanishingPoint(progress);
  const screen = projectObject(upcoming.stop, progress, 0.84);
  if (!screen) return;

  ctx.save();
  ctx.globalAlpha = 0.07 + screen.t * 0.05;
  ctx.strokeStyle = upcoming.stop.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(vp.x, vp.y);
  ctx.quadraticCurveTo((vp.x + screen.x) * 0.5, vp.y + 18, screen.x, screen.y + 46 * screen.scaleY);
  ctx.stroke();
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

  for (const item of projected) drawSceneArtwork(item.object, item.screen);

  if (activeStop) {
    const focus = projectObject(activeStop, progress, 1.0);
    drawSceneFocus(activeStop, focus, now);
  }
}

function closestStop(progress) {
  let best = null;
  let bestDist = Infinity;

  for (const stop of stops) {
    const d = Math.abs(wrapSigned(stop.at - progress));
    if (d < bestDist) {
      best = stop;
      bestDist = d;
    }
  }

  return { stop: best, distance: bestDist };
}

function nearestStop(progress) {
  const closest = closestStop(progress);
  return closest.distance < 0.055 ? closest.stop : null;
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

function cubicPoint(a, b, c, d, t) {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function cubicDerivative(a, b, c, d, t) {
  const mt = 1 - t;
  return 3 * mt * mt * (b - a) + 6 * mt * t * (c - b) + 3 * t * t * (d - c);
}

function wakePoint(start, c1, c2, end, t, phase, radius, turns) {
  const cx = cubicPoint(start.x, c1.x, c2.x, end.x, t);
  const cy = cubicPoint(start.y, c1.y, c2.y, end.y, t);
  const dx = cubicDerivative(start.x, c1.x, c2.x, end.x, t);
  const dy = cubicDerivative(start.y, c1.y, c2.y, end.y, t);
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const envelope = Math.sin(Math.PI * t) * (0.18 + t * 0.82);
  const offset = Math.sin(phase + t * TAU * turns) * radius * envelope;
  return { x: cx + nx * offset, y: cy + ny * offset };
}

function drawWakeStrand(start, c1, c2, end, options) {
  const { phase, radius, turns, color, alpha, widthNear } = options;
  const steps = degraded ? 44 : 70;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let previous = wakePoint(start, c1, c2, end, 0, phase, radius, turns);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const current = wakePoint(start, c1, c2, end, t, phase, radius, turns);
    ctx.globalAlpha = alpha * (0.25 + t * 0.75);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.55 + widthNear * Math.pow(t, 1.65);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    previous = current;
  }
  ctx.restore();
}

function drawFlightRibbons(stop, progress, now, emphasized) {
  if (!stop) return;
  const ship = shipPoint(progress);
  const vp = vanishingPoint(progress);
  const side = Math.sign(stop.side || 1);
  const intensity = emphasized ? 1 : 0.60;
  const radius = Math.min(cssW, cssH) * WAKE_MAX_RADIUS * (0.78 + intensity * 0.22);
  const phase = reducedMotion ? 0 : now * 0.0021;

  const start = { x: vp.x, y: vp.y + 6 };
  const c1 = { x: vp.x + side * cssW * 0.035, y: vp.y + cssH * 0.12 };
  const c2 = { x: ship.x - side * cssW * 0.055, y: ship.y - cssH * 0.19 };
  const end = { x: ship.x, y: ship.y + 26 };

  drawWakeStrand(start, c1, c2, end, {
    phase,
    radius,
    turns: 2.65,
    color: stop.color,
    alpha: 0.24 + intensity * 0.20,
    widthNear: 2.5 + intensity * 1.1,
  });
  drawWakeStrand(start, c1, c2, end, {
    phase: phase + TAU / 3,
    radius: radius * 0.86,
    turns: 2.65,
    color: COLORS.fox,
    alpha: 0.18 + intensity * 0.16,
    widthNear: 1.9 + intensity * 0.9,
  });
  drawWakeStrand(start, c1, c2, end, {
    phase: phase + TAU * 2 / 3,
    radius: radius * 0.68,
    turns: 2.65,
    color: COLORS.olive,
    alpha: 0.11 + intensity * 0.11,
    widthNear: 1.2 + intensity * 0.6,
  });

  if (!degraded) {
    ctx.save();
    for (const t of [0.32, 0.50, 0.68]) {
      const p = wakePoint(start, c1, c2, end, t, phase, radius * 0.48, 2.65);
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = 0.18 + t * 0.18;
      ctx.fillStyle = stop.color;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.rotate(-Math.PI / 4);
      ctx.translate(-p.x, -p.y);
    }
    ctx.restore();
  }
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
  const current = activeStop || closestStop(progress).stop;
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
  trail.push({ x: ship.x, y: ship.y + 23 });
  if (trail.length > 40) trail.shift();

  clearBackground(progress);
  drawPerspectiveGuide(progress);
  drawStars(progress, now);
  drawSceneCorridors(progress);
  drawWorldObjects(progress, now);
  drawTrail(trail, COLORS.ink, 0.75, 0.09);

  const ribbonStop = activeStop || closestStop(progress).stop;
  drawFlightRibbons(ribbonStop, progress, now, Boolean(activeStop));

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
    artDirection: 'hero-station-plus-supporting-silhouettes',
    ribbon: RIBBON_CONTRACT,
    ribbonStrands: 3,
    wakeMaxRadius: WAKE_MAX_RADIUS,
  };

  requestAnimationFrame(animate);
}

resize();
updateTargetFromScroll();
requestAnimationFrame(animate);
