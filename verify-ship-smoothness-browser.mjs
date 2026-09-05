import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync('src/ship-overlay.js', 'utf8');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

// Keep the last known-good flight response. This PR is allowed to change bank
// behavior only; it must not retune position, tangent, yaw/pitch or camera feel.
for (const required of [
  'const positionLambda = 9.0 - coastAmount * 3.2 - timeFieldAmount * 1.4;',
  'const tangentLambda = 7.5 - coastAmount * 2.6 - timeFieldAmount * 1.3;',
  'const attitudeLambda = Math.max(3.4, 8.5 - coastAmount * 3.2 - timeFieldAmount * 1.2);',
  'const cameraLambda = Math.max(3.0, 5.2 - coastAmount * 1.15 - timeFieldAmount * 0.55);',
  'const BANK_DEADBAND = 0.035;',
  'const BANK_CENTER_EPSILON = 0.025;',
  'requestedBankSide !== activeBankSide',
  'bankTargetRoll = 0;',
  "motionContract: 'known-good-flight-centered-bank-v1'",
]) {
  if (!source.includes(required)) throw new Error(`Centered-bank contract missing: ${required}`);
}

for (const forbidden of [
  'targetQuaternion',
  'maxAttitudeStep',
  'TANGENT_SAMPLE_WINDOW',
  'tangentBefore',
  'tangentAfter',
  "motionContract: 'route-locked-attitude-smoothed-v1'",
  "motionContract: 'known-good-speed-spatial-tangent-v1'",
]) {
  if (source.includes(forbidden)) throw new Error(`Out-of-scope ship smoothing returned: ${forbidden}`);
}

async function exercise(viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioShipDebug?.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);

  const initialContract = await page.evaluate(() => window.__portfolioShipDebug?.motionContract);
  if (initialContract !== 'known-good-flight-centered-bank-v1') {
    throw new Error(`${label}: wrong ship motion contract: ${initialContract}`);
  }

  const samples = await page.evaluate(async () => {
    const result = [];
    const max = document.documentElement.scrollHeight - innerHeight;
    for (let frame = 0; frame < 180; frame++) {
      const t = frame / 179;
      scrollTo(0, max * (0.02 + 0.96 * t));
      await new Promise(requestAnimationFrame);
      const ship = window.__portfolioShipDebug;
      const canvas = window.__portfolioCanvasDebug;
      if (ship?.ready && canvas?.ready) {
        result.push({
          progress: canvas.progress,
          roll: ship.ship.roll,
          activeSide: ship.bank.activeSide,
          requestedSide: ship.bank.requestedSide,
          targetRoll: ship.bank.targetRoll,
          appliedTargetRoll: ship.bank.appliedTargetRoll,
        });
      }
    }
    return result;
  });

  if (samples.length < 150) throw new Error(`${label}: insufficient bank samples: ${samples.length}`);
  const progressTravel = Math.abs(samples.at(-1).progress - samples[0].progress);
  if (progressTravel < 0.25) {
    throw new Error(`${label}: normal flight progress was slowed or collapsed: delta=${progressTravel}`);
  }

  const positivePeak = Math.max(...samples.map(sample => sample.roll));
  const negativePeak = Math.min(...samples.map(sample => sample.roll));
  if (positivePeak < 0.06 || negativePeak > -0.06) {
    throw new Error(`${label}: route did not demonstrate both bank directions: positive=${positivePeak}, negative=${negativePeak}`);
  }

  let maxRollStep = 0;
  let centerGateFrames = 0;
  let oppositeSideTransitions = 0;
  let previousActiveSide = samples[0].activeSide;
  let sinceLastActiveChangeMinAbsRoll = Math.abs(samples[0].roll);

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    maxRollStep = Math.max(maxRollStep, Math.abs(current.roll - previous.roll));
    sinceLastActiveChangeMinAbsRoll = Math.min(sinceLastActiveChangeMinAbsRoll, Math.abs(current.roll));

    if (current.requestedSide && current.activeSide && current.requestedSide !== current.activeSide) {
      centerGateFrames += 1;
      if (Math.abs(current.appliedTargetRoll) > 0.000001) {
        throw new Error(`${label}: opposite bank was applied before returning to center: ${JSON.stringify(current)}`);
      }
    }

    if (current.activeSide && previousActiveSide && current.activeSide !== previousActiveSide) {
      oppositeSideTransitions += 1;
      if (sinceLastActiveChangeMinAbsRoll > 0.04) {
        throw new Error(`${label}: bank changed sides without passing through center: min |roll|=${sinceLastActiveChangeMinAbsRoll}`);
      }
      sinceLastActiveChangeMinAbsRoll = Math.abs(current.roll);
    }
    if (current.activeSide) previousActiveSide = current.activeSide;
  }

  if (centerGateFrames < 1 || oppositeSideTransitions < 1) {
    throw new Error(`${label}: centered right/left handoff was not exercised: centerFrames=${centerGateFrames}, transitions=${oppositeSideTransitions}`);
  }
  if (maxRollStep > 0.14) {
    throw new Error(`${label}: bank still jolts between frames: max roll step=${maxRollStep}`);
  }

  console.log(`[portfolio-ship-bank] ${label} PASS progress=${progressTravel.toFixed(3)} right=${positivePeak.toFixed(3)} left=${negativePeak.toFixed(3)} centerFrames=${centerGateFrames} transitions=${oppositeSideTransitions} maxRollStep=${maxRollStep.toFixed(4)}`);
  await page.close();
}

try {
  await exercise({ width: 1440, height: 900 }, 'desktop');
  await exercise({ width: 414, height: 896 }, 'mobile');
  console.log('[portfolio-ship-bank] PASS');
  console.log('[portfolio-ship-bank] sequence=bank-right-center-bank-left-center');
  console.log('[portfolio-ship-bank] scope=roll-only-known-good-flight-preserved');
} finally {
  await browser.close();
}
