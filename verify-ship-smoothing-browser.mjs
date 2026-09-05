import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function angleDelta(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

async function exercise(label, viewport, reducedMotion, scrollFraction) {
  const page = await browser.newPage({ viewport });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.__portfolioCanvasDebug?.ready && window.__portfolioShipDebug?.ready,
    null,
    { timeout: 15000 },
  );

  const initial = await page.evaluate(() => structuredClone(window.__portfolioShipDebug));
  if (initial.smoothingContract !== 'inertial-chase-presentation-v1') {
    throw new Error(`${label}: ship smoothing contract is missing: ${initial.smoothingContract}`);
  }
  if (Boolean(initial.smoothing.compact) !== (viewport.width <= 700 || (viewport.width <= 900 && viewport.height <= 600))) {
    throw new Error(`${label}: compact-flight profile mismatch: ${JSON.stringify(initial.smoothing)}`);
  }

  const samples = await page.evaluate(async fraction => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * fraction);
    const result = [];
    const started = performance.now();
    while (performance.now() - started < 900) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const debug = window.__portfolioShipDebug;
      const canvas = window.__portfolioCanvasDebug;
      if (!debug?.ready || !canvas?.ready) continue;
      result.push({
        t: performance.now() - started,
        progress: canvas.progress,
        ship: structuredClone(debug.ship),
        target: structuredClone(debug.targetShip),
        routeLag: debug.smoothing.routeLag,
        lookLag: debug.smoothing.lookLag,
        positionLambda: debug.smoothing.positionLambda,
        cameraLambda: debug.smoothing.cameraLambda,
      });
    }
    return result;
  }, scrollFraction);

  if (samples.length < 12) throw new Error(`${label}: too few rendered samples: ${samples.length}`);
  const progressValues = samples.map(sample => sample.progress);
  const progressSpan = Math.max(...progressValues) - Math.min(...progressValues);
  if (progressSpan < 0.10) throw new Error(`${label}: scroll did not drive meaningful flight: span=${progressSpan}`);

  const steps = [];
  const attitudeSteps = [];
  for (let index = 1; index < samples.length; index++) {
    steps.push(distance(samples[index].ship, samples[index - 1].ship));
    attitudeSteps.push(Math.max(
      angleDelta(samples[index].ship.yaw, samples[index - 1].ship.yaw),
      angleDelta(samples[index].ship.pitch, samples[index - 1].ship.pitch),
      angleDelta(samples[index].ship.roll, samples[index - 1].ship.roll),
    ));
  }

  const totalDistance = steps.reduce((sum, value) => sum + value, 0);
  const maxStep = Math.max(...steps);
  const maxAttitudeStep = Math.max(...attitudeSteps);
  const maxRouteLag = Math.max(...samples.map(sample => sample.routeLag));
  const maxLookLag = Math.max(...samples.map(sample => sample.lookLag));

  if (totalDistance < 12) throw new Error(`${label}: ship barely moved: total=${totalDistance}`);
  if (maxRouteLag < 0.75) throw new Error(`${label}: ship is still snapping to the route target: max lag=${maxRouteLag}`);
  if (maxLookLag < 0.20) throw new Error(`${label}: chase-camera aim is not easing independently: max look lag=${maxLookLag}`);
  if (maxStep > Math.max(18, totalDistance * 0.32)) {
    throw new Error(`${label}: one frame carried too much of the motion: maxStep=${maxStep}, total=${totalDistance}`);
  }
  if (maxAttitudeStep > 0.48) {
    throw new Error(`${label}: ship attitude snapped between frames: delta=${maxAttitudeStep}`);
  }

  const expectedPositionCeiling = viewport.width <= 700 || (viewport.width <= 900 && viewport.height <= 600) ? 5.0 : 6.6;
  if (Math.max(...samples.map(sample => sample.positionLambda)) > expectedPositionCeiling) {
    throw new Error(`${label}: position response is too stiff for the inertial profile.`);
  }

  await page.waitForFunction(() => {
    const ship = window.__portfolioShipDebug;
    const canvas = window.__portfolioCanvasDebug;
    return ship?.ready
      && canvas?.ready
      && Math.abs(canvas.velocity) < 0.012
      && ship.smoothing.routeLag < 0.85
      && ship.smoothing.lookLag < 1.2;
  }, null, { timeout: 5000 });

  const settled = await page.evaluate(() => structuredClone(window.__portfolioShipDebug));
  console.log(`[portfolio-ship-smoothing] ${label}: samples=${samples.length} total=${totalDistance.toFixed(2)} maxStep=${maxStep.toFixed(2)} maxRouteLag=${maxRouteLag.toFixed(2)} settledLag=${settled.smoothing.routeLag.toFixed(2)}`);
  await page.close();
}

try {
  await exercise('desktop', { width: 1440, height: 900 }, false, 0.42);
  await exercise('mobile-reduced-motion', { width: 414, height: 896 }, true, 0.48);
  console.log('[portfolio-ship-smoothing] PASS');
  console.log('[portfolio-ship-smoothing] motion=route-ease+attitude-ease+camera-look-ease');
} finally {
  await browser.close();
}
