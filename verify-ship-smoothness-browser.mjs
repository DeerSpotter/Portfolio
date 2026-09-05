import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync('src/ship-overlay.js', 'utf8');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

for (const required of [
  'const positionLambda = 9.0 - coastAmount * 3.2 - timeFieldAmount * 1.4;',
  'const tangentLambda = 7.5 - coastAmount * 2.6 - timeFieldAmount * 1.3;',
  'const attitudeLambda = Math.max(3.4, 8.5 - coastAmount * 3.2 - timeFieldAmount * 1.2);',
  'const cameraLambda = Math.max(3.0, 5.2 - coastAmount * 1.15 - timeFieldAmount * 0.55);',
  'const BANK_DEADBAND = 0.035;',
  'const BANK_CENTER_EPSILON = 0.025;',
  'const BANK_MAX_ROLL_RATE = 2.2;',
  'const BANK_SEAM_RELEASE_PROGRESS = 0.04;',
  'const REDUCED_MOTION_BANK_SCALE = 0.62;',
  'turnSignal * 2.55 * coastCalm * bankMotionScale',
  'loopCycle !== observedLoopCycle',
  'bankSeamNeutralizing = true;',
  'seamDistance >= BANK_SEAM_RELEASE_PROGRESS',
  'requestedBankSide !== activeBankSide',
  "motionContract: 'known-good-flight-centered-bank-v3'",
]) {
  if (!source.includes(required)) throw new Error(`Centered-bank contract missing: ${required}`);
}

for (const forbidden of [
  'targetQuaternion',
  'maxAttitudeStep',
  'TANGENT_SAMPLE_WINDOW',
  'tangentBefore',
  'tangentAfter',
  'turnSignal * 2.55 - filteredVelocity * 0.26',
]) {
  if (source.includes(forbidden)) throw new Error(`Out-of-scope ship steering returned: ${forbidden}`);
}

