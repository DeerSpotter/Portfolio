import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function sampleAt(targetPage, progress) {
  await targetPage.evaluate(value => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * value);
  }, progress);
  await targetPage.waitForFunction(target => {
    const canvas = window.__portfolioCanvasDebug;
    const story = window.__portfolioEngineeringMissionDebug;
    return canvas?.ready
      && story?.ready
      && Math.abs(canvas.progress - target) < 0.008;
  }, progress, { timeout: 3500 });
  await targetPage.waitForTimeout(100);
  return targetPage.evaluate(() => ({
    debug: structuredClone(window.__portfolioEngineeringMissionDebug),
    shipOpacity: document.getElementById('ship3d')?.style.opacity || '',
    overlayCount: document.querySelectorAll('#engineeringMissionThread').length,
    launchCanvasCount: document.querySelectorAll('#engineeringLaunch3d').length,
    overlayZ: document.getElementById('engineeringMissionThread')?.style.zIndex || '',
    overlayPointerEvents: document.getElementById('engineeringMissionThread')?.style.pointerEvents || '',
  }));
}

function assertMobileTransformSuppressed(sample, expectedSourceStage, label) {
  if (!sample.debug.mobileTransformSuppressed) {
    throw new Error(`${label}: focused engineering transform was not marked suppressed: ${JSON.stringify(sample.debug)}`);
  }
  if (sample.debug.focusedTransformPolicy !== 'desktop-only') {
    throw new Error(`${label}: focused transform policy changed: ${sample.debug.focusedTransformPolicy}`);
  }
  if (sample.debug.transform?.active || sample.debug.storyActive) {
    throw new Error(`${label}: focused engineering animation is still active on mobile: ${JSON.stringify(sample.debug.transform)}`);
  }
  if (sample.debug.transformPlacement !== 'mobile-suppressed' || sample.debug.transformOffsetX !== 0) {
    throw new Error(`${label}: mobile transform retained desktop placement: placement=${sample.debug.transformPlacement}, offset=${sample.debug.transformOffsetX}`);
  }
  if (sample.debug.transform?.stage !== 'mobile-suppressed' || !sample.debug.transform?.suppressed) {
    throw new Error(`${label}: mobile transform did not publish the suppression state: ${JSON.stringify(sample.debug.transform)}`);
  }
  if (expectedSourceStage && sample.debug.transform?.sourceStage !== expectedSourceStage) {
    throw new Error(`${label}: wrong underlying stage while suppressed: expected=${expectedSourceStage}, actual=${sample.debug.transform?.sourceStage}`);
  }
}

async function verifyMobileSuppression(viewport, label) {
  const mobilePage = await browser.newPage({
    viewport,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });

  try {
    await mobilePage.goto(url, { waitUntil: 'load', timeout: 30000 });
    await mobilePage.waitForFunction(() => window.__portfolioCanvasDebug?.ready
      && window.__portfolioShipDebug?.ready
      && window.__portfolioEngineeringMissionDebug?.ready, null, { timeout: 15000 });

    const sketch = await sampleAt(mobilePage, 0.130);
    assertMobileTransformSuppressed(sketch, 'sketch', `${label} sketch`);

    const drone = await sampleAt(mobilePage, 0.285);
    assertMobileTransformSuppressed(drone, 'drone', `${label} drone`);

    if (!drone.debug.coarseTouch && viewport.width > 720) {
      throw new Error(`${label}: expanded mobile viewport is not exercising the coarse-touch suppression path.`);
    }

    await mobilePage.locator('[data-stop="1"]').click();
    await mobilePage.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Engineering');
    await mobilePage.locator('#detailAction').click();
    await mobilePage.waitForFunction(
      () => document.getElementById('destination')?.open && window.__portfolioDestinationDebug?.ready,
      null,
      { timeout: 5000 },
    );
    await mobilePage.waitForTimeout(150);

    const insideDestination = await mobilePage.evaluate(() => ({
      destinationOpen: Boolean(document.getElementById('destination')?.open),
      debug: structuredClone(window.__portfolioEngineeringMissionDebug),
    }));
    if (!insideDestination.destinationOpen) throw new Error(`${label}: destination did not stay open.`);
    assertMobileTransformSuppressed({ debug: insideDestination.debug }, null, `${label} destination`);

    console.log(`[portfolio-engineering-mission] ${label}=mobile-transform-suppressed`);
  } finally {
    await mobilePage.close();
  }
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready
    && window.__portfolioShipDebug?.ready
    && window.__portfolioEngineeringMissionDebug?.ready, null, { timeout: 15000 });

  const baseline = await sampleAt(page, 0.05);
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
  if (baseline.debug.mobileTransformSuppressed) {
    throw new Error(`Desktop unexpectedly suppressed the focused engineering transform: ${JSON.stringify(baseline.debug)}`);
  }

  const stages = [
    [0.130, 'sketch'],
    [0.165, 'block'],
    [0.205, 'part'],
    [0.240, 'motor'],
    [0.285, 'drone'],
  ];

  for (const [progress, expectedStage] of stages) {
    const sample = await sampleAt(page, progress);
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

    const powered = expectedStage === 'motor' || expectedStage === 'drone';
    const expectedPlacement = powered ? 'left-motor-drone' : 'right-pre-motor';
    if (sample.debug.transformPlacement !== expectedPlacement) {
      throw new Error(`Engineering placement mismatch at ${expectedStage}: expected=${expectedPlacement}, actual=${sample.debug.transformPlacement}`);
    }
    if (!powered && sample.debug.transformOffsetX !== 0) {
      throw new Error(`Pre-motor engineering work did not stay on the right-side baseline: stage=${expectedStage}, offset=${sample.debug.transformOffsetX}`);
    }
    if (powered && !(sample.debug.transformOffsetX < -300)) {
      throw new Error(`Motor/drone did not move to the left: stage=${expectedStage}, offset=${sample.debug.transformOffsetX}`);
    }
  }

  const after = await sampleAt(page, 0.34);
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

  await verifyMobileSuppression({ width: 414, height: 896 }, '414x896 touch portrait');
  await verifyMobileSuppression({ width: 844, height: 390 }, '844x390 touch landscape');

  console.log('[portfolio-engineering-mission] PASS');
  console.log('[portfolio-engineering-mission] desktop=right(sketch->block->part)->left(motor->drone)');
  console.log('[portfolio-engineering-mission] mobile=focused-transform-hidden-before-and-inside-destination');
  console.log('[portfolio-engineering-mission] removed=loading,command,satellites,rocket');
  console.log('[portfolio-engineering-mission] flight=continuous-engineering-notebook');
} finally {
  await browser.close();
}
