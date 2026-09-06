import { chromium } from 'playwright';

const baseUrl = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const url = new URL(baseUrl);
url.searchParams.set('prologue-test', '1');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function setProloguePhase(phase) {
  const accepted = await page.evaluate(value => window.__portfolioSetProloguePhaseForTest?.(value), phase);
  if (!accepted) throw new Error('Prologue debug phase override was unavailable.');
  await page.waitForFunction(value => {
    const debug = window.__portfolioEngineeringMissionDebug;
    return debug?.ready && Math.abs((debug.prologue?.phase ?? -1) - value) < 0.005;
  }, phase, { timeout: 2500 });
  await page.waitForTimeout(60);
  return page.evaluate(() => ({
    debug: structuredClone(window.__portfolioEngineeringMissionDebug),
    shipOpacity: document.getElementById('ship3d')?.style.opacity || '',
    overlayCount: document.querySelectorAll('#engineeringMissionThread').length,
    overlayZ: document.getElementById('engineeringMissionThread')?.style.zIndex || '',
    overlayPointerEvents: document.getElementById('engineeringMissionThread')?.style.pointerEvents || '',
    ship: structuredClone(window.__portfolioShipDebug),
  }));
}

async function sampleFlight(progress) {
  await page.evaluate(value => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * value);
  }, progress);
  await page.waitForFunction(target => {
    const canvas = window.__portfolioCanvasDebug;
    const story = window.__portfolioEngineeringMissionDebug;
    return canvas?.ready
      && story?.ready
      && story.storyStage === 'normal-flight'
      && Math.abs(canvas.progress - target) < 0.008;
  }, progress, { timeout: 3500 });
  await page.waitForTimeout(100);
  return page.evaluate(() => structuredClone(window.__portfolioEngineeringMissionDebug));
}

try {
  await page.goto(url.href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready
    && window.__portfolioShipDebug?.ready
    && window.__portfolioEngineeringMissionDebug?.ready
    && typeof window.__portfolioSetProloguePhaseForTest === 'function', null, { timeout: 15000 });

  const stages = [
    [0.10, 'common-operating-picture'],
    [0.25, 'select-platform'],
    [0.40, 'assign-route'],
    [0.54, 'review-task'],
    [0.67, 'execute-command'],
    [0.76, 'orbital-relay'],
    [0.86, 'launch'],
    [0.94, 'payload-separation'],
    [0.98, 'flight-handoff'],
  ];

  for (const [phase, expectedStage] of stages) {
    const sample = await setProloguePhase(phase);
    if (sample.overlayCount !== 1) throw new Error(`Loading/story canvas duplicated: ${sample.overlayCount}`);
    if (sample.debug.prologue.stage !== expectedStage) {
      throw new Error(`Prologue stage mismatch at ${phase}: expected=${expectedStage}, actual=${sample.debug.prologue.stage}`);
    }
    if (sample.debug.reparenting !== false || sample.debug.proprietaryUI !== false) {
      throw new Error(`Prologue violated isolation/public-concept boundary: ${JSON.stringify(sample.debug)}`);
    }
    if (sample.overlayZ !== '20' || sample.overlayPointerEvents !== 'auto') {
      throw new Error(`Loading sequence lost full-focus ownership at ${phase}: z=${sample.overlayZ}, pointerEvents=${sample.overlayPointerEvents}`);
    }
  }

  const software = await setProloguePhase(0.54);
  if (!software.debug.prologue.softwareFocused) {
    throw new Error(`Mission software was not full-focus during command review: ${JSON.stringify(software.debug.prologue)}`);
  }
  if (software.debug.loadingDurationMs < 14000) {
    throw new Error(`Loading timeline was shortened below the long-form command sequence: ${software.debug.loadingDurationMs}ms`);
  }

  const launch = await setProloguePhase(0.86);
  if (Number(launch.shipOpacity || 0) > 0.02) {
    throw new Error(`Live ship appeared before payload separation: opacity=${launch.shipOpacity}`);
  }

  const separation = await setProloguePhase(0.95);
  if (!separation.debug.prologue.payloadReleased) {
    throw new Error(`Payload was not marked released during separation: ${JSON.stringify(separation.debug.prologue)}`);
  }
  if (separation.debug.prologue.transitionTarget !== 'live-3d-ship-screen-position') {
    throw new Error(`Payload handoff lost the real ship projection target: ${separation.debug.prologue.transitionTarget}`);
  }
  if (!Number.isFinite(separation.ship.ship?.screenX) || !Number.isFinite(separation.ship.ship?.screenY)) {
    throw new Error(`3D ship screen projection unavailable for loading handoff: ${JSON.stringify(separation.ship.ship)}`);
  }

  const handoff = await setProloguePhase(0.98);
  if (!(Number(handoff.shipOpacity) > 0.08 && Number(handoff.shipOpacity) < 1)) {
    throw new Error(`Live ship did not fade in during loading handoff: opacity=${handoff.shipOpacity}`);
  }

  await setProloguePhase(1);
  await page.waitForFunction(() => window.__portfolioEngineeringMissionDebug?.storyStage === 'normal-flight');
  const complete = await page.evaluate(() => ({
    debug: structuredClone(window.__portfolioEngineeringMissionDebug),
    shipOpacity: document.getElementById('ship3d')?.style.opacity || '',
    zIndex: document.getElementById('engineeringMissionThread')?.style.zIndex || '',
    pointerEvents: document.getElementById('engineeringMissionThread')?.style.pointerEvents || '',
  }));
  if (complete.shipOpacity !== '') throw new Error(`Ship opacity override survived loading: ${complete.shipOpacity}`);
  if (complete.zIndex !== '1' || complete.pointerEvents !== 'none') {
    throw new Error(`Engineering canvas did not release full-focus loading ownership: z=${complete.zIndex}, pointerEvents=${complete.pointerEvents}`);
  }
  if (complete.debug.liveShipTransition !== 'normal-flight') {
    throw new Error(`Existing flight did not become the post-loading experience: ${complete.debug.liveShipTransition}`);
  }

  const sketchA = await sampleFlight(0.05);
  const sketchB = await sampleFlight(0.35);
  if (sketchA.sketchField.contract !== 'continuous-engineering-notebook-v1'
      || sketchB.sketchField.contract !== 'continuous-engineering-notebook-v1') {
    throw new Error('Persistent engineering notebook contract missing after loading.');
  }
  if (sketchA.sketchField.motifCount < 10 || sketchA.sketchField.visibleCount < 1 || sketchB.sketchField.visibleCount < 1) {
    throw new Error(`Engineering sketches are not distributed through the full flight: A=${JSON.stringify(sketchA.sketchField)}, B=${JSON.stringify(sketchB.sketchField)}`);
  }
  if (JSON.stringify(sketchA.sketchField.visible) === JSON.stringify(sketchB.sketchField.visible)) {
    throw new Error(`Engineering notebook did not evolve with scroll position: ${JSON.stringify(sketchA.sketchField.visible)}`);
  }
  if (sketchA.storyActive || sketchB.storyActive) {
    throw new Error('Old mid-scroll mission takeover remained active after moving the story into loading.');
  }

  console.log('[portfolio-engineering-mission] PASS');
  console.log('[portfolio-engineering-mission] loading=software->command->relay->launch->payload->live-ship');
  console.log('[portfolio-engineering-mission] flight=continuous-engineering-notebook');
} finally {
  await browser.close();
}
