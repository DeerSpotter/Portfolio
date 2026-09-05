import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

function quaternionStep(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

async function exercise(viewport, reducedMotion, label) {
  const page = await browser.newPage({ viewport });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioShipDebug?.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);

  const initial = await page.evaluate(() => structuredClone(window.__portfolioShipDebug));
  if (initial.motionContract !== 'route-locked-attitude-smoothed-v1') {
    throw new Error(`${label}: wrong ship motion contract: ${initial.motionContract}`);
  }
  if (initial.positionTrackingError > 0.001 || initial.cameraTrackingError > 0.001) {
    throw new Error(`${label}: ship already lags route before input: position=${initial.positionTrackingError}, camera=${initial.cameraTrackingError}`);
  }
  if (!initial.ship?.quaternion) {
    throw new Error(`${label}: rendered quaternion diagnostics are missing.`);
  }

  await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * 0.46);
  });

  const samples = await page.evaluate(async () => {
    const result = [];
    await new Promise(resolve => {
      let frames = 0;
      const sample = () => {
        const ship = window.__portfolioShipDebug;
        const canvas = window.__portfolioCanvasDebug;
        if (ship?.ready && canvas?.ready) {
          result.push({
            progress: canvas.progress,
            positionTrackingError: ship.positionTrackingError,
            cameraTrackingError: ship.cameraTrackingError,
            attitudeError: ship.attitudeError,
            x: ship.ship.x,
            y: ship.ship.y,
            z: ship.ship.z,
            quaternion: structuredClone(ship.ship.quaternion),
          });
        }
        frames += 1;
        if (frames >= 36) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return result;
  });

  if (samples.length < 24) throw new Error(`${label}: insufficient frame samples: ${samples.length}`);
  const progressTravel = samples.at(-1).progress - samples[0].progress;
  if (Math.abs(progressTravel) < 0.08) {
    throw new Error(`${label}: flight did not move enough to evaluate smoothness: progress delta=${progressTravel}`);
  }

  const maxPositionError = Math.max(...samples.map(sample => sample.positionTrackingError));
  const maxCameraError = Math.max(...samples.map(sample => sample.cameraTrackingError));
  if (maxPositionError > 0.001) {
    throw new Error(`${label}: ship position was damped behind the route: max error=${maxPositionError}`);
  }
  if (maxCameraError > 0.001) {
    throw new Error(`${label}: camera translation was damped behind the chase target: max error=${maxCameraError}`);
  }

  let maxAttitudeStep = 0;
  let movingFrames = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const next = samples[i];
    const attitudeStep = quaternionStep(prev.quaternion, next.quaternion);
    maxAttitudeStep = Math.max(maxAttitudeStep, attitudeStep);
    const displacement = Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z);
    if (displacement > 0.01) movingFrames += 1;
  }

  if (movingFrames < 10) {
    throw new Error(`${label}: route motion collapsed into too few frames: movingFrames=${movingFrames}`);
  }
  if (maxAttitudeStep > 0.24) {
    throw new Error(`${label}: rendered ship orientation still snaps between frames: max quaternion step=${maxAttitudeStep}`);
  }

  console.log(`[portfolio-ship-smoothness] ${label} PASS progress=${progressTravel.toFixed(3)} movingFrames=${movingFrames} maxQuaternionStep=${maxAttitudeStep.toFixed(4)}`);
  await page.close();
}

try {
  await exercise({ width: 1440, height: 900 }, false, 'desktop');
  await exercise({ width: 414, height: 896 }, true, 'mobile-reduced-motion');
  console.log('[portfolio-ship-smoothness] PASS');
  console.log('[portfolio-ship-smoothness] position=route-locked-no-secondary-damping');
  console.log('[portfolio-ship-smoothness] camera=route-locked-translation');
  console.log('[portfolio-ship-smoothness] attitude=rendered-quaternion-continuity');
} finally {
  await browser.close();
}
