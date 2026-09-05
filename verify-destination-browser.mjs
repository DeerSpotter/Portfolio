import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function moveDestinationStage(stage, total = 4) {
  await page.evaluate(({ stage, total }) => {
    const dialog = document.getElementById('destination');
    const track = dialog.querySelector('.destination-briefing-track');
    const viewport = Math.max(1, dialog.clientHeight);
    const start = track.offsetTop - viewport * 0.28;
    const travel = Math.max(1, track.offsetHeight - viewport * 0.72);
    const progress = (stage + 0.5) / total;
    dialog.scrollTo({ top: start + travel * progress, behavior: 'instant' });
  }, { stage, total });
  await page.waitForFunction(expected => window.__portfolioDestinationDebug?.stage === expected, stage, { timeout: 5000 });
  await page.waitForTimeout(280);
  return page.evaluate(() => ({
    debug: structuredClone(window.__portfolioDestinationDebug),
    kicker: document.querySelector('.destination-stage-panel[data-active="true"] .destination-stage-kicker')?.textContent,
    title: document.querySelector('.destination-stage-panel[data-active="true"] .destination-stage-title')?.textContent,
    body: document.querySelector('.destination-stage-panel[data-active="true"] .destination-stage-body')?.textContent,
    counter: document.querySelector('.destination-stage-counter')?.textContent,
    visual: document.querySelector('.destination-stage-panel[data-active="true"] .destination-stage-visual')?.dataset.visual || null,
    panelCount: document.querySelectorAll('.destination-stage-panel').length,
  }));
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
  }));
  if (initial.debug.contract !== 'destination-scroll-brief-v1'
      || initial.debug.section !== 'engineering'
      || initial.debug.stage !== 0
      || initial.debug.stages !== 4
      || initial.debug.reparenting !== false) {
    throw new Error(`Destination briefing contract mismatch: ${JSON.stringify(initial.debug)}`);
  }
  if (!initial.track || initial.panelCount !== 2 || initial.cloneArtifacts !== 0) {
    throw new Error(`Destination fixed structure mismatch: ${JSON.stringify(initial)}`);
  }

  const ngc = await moveDestinationStage(1);
  if (!ngc.kicker?.includes('NGC MTC') || !ngc.title?.includes('Lead the interfaces')) {
    throw new Error(`NGC MTC stage missing: ${JSON.stringify(ngc)}`);
  }

  const epirus = await moveDestinationStage(2);
  if (!epirus.kicker?.includes('Epirus') || !epirus.body?.includes('approximately five months')) {
    throw new Error(`Epirus stage missing: ${JSON.stringify(epirus)}`);
  }

  const concepts = await moveDestinationStage(3);
  if (!concepts.kicker?.includes('30 consecutive') || !concepts.body?.includes('30 consecutive project submissions') || concepts.visual !== 'readout') {
    throw new Error(`Concept leadership stage missing: ${JSON.stringify(concepts)}`);
  }
  if (concepts.counter !== 'Brief 04 / 04') throw new Error(`Destination progress did not reach final briefing: ${concepts.counter}`);

  const reverse = await moveDestinationStage(1);
  if (reverse.debug.stage !== 1 || !reverse.kicker?.includes('NGC MTC')) {
    throw new Error(`Reverse destination scroll did not restore the earlier stage: ${JSON.stringify(reverse)}`);
  }
  if (reverse.panelCount !== 2) throw new Error(`Destination created transient panel copies: ${reverse.panelCount}`);

  await page.keyboard.press('Escape');
  if (await page.locator('#destination').evaluate(dialog => dialog.open)) throw new Error('Destination did not close.');
  if (!await page.locator('#detailAction').evaluate(element => document.activeElement === element)) {
    throw new Error('Destination close did not restore focus to the flight card action.');
  }

  console.log('[portfolio-destination] PASS');
  console.log('[portfolio-destination] flightBillboard=baseline-no-staging');
  console.log('[portfolio-destination] structure=fixed-two-layer-no-reparenting');
  console.log('[portfolio-destination] engineeringStages=foundation->NGC-MTC->Epirus->30-concepts');
  console.log('[portfolio-destination] reverseScroll=NGC-MTC');
} finally {
  await browser.close();
}
