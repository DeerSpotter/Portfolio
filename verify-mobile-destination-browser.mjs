import fs from 'node:fs';
import { chromium } from 'playwright';

const mobileCss = fs.readFileSync('src/mobile.css', 'utf8');
const destinationCss = fs.readFileSync('src/destination.css', 'utf8');
const destinationUi = fs.readFileSync('src/destination-ui.js', 'utf8');
for (const required of [
  '(hover: none) and (pointer: coarse)',
]) {
  if (!mobileCss.includes(required)) throw new Error(`Mobile CSS zoom contract missing: ${required}`);
  if (!destinationCss.includes(required)) throw new Error(`Destination CSS zoom contract missing: ${required}`);
}
for (const required of [
  "matchMedia('(hover: none) and (pointer: coarse)').matches",
  "visualViewport?.addEventListener('resize', scheduleFlightSync",
  "visualViewport?.addEventListener('scroll', scheduleFlightSync",
  "contract: 'destination-flight-brief-v3'",
]) {
  if (!destinationUi.includes(required)) throw new Error(`Destination zoom contract missing: ${required}`);
}

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

async function openEngineeringDestination(page) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready,
    null,
    { timeout: 15000 },
  );
  await page.locator('[data-stop="1"]').click();
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Engineering');
  await page.locator('#detailAction').click();
  await page.waitForFunction(
    () => document.getElementById('destination')?.open && window.__portfolioDestinationDebug?.ready,
    null,
    { timeout: 5000 },
  );
}

async function moveToPosition(page, position) {
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
    return debug?.ready && Math.abs(debug.flightPosition - expected) < 0.04;
  }, position, { timeout: 5000 });
  await page.waitForTimeout(100);
}

async function inspectStageZero(page) {
  return page.evaluate(() => {
    const debug = structuredClone(window.__portfolioDestinationDebug);
    const pose = debug.poses.find(item => item.stage === 0) || null;
    const panel = [...document.querySelectorAll('.destination-stage-panel')]
      .find(item => Number(item.dataset.stageIndex) === 0);
    const style = panel ? getComputedStyle(panel) : null;
    const rect = panel?.getBoundingClientRect() || null;
    const body = panel?.querySelector('.destination-stage-body');
    return {
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      coarseTouch: matchMedia('(hover: none) and (pointer: coarse)').matches,
      viewport: { width: innerWidth, height: innerHeight },
      pose,
      transform: style?.transform || null,
      filter: style?.filter || null,
      opacity: style ? Number(style.opacity) : null,
      bodyFont: body ? Number.parseFloat(getComputedStyle(body).fontSize) : null,
      rect: rect ? { width: rect.width, height: rect.height, x: rect.x, y: rect.y } : null,
      debug,
    };
  });
}

function assertFarPose(sample, label) {
  if (!sample.reducedMotion) throw new Error(`${label}: Reduce Motion emulation is not active.`);
  if (!sample.pose) throw new Error(`${label}: stage 0 pose was not published: ${JSON.stringify(sample.debug)}`);
  if (!(sample.pose.distance > 0.5)) throw new Error(`${label}: first card did not begin in depth: ${JSON.stringify(sample.pose)}`);
  if (!(sample.pose.scale < 0.9)) throw new Error(`${label}: first card was not visually smaller in depth: ${JSON.stringify(sample.pose)}`);
  if (!(sample.pose.opacity < 0.8)) throw new Error(`${label}: first card did not fade with depth: ${JSON.stringify(sample.pose)}`);
  if (!sample.transform || sample.transform === 'none') {
    throw new Error(`${label}: CSS flattened the destination depth transform under Reduce Motion.`);
  }
  if (sample.debug.contract !== 'destination-flight-brief-v3') {
    throw new Error(`${label}: destination controller is not using the zoom-stable contract: ${sample.debug.contract}`);
  }
}

function assertNearPose(far, near, label) {
  if (!near.pose) throw new Error(`${label}: stage 0 reading pose disappeared.`);
  if (Math.abs(near.pose.distance) > 0.05) throw new Error(`${label}: card did not reach reading plane: ${JSON.stringify(near.pose)}`);
  if (Math.abs(near.pose.scale - 1) > 0.04) throw new Error(`${label}: reading plane scale is wrong: ${JSON.stringify(near.pose)}`);
  if (near.pose.opacity < 0.95) throw new Error(`${label}: reading plane is not fully visible: ${JSON.stringify(near.pose)}`);
  if (!(near.pose.scale > far.pose.scale + 0.1)) {
    throw new Error(`${label}: card did not grow toward the viewer: far=${JSON.stringify(far.pose)} near=${JSON.stringify(near.pose)}`);
  }
  if (!near.transform || near.transform === 'none') {
    throw new Error(`${label}: reading plane lost its projected transform.`);
  }
}

async function verifyViewport(viewport, label, pageOptions = {}) {
  const page = await browser.newPage({ viewport, ...pageOptions });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await openEngineeringDestination(page);
    const far = await inspectStageZero(page);
    assertFarPose(far, label);

    const entryLead = await page.locator('.destination-briefing-track').evaluate(track => Number(track.dataset.entryLead));
    await moveToPosition(page, entryLead);
    const near = await inspectStageZero(page);
    assertNearPose(far, near, label);

    await moveToPosition(page, entryLead + 0.58);
    const passing = await inspectStageZero(page);
    if (!passing.pose || !(passing.pose.scale > near.pose.scale)) {
      throw new Error(`${label}: card did not continue past the viewer: ${JSON.stringify(passing.pose)}`);
    }

    console.log(`[portfolio-mobile-destination] ${label}=PASS`);
    return { far, near, passing };
  } finally {
    await page.close();
  }
}

try {
  await verifyViewport({ width: 414, height: 896 }, '414x896 reduced-motion portrait');
  await verifyViewport({ width: 844, height: 390 }, '844x390 reduced-motion landscape');

  // Safari Page Zoom changes the effective CSS viewport. A zoomed-out iPhone
  // can therefore report a width larger than the old 800px mobile breakpoint
  // while it is still unequivocally a coarse touch device. Preserve the same
  // mobile layout and destination depth contract in that state.
  const zoomExpanded = await verifyViewport(
    { width: 860, height: 1600 },
    '860x1600 zoom-expanded touch portrait',
    { hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  );
  if (!zoomExpanded.far.coarseTouch || !zoomExpanded.far.debug.mobileDepthMotion) {
    throw new Error(`Zoom-expanded touch viewport fell back to desktop motion: ${JSON.stringify(zoomExpanded.far)}`);
  }
  if (!(zoomExpanded.far.bodyFont < 13)) {
    throw new Error(`Zoom-expanded touch viewport fell out of compact mobile CSS: bodyFont=${zoomExpanded.far.bodyFont}px.`);
  }

  console.log('[portfolio-mobile-destination] motion=far->reading-plane->pass-viewer');
  console.log('[portfolio-mobile-destination] reduced-motion=navigation-depth-preserved');
  console.log('[portfolio-mobile-destination] page-zoom=coarse-touch-contract-preserved');
} finally {
  await browser.close();
}
