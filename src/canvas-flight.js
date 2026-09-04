const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const chapterEl = document.getElementById('chapterName');
const detailTitleEl = document.getElementById('detailTitle');
const detailBodyEl = document.getElementById('detailBody');
const velocityEl = document.getElementById('velocity');
const loopEl = document.getElementById('cycle');
const hintEl = document.getElementById('hint');

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

const stops = [
  { at: 0.04, title: 'Departure', body: 'A guided flight through engineering, automation, AI systems, runtime work, and simulation.', color: COLORS.fox, side: -0.20, lift: -0.02 },
  { at: 0.18, title: 'Engineering Foundations', body: 'Mechanical design, NX, Teamcenter, PLM problem solving, and years of real engineering constraints.', color: COLORS.olive, side: 0.66, lift: -0.16 },
  { at: 0.34, title: 'Automation', body: 'Tools that reduce repetitive engineering work, expose failures clearly, and make difficult workflows simpler.', color: COLORS.blue, side: -0.68, lift: 0.10 },
  { at: 0.51, title: 'AI Systems', body: 'Context portability, agent workflows, human approval boundaries, and AI-assisted engineering with verification.', color: COLORS.plum, side: 0.62, lift: -0.05 },
  { at: 0.69, title: 'Runtime Engineering', body: 'Compatibility layers, ARM64 execution, generated adapters, filesystem boundaries, and fail-closed diagnostics.', color: COLORS.rust, side: -0.62, lift: 0.14 },
  { at: 0.85, title: 'Mission Systems', body: 'Simulation, operational visualization, source-grounded capability modeling, and complex systems made explorable.', color: COLORS.gold, side: 0.68, lift: 0.05 },
];