async function exercise(viewport, label, reducedMotion = false) {
  const page = await browser.newPage({ viewport });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioShipDebug?.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);

  const initialContract = await page.evaluate(() => window.__portfolioShipDebug?.motionContract);
  if (initialContract !== 'known-good-flight-centered-bank-v3') {
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
          turnSignal: ship.bank.turnSignal,
          targetRoll: ship.bank.targetRoll,
          appliedTargetRoll: ship.bank.appliedTargetRoll,
          reducedMotionScale: ship.bank.reducedMotionScale,
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

  if (reducedMotion && !samples.some(sample => Math.abs(sample.reducedMotionScale - 0.62) < 0.001)) {
    throw new Error(`${label}: reduced-motion bank should remain active at reduced amplitude.`);
  }

  const positivePeak = Math.max(...samples.map(sample => sample.roll));
  const negativePeak = Math.min(...samples.map(sample => sample.roll));
  const minimumPeak = reducedMotion ? 0.035 : 0.06;
  if (positivePeak < minimumPeak || negativePeak > -minimumPeak) {
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

    if (Math.abs(current.targetRoll) > 0.04 && Math.abs(current.turnSignal) > 0.001) {
      if (Math.sign(current.targetRoll) !== Math.sign(current.turnSignal)) {
        throw new Error(`${label}: bank direction is not following signed route curvature: ${JSON.stringify(current)}`);
      }
    }

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

  const seam = await page.evaluate(async () => {
    const result = [];
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max);
    for (let frame = 0; frame < 18; frame++) await new Promise(requestAnimationFrame);

    const cycleBefore = window.__portfolioCanvasDebug.loopCycle;
    dispatchEvent(new WheelEvent('wheel', { deltaY: 1000, cancelable: true }));

    let cycleChanged = false;
    for (let frame = 0; frame < 30; frame++) {
      await new Promise(requestAnimationFrame);
      if (window.__portfolioCanvasDebug.loopCycle !== cycleBefore) {
        cycleChanged = true;
        break;
      }
    }

    for (let frame = 0; frame < 36; frame++) {
      await new Promise(requestAnimationFrame);
      const ship = window.__portfolioShipDebug;
      result.push({
        phase: 'seam',
        roll: ship.ship.roll,
        activeSide: ship.bank.activeSide,
        appliedTargetRoll: ship.bank.appliedTargetRoll,
        neutralizing: ship.bank.seamNeutralizing,
        seamDistance: ship.bank.seamDistance,
        loopCycle: ship.bank.loopCycle,
      });
    }

    scrollTo(0, max * 0.08);
    for (let frame = 0; frame < 100; frame++) {
      await new Promise(requestAnimationFrame);
      const ship = window.__portfolioShipDebug;
      result.push({
        phase: 'release',
        roll: ship.ship.roll,
        activeSide: ship.bank.activeSide,
        appliedTargetRoll: ship.bank.appliedTargetRoll,
        neutralizing: ship.bank.seamNeutralizing,
        seamDistance: ship.bank.seamDistance,
        loopCycle: ship.bank.loopCycle,
      });
      if (!ship.bank.seamNeutralizing && ship.bank.seamDistance >= 0.04) break;
    }

    return { cycleBefore, cycleChanged, result };
  });

  if (!seam.cycleChanged) throw new Error(`${label}: reloop did not change loopCycle.`);
  const seamFrames = seam.result.filter(sample => sample.phase === 'seam');
  const neutralFrames = seam.result.filter(sample => sample.neutralizing);
  if (neutralFrames.length < 2) {
    throw new Error(`${label}: bank-neutral reloop state was not exercised.`);
  }
  for (const sample of neutralFrames) {
    if (Math.abs(sample.appliedTargetRoll) > 0.000001 || sample.activeSide !== 0) {
      throw new Error(`${label}: reloop commanded a side bank instead of level: ${JSON.stringify(sample)}`);
    }
  }

  let maxSeamRollStep = 0;
  for (let index = 1; index < seamFrames.length; index++) {
    maxSeamRollStep = Math.max(maxSeamRollStep, Math.abs(seamFrames[index].roll - seamFrames[index - 1].roll));
  }
  if (maxSeamRollStep > 0.14) {
    throw new Error(`${label}: reloop still jolts roll: max seam roll step=${maxSeamRollStep}`);
  }

  const seamSigns = new Set(
    neutralFrames
      .filter(sample => Math.abs(sample.roll) > 0.02)
      .map(sample => Math.sign(sample.roll)),
  );
  if (seamSigns.size > 1) {
    throw new Error(`${label}: reloop rolls right and left while it should only return to center.`);
  }

  const release = seam.result.find(sample => !sample.neutralizing && sample.phase === 'release');
  if (!release) throw new Error(`${label}: bank never released after clearing the reloop seam.`);
  if (release.seamDistance < 0.04 || Math.abs(release.roll) > 0.04) {
    throw new Error(`${label}: bank released before it was level and clear of the seam: ${JSON.stringify(release)}`);
  }

  console.log(`[portfolio-ship-bank] ${label} PASS progress=${progressTravel.toFixed(3)} right=${positivePeak.toFixed(3)} left=${negativePeak.toFixed(3)} centerFrames=${centerGateFrames} transitions=${oppositeSideTransitions} maxRollStep=${maxRollStep.toFixed(4)} seamStep=${maxSeamRollStep.toFixed(4)}`);
  await page.close();
}

try {
  await exercise({ width: 1440, height: 900 }, 'desktop');
  await exercise({ width: 414, height: 896 }, 'mobile-reduced-motion', true);
  console.log('[portfolio-ship-bank] PASS');
  console.log('[portfolio-ship-bank] sequence=bank-right-center-bank-left-center');
  console.log('[portfolio-ship-bank] reloop=neutral-through-seam-before-resuming-bank');
  console.log('[portfolio-ship-bank] input=signed-route-curvature-only');
  console.log('[portfolio-ship-bank] scope=roll-only-known-good-flight-preserved');
} finally {
  await browser.close();
}
