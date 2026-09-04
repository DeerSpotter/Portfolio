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
const stars = [];
const trail = [];
const trailGhost = [];
const random = mulberry32(0x51a7f00d);

const stops = [
  { at: 0.04, title: 'Departure', body: 'A guided flight through engineering, automation, AI systems, runtime work, and simulation.', color: '#78d8ff', x: 0.28, y: 0.33 },
  { at: 0.18, title: 'Engineering Foundations', body: 'Mechanical design, NX, Teamcenter, PLM problem solving, and years of real engineering constraints.', color: '#6bc8ff', x: 0.72, y: 0.30 },
  { at: 0.34, title: 'Automation', body: 'Tools that reduce repetitive engineering work, expose failures clearly, and make difficult workflows simpler.', color: '#c18cff', x: 0.25, y: 0.58 },
  { at: 0.51, title: 'AI Systems', body: 'Context portability, agent workflows, human approval boundaries, and AI-assisted engineering with verification.', color: '#76f1cf', x: 0.76, y: 0.42 },
  { at: 0.69, title: 'Runtime Engineering', body: 'Compatibility layers, ARM64 execution, generated adapters, filesystem boundaries, and fail-closed diagnostics.', color: '#ff8ab9', x: 0.29, y: 0.67 },
  { at: 0.85, title: 'Mission Systems', body: 'Simulation, operational visualization, source-grounded capability modeling, and complex systems made explorable.', color: '#f7c972', x: 0.73, y: 0.62 },
];

const planets = [
  { at: 0.10, r: 78, x: 0.76, y: 0.24, c1: '#5bc7ff', c2: '#174c85', ring: true, tilt: -0.28 },
  { at: 0.27, r: 54, x: 0.18, y: 0.28, c1: '#d99cff', c2: '#5a2b81', ring: false, tilt: 0 },
  { at: 0.44, r: 96, x: 0.82, y: 0.70, c1: '#63e6ca', c2: '#155d62', ring: true, tilt: 0.22 },
  { at: 0.61, r: 62, x: 0.22, y: 0.72, c1: '#ff8fbd', c2: '#742c59', ring: true, tilt: -0.44 },
  { at: 0.79, r: 86, x: 0.78, y: 0.30, c1: '#ffc776', c2: '#7d4d21', ring: false, tilt: 0 },
  { at: 0.94, r: 48, x: 0.20, y: 0.46, c1: '#8da8ff', c2: '#334174', ring: true, tilt: 0.38 },
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
  rebuildStars();
}