const planets = [
  { at: 0.10, r: 62, side: 0.72, lift: -0.18, c1: '#d99554', c2: '#8e5c31', ring: true, tilt: -0.30 },
  { at: 0.27, r: 46, side: -0.76, lift: -0.12, c1: '#87906a', c2: '#545d3b', ring: false, tilt: 0 },
  { at: 0.44, r: 75, side: 0.80, lift: 0.12, c1: '#8195a0', c2: '#4c6378', ring: true, tilt: 0.23 },
  { at: 0.61, r: 52, side: -0.74, lift: 0.14, c1: '#bd735d', c2: '#7a4537', ring: true, tilt: -0.42 },
  { at: 0.79, r: 66, side: 0.74, lift: -0.10, c1: '#d0a85c', c2: '#87672f', ring: false, tilt: 0 },
  { at: 0.94, r: 42, side: -0.68, lift: -0.02, c1: '#8e7b79', c2: '#694f66', ring: true, tilt: 0.36 },
];

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
function damp(current, target, lambda, dt) { return current + (target - current) * (1 - Math.exp(-lambda * dt)); }

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
  const starCount = degraded ? 65 : 130;
  const markCount = degraded ? 30 : 68;
  for (let i = 0; i < starCount; i++) {
    stars.push({ x: random(), y: random(), size: 0.4 + random() * 1.4, layer: 0.12 + random() * 0.88, phase: random() * TAU });
  }
  for (let i = 0; i < markCount; i++) {
    paperMarks.push({ x: random(), y: random(), len: 5 + random() * 24, tilt: (random() - 0.5) * 0.5, alpha: 0.025 + random() * 0.045 });
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
  if (Math.abs(scrollY - lastScrollY) > 12) hintEl.style.opacity = '0.36';
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
addEventListener('visibilitychange', () => { if (!document.hidden) lastTime = performance.now(); });

function vanishingPoint(progress) {
  return {
    x: cssW * (0.50 + Math.sin(progress * TAU * 1.10) * 0.035),
    y: cssH * (0.35 + Math.cos(progress * TAU * 0.75) * 0.025),
  };
}

function shipPoint(progress) {
  return {
    x: cssW * (0.50 + Math.sin(progress * TAU * 1.45) * 0.070 + Math.sin(progress * TAU * 3.1) * 0.018),
    y: cssH * (0.72 + Math.cos(progress * TAU * 1.20) * 0.030),
  };
}

function shipHeading(progress) {
  const p1 = shipPoint(wrap01(progress - 0.003));
  const p2 = shipPoint(wrap01(progress + 0.003));
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

// Perspective projection for a chase-camera illusion. Objects ahead are born
// near the vanishing point, grow as the ship approaches, then sweep past the
// left/right foreground. This intentionally preserves the movement language of
// the live-3D prototype instead of turning the journey into side-scrolling.
function projectObject(obj, progress, depthScale = 1) {
  const rel = wrapSigned(obj.at - progress);
  if (rel < -0.055 || rel > 0.36) return null;

  const vp = vanishingPoint(progress);
  const t = clamp((0.36 - rel) / 0.415, 0, 1); // 0=far, 1=passing camera
  const perspective = 0.10 + Math.pow(t, 1.85) * 1.72 * depthScale;
  const side = obj.side || 0;
  const lift = obj.lift || 0;
  const laneX = cssW * (0.50 + side * 0.46);
  const laneY = cssH * (0.50 + lift * 0.55);

  const passKick = rel < 0 ? Math.pow(clamp(-rel / 0.055, 0, 1), 1.2) : 0;
  const x = vp.x + (laneX - vp.x) * perspective + side * cssW * 0.28 * passKick;
  const y = vp.y + (laneY - vp.y) * perspective + cssH * 0.18 * passKick;
  const scale = 0.16 + Math.pow(t, 1.55) * 1.55;
  const alpha = clamp(t * 2.7, 0.10, 1) * clamp((0.38 - rel) * 8, 0.2, 1);
  return { x, y, scale, alpha, rel, t };
}

function clearBackground(progress) {
  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  g.addColorStop(0, COLORS.paperLight);
  g.addColorStop(0.58, COLORS.paper);
  g.addColorStop(1, '#d3bb8c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const vp = vanishingPoint(progress);
  const wash = ctx.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, Math.max(cssW, cssH) * 0.58);
  wash.addColorStop(0, 'rgba(255,248,225,.72)');
  wash.addColorStop(0.45, 'rgba(207,111,47,.055)');
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
  ctx.strokeStyle = 'rgba(86,68,44,.11)';
  ctx.lineWidth = 1;
  for (const edge of [-0.46, -0.23, 0.23, 0.46]) {
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y);
    ctx.lineTo(cssW * (0.5 + edge), cssH * 1.02);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.08;
  for (let i = 1; i <= 5; i++) {
    const y = vp.y + (cssH - vp.y) * Math.pow(i / 5, 1.7);
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
    const alpha = 0.10 + star.layer * 0.22 + Math.sin(now * 0.001 + star.phase) * 0.04;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = star.size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    if (warp > 0.10) {
      const dx = sx - vp.x;
      const dy = sy - vp.y;
      ctx.lineTo(sx + dx * 0.045 * warp, sy + dy * 0.045 * warp);
    } else {
      ctx.lineTo(sx + 0.1, sy + 0.1);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlanet(planet, screen) {
  const r = planet.r * screen.scale;
  ctx.save();
  ctx.globalAlpha = screen.alpha * 0.92;
  ctx.translate(screen.x, screen.y);

  if (planet.ring) {
    ctx.save();
    ctx.rotate(planet.tilt);
    ctx.strokeStyle = COLORS.ink;
    ctx.globalAlpha *= 0.28;
    ctx.lineWidth = Math.max(1.2, r * 0.055);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.72, r * 0.40, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = planet.c1;
    ctx.globalAlpha *= 1.8;
    ctx.lineWidth = Math.max(1, r * 0.022);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.00, r * 0.52, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = planet.c1;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(1.2, r * 0.032);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha *= 0.30;
  ctx.fillStyle = planet.c2;
  ctx.beginPath();
  ctx.ellipse(-r * 0.20, r * 0.06, r * 0.68, r * 0.17, -0.16, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.12, -r * 0.28, r * 0.46, r * 0.10, 0.18, 0, TAU);
  ctx.fill();

  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = COLORS.paperLight;
  ctx.lineWidth = Math.max(1, r * 0.018);
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.22, r * 0.52, 3.75, 5.55);
  ctx.stroke();
  ctx.restore();
}

function drawWaypoint(stop, screen, selected) {
  const radius = (selected ? 17 : 11) * screen.scale;
  ctx.save();
  ctx.globalAlpha = screen.alpha;
  ctx.translate(screen.x, screen.y);
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = selected ? 3 : 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha *= 0.35;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.72, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * 2.0, 0); ctx.lineTo(radius * 2.0, 0);
  ctx.moveTo(0, -radius * 2.0); ctx.lineTo(0, radius * 2.0);
  ctx.stroke();
  ctx.restore();
}

function drawWorldObjects(progress) {
  const projected = [];
  for (const planet of planets) {
    const screen = projectObject(planet, progress, 1.08);
    if (screen) projected.push({ kind: 'planet', obj: planet, screen });
  }
  for (const stop of stops) {
    const screen = projectObject(stop, progress, 1.0);
    if (screen) projected.push({ kind: 'stop', obj: stop, screen });
  }
  projected.sort((a, b) => a.screen.scale - b.screen.scale);
  for (const item of projected) {
    if (item.kind === 'planet') drawPlanet(item.obj, item.screen);
    else drawWaypoint(item.obj, item.screen, activeStop === item.obj);
  }
}

function nearestStop(progress) {
  let best = null;
  let bestDist = Infinity;
  for (const stop of stops) {
    const d = Math.abs(wrapSigned(stop.at - progress));
    if (d < bestDist) { best = stop; bestDist = d; }
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
  ctx.bezierCurveTo(ship.x - 44, ship.y + 56, target.x - 54, target.y + 28, target.x - 28, target.y);
  for (let i = 0; i <= 48; i++) {
    const a = phase + i / 48 * TAU * 1.65;
    const rr = 34 - i * 0.42;
    ctx.lineTo(target.x + Math.cos(a) * rr, target.y + Math.sin(a) * rr * 0.58);
  }
  ctx.stroke();

  ctx.globalAlpha = 0.30;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i <= 42; i++) {
    const a = -phase * 0.75 + i / 42 * TAU * 1.4;
    const rr = 45 - i * 0.54;
    const x = target.x + Math.cos(a) * rr;
    const y = target.y + Math.sin(a) * rr * 0.50;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShip(x, y, heading, speed, now) {
  const bob = reducedMotion ? 0 : Math.sin(now * 0.0025) * 1.8;
  const bank = clamp(velocity * 0.11 + Math.sin(travel * TAU * 1.45) * 0.10, -0.34, 0.34);
  const warp = clamp(speed * 5, 0, 1);

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(bank);
  const scale = clamp(0.92 + speed * 0.020, 0.92, 1.12);
  ctx.scale(scale, scale);

  // Ink-like exhaust ribbons. They lengthen with scroll speed but stay cheap.
  ctx.globalAlpha = 0.28 + warp * 0.36;
  ctx.strokeStyle = COLORS.fox;
  ctx.lineWidth = 3.0;
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 19, 24);
    ctx.bezierCurveTo(sx * 20, 46, sx * (15 + warp * 9), 64 + warp * 26, sx * (10 + warp * 7), 82 + warp * 34);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Cartoon exploration ship: cream paper hull, dark ink outline, fox-orange accents.
  ctx.fillStyle = '#f0e6cf';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.quadraticCurveTo(13, -25, 17, -4);
  ctx.lineTo(39, 18);
  ctx.lineTo(18, 16);
  ctx.lineTo(11, 31);
  ctx.lineTo(0, 23);
  ctx.lineTo(-11, 31);
  ctx.lineTo(-18, 16);
  ctx.lineTo(-39, 18);
  ctx.lineTo(-17, -4);
  ctx.quadraticCurveTo(-13, -25, 0, -38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.rust;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -13, 8, 13, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.fox;
  ctx.beginPath();
  ctx.moveTo(-30, 13); ctx.lineTo(-13, 3); ctx.lineTo(-16, 17); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, 13); ctx.lineTo(13, 3); ctx.lineTo(16, 17); ctx.closePath(); ctx.fill();

  ctx.fillStyle = COLORS.ink;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(sx * 22 - 3.5, 12, 7, 22, 3.5);
    ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(sx * 22 - 1.8, 17, 3.6, 12);
    ctx.fillStyle = COLORS.ink;
  }

  // Tiny drafting marks sell the illustrated-paper look.
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, 5); ctx.lineTo(8, 5);
  ctx.moveTo(-6, 10); ctx.lineTo(6, 10);
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
  chapterEl.textContent = current.title;
  detailTitleEl.textContent = current.title;
  detailBodyEl.textContent = current.body;
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
  const heading = shipHeading(progress);
  trail.push({ x: ship.x, y: ship.y + 20 });
  trailGhost.push({ x: ship.x + Math.sin(now * 0.0035) * 3.0, y: ship.y + 27 });
  if (trail.length > 52) trail.shift();
  if (trailGhost.length > 46) trailGhost.shift();

  clearBackground(progress);
  drawPerspectiveGuide(progress);
  drawStars(progress, now);
  drawWorldObjects(progress);
  drawTrail(trailGhost, COLORS.olive, 1.0, 0.20);
  drawTrail(trail, COLORS.fox, 2.3, 0.64);
  if (activeStop) drawOrbitCurl(activeStop, progress, now);

  // The illustrated canvas stays exactly as the world renderer. The old 2D
  // ship draw is intentionally disabled so the original procedural 3D ship can
  // fly over this canvas with its original perspective chase camera.
  // drawShip(ship.x, ship.y, heading, Math.abs(velocity), now);

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
  };

  requestAnimationFrame(animate);
}

resize();
updateTargetFromScroll();
requestAnimationFrame(animate);
