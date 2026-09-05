import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync('src/ship-overlay.js', 'utf8');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

// Do not solve smoothness by changing the known-good flight response again.
for (const required of [
  'const positionLambda = 9.0 - coastAmount * 3.2 - timeFieldAmount * 1.4;',
  'const tangentLambda = 7.5 - coastAmount * 2.6 - timeFieldAmount * 1.3;',
  'const attitudeLambda = Math.max(3.4, 8.5 - coastAmount * 3.2 - timeFieldAmount * 1.2);',
  'const cameraLambda = Math.max(3.0, 5.2 - coastAmount * 1.15 - timeFieldAmount * 0.55);',
  'TANGENT_SAMPLE_WINDOW = 0.006',
  'tangent.multiplyScalar(2).add(tangentBefore).add(tangentAfter).normalize();',
  "motionContract: 'known-good-speed-spatial-tangent-v1'",
]) {
  if (!source.includes(required)) throw new Error(`Known-good ship response contract missing: ${required}`);
}

for (const forbidden of [
  'targetQuaternion',
  'maxAttitudeStep',
  'positionTrackingError',
  'cameraTrackingError',
  "motionContract: 'route-locked-attitude-smoothed-v1'",
]) {
  if (source.includes(forbidden)) throw new Error(`Unstable PR #26 orientation path returned: ${forbidden}`);
}

function quaternionStep(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

function assertFiniteSample(sample, label) {
  const values = [
    sample.progress,
    sample.x, sample.y, sample.z,
    sample.quaternion.x, sample.quaternion.y, sample.quaternion.z, sample.quaternion.w,
  ];
  if (!values.every(Number.isFinite)) throw new Error(`${label}: non-finite ship state detected.`);
}

async function exercise(viewport, reducedMotion, label) {
  const page = await browser.newPage({ viewport });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioShipDebug?.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);

  const initialContract = await page.evaluate(() => window.__portfolioShipDebug?.motionContract);
  if (initialContract !== 'known-good-speed-spatial-tangent-v1') {
    throw new Error(`${label}: wrong ship motion contract: ${initialContract}`);
  }

  // Drive the page the way a real continuous swipe/scroll does: many small
  // target updates, not one artificial teleport across half the document.
  const samples = await page.evaluate(async () => {
    const result = [];
    const max = document.documentElement.scrollHeight - innerHeight;
    const start = 0.06;
    const end = 0.68;

    for (let frame = 0; frame < 90; frame++) {
      const t = frame / 89;
      scrollTo(0, max * (start + (end - start) * t));
      await new Promise(requestAnimationFrame);
      const ship = window.__portfolioShipDebug;
      const canvas = window.__portfolioCanvasDebug;
      if (ship?.ready && canvas?.ready) {
        result.push({
          progress: canvas.progress,
          x: ship.ship.x,
          y: ship.ship.y,
          z: ship.ship.z,
          quaternion: structuredClone(ship.ship.quaternion),
        });
      }
    }
    return result;
  });

  if (samples.length < 70) throw new Error(`${label}: insufficient continuous-motion samples: ${samples.length}`);
  samples.forEach(sample => assertFiniteSample(sample, label));

  const progressTravel = Math.abs(samples.at(-1).progress - samples[0].progress);
  if (progressTravel < 0.12) {
    throw new Error(`${label}: flight did not respond at normal speed during continuous input: progress delta=${progressTravel}`);
  }

  let movingFrames = 0;
  let maxQuaternionStep = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    const displacement = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      current.z - previous.z,
    );
    if (displacement > 0.01) movingFrames += 1;
    maxQuaternionStep = Math.max(maxQuaternionStep, quaternionStep(previous.quaternion, current.quaternion));
  }

  if (movingFrames < 45) {
    throw new Error(`${label}: ship movement collapsed into too few frames: movingFrames=${movingFrames}`);
  }
  // This is intentionally a jolt/spin guard, not a tuning target. The known-good
  // Euler damping remains responsible for feel; CI only rejects violent frame jumps.
  if (maxQuaternionStep > 0.50) {
    throw new Error(`${label}: sudden ship jolt/spin detected: max quaternion step=${maxQuaternionStep}`);
  }

  // Exercise the closed-route seam too, where orientation bugs are most likely
  // to reveal themselves as a 180/360-degree flip.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(450);
  const seamSamples = [];
  await page.mouse.wheel(0, 1000);
  for (let frame = 0; frame < 30; frame++) {
    await page.waitForTimeout(16);
    seamSamples.push(await page.evaluate(() => structuredClone(window.__portfolioShipDebug.ship.quaternion)));
  }
  let maxSeamStep = 0;
  for (let index = 1; index < seamSamples.length; index++) {
    maxSeamStep = Math.max(maxSeamStep, quaternionStep(seamSamples[index - 1], seamSamples[index]));
  }
  if (maxSeamStep > 0.65) {
    throw new Error(`${label}: ship orientation flips at the route loop seam: max quaternion step=${maxSeamStep}`);
  }

  console.log(`[portfolio-ship-continuity] ${label} PASS progress=${progressTravel.toFixed(3)} movingFrames=${movingFrames} maxStep=${maxQuaternionStep.toFixed(4)} seam=${maxSeamStep.toFixed(4)}`);
  await page.close();
}

try {
  await exercise({ width: 1440, height: 900 }, false, 'desktop');
  await exercise({ width: 414, height: 896 }, true, 'mobile-reduced-motion');
  console.log('[portfolio-ship-continuity] PASS');
  console.log('[portfolio-ship-continuity] speed=known-good-baseline-constants');
  console.log('[portfolio-ship-continuity] smoothing=spatial-route-direction-not-extra-lag');
  console.log('[portfolio-ship-continuity] unstable-pr26-orientation=absent');
} finally {
  await browser.close();
}
