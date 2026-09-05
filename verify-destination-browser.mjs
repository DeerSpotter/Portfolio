import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function moveDestinationPosition(position) {
  await page.evaluate(position => {
    const dialog = document.getElementById('destination');
    const track = dialog.querySelector('.destination-briefing-track');
    const viewport = Math.max(1, dialog.clientHeight);
    const start = track.offsetTop - viewport * 0.16;
    const travel = Math.max(1, track.offsetHeight - viewport * 0.84);
    const range = Number(track.dataset.flightRange);
    dialog.scrollTo({ top: start + travel * (position / range), behavior: 'instant' });
  }, position);
  await page.waitForFunction(expected => {
    const debug = window.__portfolioDestinationDebug;
    return debug?.ready && Math.abs(debug.flightPosition - expected) < 0.035;
  }, position, { timeout: 5000 });
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const active = document.querySelector('.destination-stage-panel[data-active="true"]');
    return {
      debug: structuredClone(window.__portfolioDestinationDebug),
      kicker: active?.querySelector('.destination-stage-kicker')?.textContent,
      title: active?.querySelector('.destination-stage-title')?.textContent,
      body: active?.querySelector('.destination-stage-body')?.textContent,
      counter: document.querySelector('.destination-stage-counter')?.textContent,
      visual: active?.querySelector('.destination-stage-visual')?.dataset.visual || null,
      panelCount: document.querySelectorAll('.destination-stage-panel').length,
      activeStageIndex: Number(active?.dataset.stageIndex),
      activeDistance: Number(active?.dataset.distance),
    };
  });
}

