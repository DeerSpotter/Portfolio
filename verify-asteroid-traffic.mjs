import { createAsteroidTraffic } from './src/asteroid-traffic.js';

function makeCaptureContext() {
  let path = [];
  const strokes = [];
  const gradient = { addColorStop() {} };
  return {
    strokes,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    createLinearGradient() { return gradient; },
    fill() {},
    stroke() {
      if (path.length >= 2) strokes.push([path[0], path[1]]);
    },
    set globalAlpha(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
    set fillStyle(_value) {},
  };
}

function signature(strokes) {
  return strokes.reduce((sum, [[x1, y1], [x2, y2]], index) => (
    sum + x1 * 0.71 + y1 * 1.13 + x2 * 1.37 + y2 * 1.91 + index * 0.0001
  ), 0);
}

function sampleMotion(reducedMotion) {
  const traffic = createAsteroidTraffic(59381);
  const ctx = makeCaptureContext();
  const args = [ctx, 390, 844, 0.05, 0.23, reducedMotion, false];

  traffic.render(...args);
  if (!ctx.strokes.length) throw new Error('Asteroid traffic proof captured no perspective trails.');
  const first = signature(ctx.strokes);
  const firstCount = ctx.strokes.length;

  ctx.strokes.length = 0;
  traffic.render(...args);
  if (!ctx.strokes.length) throw new Error('Asteroid traffic proof lost all perspective trails on the second frame.');
  const second = signature(ctx.strokes);

  return {
    delta: second - first,
    firstCount,
    secondCount: ctx.strokes.length,
  };
}

const desktop = sampleMotion(false);
const reduced = sampleMotion(true);

if (Math.abs(desktop.delta) < 1e-6) {
  throw new Error(`Desktop asteroid traffic did not advance: ${JSON.stringify(desktop)}`);
}
if (Math.abs(reduced.delta) < 1e-6) {
  throw new Error(`Reduced-motion asteroid traffic is frozen: ${JSON.stringify(reduced)}`);
}
if (Math.abs(reduced.delta - desktop.delta) > 1e-9
    || reduced.firstCount !== desktop.firstCount
    || reduced.secondCount !== desktop.secondCount) {
  throw new Error(`Reduced-motion traffic no longer matches desktop timing: ${JSON.stringify({ desktop, reduced })}`);
}

console.log('[portfolio-asteroid-traffic] PASS');
console.log('[portfolio-asteroid-traffic] reduced-motion=desktop-depth-clock');
console.log('[portfolio-asteroid-traffic] trails=advancing-from-vanishing-point');
