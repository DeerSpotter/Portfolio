import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function sampleAt(progress) {
  await page.evaluate(value => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * value);
  }, progress);
  await page.waitForFunction(target => {
    const canvas = window.__portfolioCanvasDebug;
    const story = window.__portfolioEngineeringMissionDebug;
    return canvas?.ready
      && story?.ready
      && Math.abs(canvas.progress - target) < 0.008;
  }, progress, { timeout: 3500 });
  await page.waitForTimeout(100);
  return page.evaluate(() => ({
    debug: structuredClone(window.__portfolioEngineeringMissionDebug),
    shipOpacity: document.getElementById('ship3d')?.style.opacity || '',
    overlayCount: document.querySelectorAll('#engineeringMissionThread').length,
    launchCanvasCount: document.querySelectorAll('#engineeringLaunch3d').length,
    overlayZ: document.getElementById('engineeringMissionThread')?.style.zIndex || '',
    overlayPointerEvents: document.getElementById('engineeringMissionThread')?.style.pointerEvents || '',
  }));
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready
    && window.__portfolioShipDebug?.ready
    && window.__portfolioEngineeringMissionDebug?.ready, null, { timeout: 15000 });

  const baseline = await sampleAt(0.05);
  if (baseline.overlayCount !== 1) throw new Error(`Engineering overlay duplicated: ${baseline.overlayCount}`);
  if (baseline.launchCanvasCount !== 0) throw new Error(`Launch canvas survived the rollback: ${baseline.launchCanvasCount}`);
  if (baseline.overlayZ !== '1' || baseline.overlayPointerEvents !== 'none') {
    throw new Error(`Engineering layer unexpectedly owns input: z=${baseline.overlayZ}, pointerEvents=${baseline.overlayPointerEvents}`);
  }
  if (baseline.shipOpacity !== '') throw new Error(`Engineering layer overrides the live ship opacity: ${baseline.shipOpacity}`);
  if (baseline.debug.loadingPrologue || baseline.debug.loadingInputBlocked) {
    throw new Error(`Loading sequence survived the rollback: ${JSON.stringify(baseline.debug)}`);
  }
  if (baseline.debug.commandSequence || baseline.debug.satelliteSequence || baseline.debug.rocketSequence) {
    throw new Error(`Removed mission/space sequence is still enabled: ${JSON.stringify(baseline.debug)}`);
  }

  const stages = [
    [0.130, 'sketch'],
    [0.165, 'block'],
    [0.205, 'part'],
    [0.240, 'motor'],
    [0.285, 'drone'],
  ];

  for (const [progress, expectedStage] of stages) {
    const sample = await sampleAt(progress);
    const transform = sample.debug.transform;
    if (!transform?.active || transform.stage !== expectedStage) {
      throw new Error(`Sketch-to-drone stage mismatch at ${progress}: expected=${expectedStage}, actual=${JSON.stringify(transform)}`);
    }
    if (transform.contract !== 'engineering-sketch-to-drone-v2' || transform.terminalStage !== 'drone') {
      throw new Error(`Sketch-to-drone contract changed: ${JSON.stringify(transform)}`);
    }
    if (sample.debug.storyArc !== 'sketch-to-drone-only') {
      throw new Error(`Engineering story expanded beyond the requested sequence: ${sample.debug.storyArc}`);
    }
    if (sample.debug.commandSequence || sample.debug.satelliteSequence || sample.debug.rocketSequence || sample.debug.loadingPrologue) {
      throw new Error(`Removed sequence returned during ${expectedStage}: ${JSON.stringify(sample.debug)}`);
    }
    if (sample.launchCanvasCount !== 0 || sample.shipOpacity !== '') {
      throw new Error(`Sketch-to-drone sequence interfered with flight at ${expectedStage}: launch=${sample.launchCanvasCount}, shipOpacity=${sample.shipOpacity}`);
    }
    if (sample.debug.reparenting !== false || sample.debug.proprietaryUI !== false) {
      throw new Error(`Engineering sequence violated isolation/public-concept boundary: ${JSON.stringify(sample.debug)}`);
    }
  }

  const after = await sampleAt(0.34);
  if (after.debug.transform?.active || after.debug.storyStage !== 'normal-flight') {
    throw new Error(`Sketch-to-drone sequence did not release back to normal flight: ${JSON.stringify(after.debug)}`);
  }

  const sketchA = baseline.debug;
  const sketchB = after.debug;
  if (sketchA.sketchField.contract !== 'continuous-engineering-notebook-v1'
      || sketchB.sketchField.contract !== 'continuous-engineering-notebook-v1') {
    throw new Error('Persistent engineering notebook contract is missing.');
  }
  if (sketchA.sketchField.motifCount < 10 || sketchA.sketchField.visibleCount < 1 || sketchB.sketchField.visibleCount < 1) {
    throw new Error(`Engineering sketches are not distributed through flight: A=${JSON.stringify(sketchA.sketchField)}, B=${JSON.stringify(sketchB.sketchField)}`);
  }
  if (JSON.stringify(sketchA.sketchField.visible) === JSON.stringify(sketchB.sketchField.visible)) {
    throw new Error(`Engineering notebook did not evolve with scroll position: ${JSON.stringify(sketchA.sketchField.visible)}`);
  }

  console.log('[portfolio-engineering-mission] PASS');
  console.log('[portfolio-engineering-mission] sequence=sketch->block->part->motor->drone');
  console.log('[portfolio-engineering-mission] removed=loading,command,satellites,rocket');
  console.log('[portfolio-engineering-mission] flight=continuous-engineering-notebook');
} finally {
  await browser.close();
}