async function moveDestinationStage(stage) {
  const entryLead = await page.locator('.destination-briefing-track').evaluate(track => Number(track.dataset.entryLead));
  return moveDestinationPosition(stage + entryLead);
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready, null, { timeout: 15000 });

  const flightStructure = await page.evaluate(() => ({
    arrivalShell: Boolean(document.querySelector('.detail .arrival-panel-shell')),
    arrivalVisual: Boolean(document.querySelector('.detail .arrival-visual')),
    arrivalGhost: Boolean(document.querySelector('.detail .arrival-panel-ghost')),
    arrivalDebug: Boolean(window.__portfolioArrivalDebug),
    directHeading: document.querySelector('.detail > .detail-heading')?.id || 'present',
    directTitle: document.querySelector('.detail > #detailTitle')?.textContent || null,
  }));
  if (flightStructure.arrivalShell || flightStructure.arrivalVisual || flightStructure.arrivalGhost || flightStructure.arrivalDebug) {
    throw new Error(`Flight page still contains staged arrival structure: ${JSON.stringify(flightStructure)}`);
  }
  if (!flightStructure.directTitle) throw new Error('Flight billboard baseline structure was not restored.');

  await page.locator('[data-stop="1"]').click();
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Engineering');
  await page.locator('#detailAction').click();
  await page.waitForFunction(() => document.getElementById('destination')?.open && window.__portfolioDestinationDebug?.ready, null, { timeout: 5000 });

  const initial = await page.evaluate(() => ({
    debug: structuredClone(window.__portfolioDestinationDebug),
    panelCount: document.querySelectorAll('.destination-stage-panel').length,
    cloneArtifacts: document.querySelectorAll('.arrival-panel-ghost, .destination-content .brief-section, .destination-content .brief-intro').length,
    track: Boolean(document.querySelector('.destination-briefing-track')),
    exitLabel: document.querySelector('#destination .close-button')?.textContent.trim(),
  }));
  if (initial.debug.contract !== 'destination-flight-brief-v2'
      || initial.debug.section !== 'engineering'
      || initial.debug.stage !== 0
      || initial.debug.stages !== 4
      || initial.debug.reparenting !== false) {
    throw new Error(`Destination flight contract mismatch: ${JSON.stringify(initial.debug)}`);
  }
  if (!initial.track || initial.panelCount !== 2 || initial.cloneArtifacts !== 0) {
    throw new Error(`Destination fixed structure mismatch: ${JSON.stringify(initial)}`);
  }
  if (!initial.exitLabel?.startsWith('Exit now')) throw new Error(`Immediate fallback exit is not clearly secondary: ${initial.exitLabel}`);

  const farPose = initial.debug.poses.find(pose => pose.stage === 0);
  if (!farPose || !(farPose.scale < 0.9) || !(farPose.opacity < 0.7) || !(farPose.distance > 0.5)) {
    throw new Error(`First briefing did not begin in depth: ${JSON.stringify(farPose)}`);
  }

  const foundation = await moveDestinationStage(0);
  const nearPose = foundation.debug.poses.find(pose => pose.stage === 0);
  if (!nearPose || Math.abs(nearPose.scale - 1) > 0.03 || nearPose.opacity < 0.95 || Math.abs(nearPose.distance) > 0.04) {
    throw new Error(`First briefing did not fly into the reading plane: ${JSON.stringify(nearPose)}`);
  }
  if (!(nearPose.scale > farPose.scale) || !(nearPose.opacity > farPose.opacity)) {
    throw new Error(`Briefing did not grow toward the viewer: far=${JSON.stringify(farPose)}, near=${JSON.stringify(nearPose)}`);
  }

  const ngc = await moveDestinationStage(1);
  if (!ngc.kicker?.includes('NGC MTC') || !ngc.title?.includes('Lead the interfaces') || ngc.activeStageIndex !== 1) {
    throw new Error(`NGC MTC stage missing: ${JSON.stringify(ngc)}`);
  }

  const epirus = await moveDestinationStage(2);
  if (!epirus.kicker?.includes('Epirus') || !epirus.body?.includes('approximately five months') || epirus.activeStageIndex !== 2) {
    throw new Error(`Epirus stage missing: ${JSON.stringify(epirus)}`);
  }

  const concepts = await moveDestinationStage(3);
  if (!concepts.kicker?.includes('30 consecutive') || !concepts.body?.includes('30 consecutive project submissions') || concepts.visual !== 'readout') {
    throw new Error(`Concept leadership stage missing: ${JSON.stringify(concepts)}`);
  }
  if (concepts.counter !== 'Brief 04 / 04') throw new Error(`Destination progress did not reach final briefing: ${concepts.counter}`);

  const reverse = await moveDestinationStage(1);
  if (reverse.debug.stage !== 1 || !reverse.kicker?.includes('NGC MTC')) {
    throw new Error(`Reverse destination flight did not restore the earlier stage: ${JSON.stringify(reverse)}`);
  }
  if (reverse.panelCount !== 2) throw new Error(`Destination created transient panel copies: ${reverse.panelCount}`);

  await moveDestinationStage(3);
  const exitPosition = await page.evaluate(() => {
    const track = document.querySelector('.destination-briefing-track');
    const entryLead = Number(track.dataset.entryLead);
    return 3 + entryLead + 0.81;
  });
  await page.evaluate(position => {
    const dialog = document.getElementById('destination');
    const track = dialog.querySelector('.destination-briefing-track');
    const viewport = Math.max(1, dialog.clientHeight);
    const start = track.offsetTop - viewport * 0.16;
    const travel = Math.max(1, track.offsetHeight - viewport * 0.84);
    const range = Number(track.dataset.flightRange);
    dialog.scrollTo({ top: start + travel * (position / range), behavior: 'instant' });
  }, exitPosition);
  await page.waitForFunction(() => window.__portfolioDestinationDebug?.departure === true, null, { timeout: 5000 });
  await page.waitForFunction(() => !document.getElementById('destination')?.open, null, { timeout: 5000 });

  if (!await page.locator('#detailAction').evaluate(element => document.activeElement === element)) {
    throw new Error('Automatic destination departure did not restore focus to the flight card action.');
  }

  console.log('[portfolio-destination] PASS');
  console.log('[portfolio-destination] flightBillboard=baseline-no-staging');
  console.log('[portfolio-destination] structure=fixed-two-layer-no-reparenting');
  console.log('[portfolio-destination] motion=far->reading-plane->pass-viewer');
  console.log('[portfolio-destination] engineeringStages=foundation->NGC-MTC->Epirus->30-concepts');
  console.log('[portfolio-destination] reverseFlight=NGC-MTC');
  console.log('[portfolio-destination] exit=automatic-forward-departure');
} finally {
  await browser.close();
}