function rebuildStars() {
  stars.length = 0;
  const count = degraded ? 90 : 190;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(), y: random(), size: 0.55 + random() * 1.8,
      layer: 0.15 + random() * 0.85, twinkle: random() * TAU,
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
  if (Math.abs(scrollY - lastScrollY) > 12) hintEl.style.opacity = '0.35';
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

function routePoint(progress) {
  const a = progress * TAU;
  return {
    x: cssW * 0.50 + Math.sin(a * 1.8) * cssW * 0.115 + Math.sin(a * 4.4) * cssW * 0.020,
    y: cssH * 0.58 + Math.cos(a * 1.35) * cssH * 0.085 + Math.sin(a * 3.2) * cssH * 0.025,
  };
}

function routeTangent(progress) {
  const p1 = routePoint(wrap01(progress - 0.002));
  const p2 = routePoint(wrap01(progress + 0.002));
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function relativeScreen(obj, progress, depthScale = 1) {
  const rel = wrapSigned(obj.at - progress);
  if (rel < -0.09 || rel > 0.38) return null;
  const z = clamp((rel + 0.09) / 0.47, 0, 1);
  const near = 1 - z;
  const vanX = cssW * 0.52;
  const vanY = cssH * 0.42;
  const targetX = obj.x * cssW;
  const targetY = obj.y * cssH;
  const expansion = 0.35 + near * 0.95 * depthScale;
  return {
    x: vanX + (targetX - vanX) * expansion,
    y: vanY + (targetY - vanY) * expansion,
    scale: 0.30 + near * 1.18,
    alpha: clamp(Math.sin(clamp((1 - z) * Math.PI, 0, Math.PI)) * 1.8, 0.12, 1),
    rel,
  };
}

function clearBackground(progress) {
  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  const hue = (progress * 210 + 210) % 360;
  g.addColorStop(0, `hsl(${hue} 45% 8%)`);
  g.addColorStop(0.55, `hsl(${(hue + 32) % 360} 48% 5%)`);
  g.addColorStop(1, '#020307');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const glow = ctx.createRadialGradient(cssW * 0.5, cssH * 0.42, 0, cssW * 0.5, cssH * 0.42, Math.max(cssW, cssH) * 0.52);
  glow.addColorStop(0, 'rgba(86,143,255,.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, cssW, cssH);
}

function drawStars(progress, now) {
  const speed = velocity * 0.16;
  for (const star of stars) {
    const px = wrap01(star.x - progress * star.layer * 1.8 + speed) * cssW;
    const py = wrap01(star.y + Math.sin(progress * TAU + star.twinkle) * 0.008 * star.layer) * cssH;
    const alpha = 0.28 + Math.sin(now * 0.0014 + star.twinkle) * 0.14;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#dcecff';
    ctx.beginPath();
    ctx.arc(px, py, star.size * (0.55 + star.layer * 0.65), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(planet, screen) {
  const r = planet.r * screen.scale;
  ctx.save();
  ctx.globalAlpha = screen.alpha * 0.92;
  ctx.translate(screen.x, screen.y);

  if (planet.ring) {
    ctx.save();
    ctx.rotate(planet.tilt);
    ctx.strokeStyle = planet.c1;
    ctx.globalAlpha *= 0.44;
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.65, r * 0.42, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.00, r * 0.54, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  const g = ctx.createRadialGradient(-r * 0.34, -r * 0.40, r * 0.08, 0, 0, r);
  g.addColorStop(0, planet.c1);
  g.addColorStop(1, planet.c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  ctx.globalAlpha *= 0.18;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, r * 0.035);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(0, i * r * 0.23, r * (0.72 - Math.abs(i) * 0.08), 0.12, Math.PI - 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaypoint(stop, screen, selected) {
  const radius = (selected ? 18 : 12) * screen.scale;
  ctx.save();
  ctx.globalAlpha = screen.alpha;
  ctx.translate(screen.x, screen.y);
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha *= 0.35;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.75, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawWorldObjects(progress) {
  for (const planet of planets) {
    const screen = relativeScreen(planet, progress, 1.1);
    if (screen) drawPlanet(planet, screen);
  }
  for (const stop of stops) {
    const screen = relativeScreen(stop, progress, 1.0);
    if (screen) drawWaypoint(stop, screen, activeStop === stop);
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
  const target = relativeScreen(stop, progress, 1.0);
  if (!target) return;

  const phase = now * 0.0014;
  ctx.save();
  ctx.strokeStyle = stop.color;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  const start = trail[Math.max(0, trail.length - 1)] || routePoint(progress);
  ctx.moveTo(start.x, start.y);
  const cx = target.x;
  const cy = target.y;
  ctx.bezierCurveTo(start.x + 40, start.y - 30, cx - 52, cy + 18, cx - 24, cy);
  for (let i = 0; i <= 44; i++) {
    const a = phase + i / 44 * TAU * 1.55;
    const rr = 30 - i * 0.38;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.62);
  }
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = -phase * 0.8 + i / 40 * TAU * 1.35;
    const rr = 39 - i * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.55;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShip(x, y, angle, speed, now) {
  const bob = reducedMotion ? 0 : Math.sin(now * 0.003) * 2.4;
  const bank = clamp(velocity * 0.08, -0.22, 0.22);
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(angle + Math.PI / 2 + bank);
  const scale = clamp(0.82 + Math.abs(speed) * 0.012, 0.82, 1.10);
  ctx.scale(scale, scale);

  // soft exhaust
  ctx.globalAlpha = 0.28 + clamp(Math.abs(speed) * 0.015, 0, 0.48);
  ctx.fillStyle = '#67d8ff';
  ctx.beginPath();
  ctx.moveTo(-9, 31); ctx.quadraticCurveTo(-3, 56, 0, 70); ctx.quadraticCurveTo(3, 56, 9, 31); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // wings
  ctx.fillStyle = '#7c8ca8';
  ctx.strokeStyle = '#dce9ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(-35, 20); ctx.lineTo(-14, 17); ctx.lineTo(-8, 30); ctx.lineTo(0, 21); ctx.lineTo(8, 30); ctx.lineTo(14, 17); ctx.lineTo(35, 20); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // hull
  const g = ctx.createLinearGradient(-12, -28, 12, 31);
  g.addColorStop(0, '#f2f6ff');
  g.addColorStop(1, '#687b99');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -36); ctx.quadraticCurveTo(14, -10, 10, 25); ctx.quadraticCurveTo(0, 35, -10, 25); ctx.quadraticCurveTo(-14, -10, 0, -36); ctx.fill();

  // canopy
  ctx.fillStyle = '#153f67';
  ctx.beginPath();
  ctx.ellipse(0, -12, 7.2, 12, 0, 0, TAU); ctx.fill();

  // engine pods
  ctx.fillStyle = '#172334';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(sx * 22 - 4, 9, 8, 25, 4); ctx.fill();
    ctx.fillStyle = '#73dcff';
    ctx.fillRect(sx * 22 - 2, 14, 4, 15);
    ctx.fillStyle = '#172334';
  }
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
    rebuildStars();
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

  const ship = routePoint(progress);
  const tangent = routeTangent(progress);
  trail.push({ x: ship.x, y: ship.y });
  trailGhost.push({ x: ship.x + Math.sin(now * 0.004) * 3.5, y: ship.y + 5 });
  if (trail.length > 54) trail.shift();
  if (trailGhost.length > 48) trailGhost.shift();

  clearBackground(progress);
  drawStars(progress, now);
  drawWorldObjects(progress);
  drawTrail(trailGhost, '#8c72ff', 1.1, 0.20);
  drawTrail(trail, '#72dfff', 2.2, 0.66);
  if (activeStop) drawOrbitCurl(activeStop, progress, now);
  drawShip(ship.x, ship.y, tangent, Math.abs(velocity), now);

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
  };

  requestAnimationFrame(animate);
}

resize();
updateTargetFromScroll();
requestAnimationFrame(animate);
