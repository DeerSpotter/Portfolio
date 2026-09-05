import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => (
    window.__portfolioCanvasDebug?.ready
    && window.__portfolioBillboardDebug?.ready
    && window.__portfolioShipDebug?.ready
    && window.__portfolioTimePocketDebug?.ready
  ), null, { timeout: 15000 });

  await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * 0.18);
  });
  await page.waitForFunction(() => Math.abs(window.__portfolioCanvasDebug.progress - 0.18) < 0.005, null, { timeout: 5000 });

  await page.waitForFunction(() => (
    window.__portfolioTimePocketDebug?.mode === 'time-pocket'
    && window.__portfolioTimePocketDebug?.coastStrength > 0.5
    && window.__portfolioTimePocketDebug?.timeFieldStrength > 0.70
    && window.__portfolioTimePocketDebug?.lockedStop === 'Engineering'
  ), null, { timeout: 3000 });

  const start = await page.evaluate(() => ({
    y: scrollY,
    progress: window.__portfolioCanvasDebug.progress,
    pocket: structuredClone(window.__portfolioTimePocketDebug),
    billboard: structuredClone(window.__portfolioBillboardDebug),
    ship: structuredClone(window.__portfolioShipDebug),
    heading: document.getElementById('detailTitle').textContent,
    current: document.querySelector('[data-stop][aria-current="step"]')?.dataset.stop,
    flightMode: document.body.dataset.flightMode,
    worldFilter: getComputedStyle(document.getElementById('world')).filter,
  }));

  await page.waitForTimeout(900);

  const coast = await page.evaluate(() => ({
    y: scrollY,
    progress: window.__portfolioCanvasDebug.progress,
    pocket: structuredClone(window.__portfolioTimePocketDebug),
    billboard: structuredClone(window.__portfolioBillboardDebug),
    ship: structuredClone(window.__portfolioShipDebug),
    heading: document.getElementById('detailTitle').textContent,
    current: document.querySelector('[data-stop][aria-current="step"]')?.dataset.stop,
    flightMode: document.body.dataset.flightMode,
    worldFilter: getComputedStyle(document.getElementById('world')).filter,
  }));

  const driftPx = coast.y - start.y;
  const driftProgress = coast.progress - start.progress;
  const shipDrift = Math.hypot(
    coast.ship.ship.x - start.ship.ship.x,
    coast.ship.ship.y - start.ship.ship.y,
    coast.ship.ship.z - start.ship.ship.z,
  );

  if (!(driftPx > 1.5 && driftPx < 15)) {
    throw new Error(`Time field did not produce a slow forward pass: ${driftPx.toFixed(2)}px in 900ms.`);
  }
  if (!(driftProgress > 0 && driftProgress < 0.006)) {
    throw new Error(`Time field progress was not a slow forward crawl: ${driftProgress}.`);
  }
  if (!(shipDrift > 0.02)) {
    throw new Error(`Ship visually froze during time dilation: displacement=${shipDrift}.`);
  }
  if (coast.pocket.lockedStop !== 'Engineering' || coast.billboard.stop !== 'Engineering') {
    throw new Error(`Focus changed during slow pass: pocket=${coast.pocket.lockedStop}, billboard=${coast.billboard.stop}.`);
  }
  if (coast.current !== '1') {
    throw new Error(`Waypoint navigation lost the Engineering latch: current=${coast.current}.`);
  }
  if (start.heading !== coast.heading) {
    throw new Error('Billboard text changed while the stop was latched.');
  }
  if (!coast.billboard.interactive || coast.billboard.state !== 'active') {
    throw new Error(`Slow-pass billboard is not clickable: state=${coast.billboard.state}, interactive=${coast.billboard.interactive}.`);
  }
  if (!(coast.pocket.timeFieldStrength > 0.70)) {
    throw new Error(`Stop proximity did not engage the time field strongly enough: ${coast.pocket.timeFieldStrength}.`);
  }
  if (!(coast.pocket.coastRatePxPerSecond >= 4.4 && coast.pocket.coastRatePxPerSecond < 8)) {
    throw new Error(`Near-stop coast rate did not dilate enough: ${coast.pocket.coastRatePxPerSecond}px/s.`);
  }
  if (!(coast.billboard.timeFieldStrength > 0.65)) {
    throw new Error(`Billboard did not receive time-field proximity: ${coast.billboard.timeFieldStrength}.`);
  }
  if (!(coast.ship.coastAmount > 0.45) || !(coast.ship.timeFieldAmount > 0.45) || coast.ship.engineState !== 'idle-drift') {
    throw new Error(`Ship did not enter smoothed animated idle thrust: coast=${coast.ship.coastAmount}, field=${coast.ship.timeFieldAmount}, state=${coast.ship.engineState}.`);
  }
  if (coast.flightMode !== 'time-pocket') {
    throw new Error(`DOM did not enter time-pocket focus mode: ${coast.flightMode}.`);
  }
  if (coast.worldFilter === 'none') {
    throw new Error('Artwork remained at full visual intensity during the interaction window.');
  }

  // A deliberate backwards waypoint jump must replace the latch immediately.
  // The old stop must not flash while the destination settles.
  await page.locator('[data-stop="0"]').click();
  await page.waitForFunction(() => (
    window.__portfolioTimePocketDebug?.lockedStop === 'Start here'
    && window.__portfolioBillboardDebug?.stop === 'Start here'
    && document.querySelector('[data-stop="0"]')?.getAttribute('aria-current') === 'step'
  ), null, { timeout: 3000 });

  const reverseJump = await page.evaluate(() => ({
    locked: window.__portfolioTimePocketDebug.lockedStop,
    billboard: window.__portfolioBillboardDebug.stop,
    current: document.querySelector('[data-stop][aria-current="step"]')?.dataset.stop,
  }));
  if (reverseJump.locked !== 'Start here' || reverseJump.billboard !== 'Start here' || reverseJump.current !== '0') {
    throw new Error(`Backward waypoint jump retained stale focus: ${JSON.stringify(reverseJump)}`);
  }

  // Return to Engineering, then prove real wheel input exits slow motion.
  await page.locator('[data-stop="1"]').click();
  await page.waitForFunction(() => window.__portfolioTimePocketDebug?.lockedStop === 'Engineering', null, { timeout: 3000 });
  await page.waitForFunction(() => window.__portfolioTimePocketDebug?.mode === 'time-pocket', null, { timeout: 3000 });
  await page.mouse.wheel(0, 600);
  await page.waitForFunction(() => (
    window.__portfolioTimePocketDebug?.mode === 'flight'
    && document.body.dataset.flightMode === 'flight'
  ), null, { timeout: 1000 });
  const resumed = await page.evaluate(() => ({
    pocket: structuredClone(window.__portfolioTimePocketDebug),
    ship: structuredClone(window.__portfolioShipDebug),
    flightMode: document.body.dataset.flightMode,
  }));
  if (resumed.pocket.mode !== 'flight' || resumed.flightMode !== 'flight') {
    throw new Error('User input did not release the time-dilation field.');
  }

  console.log('[portfolio-time-pocket-browser] PASS');
  console.log(`[portfolio-time-pocket-browser] coast=${driftPx.toFixed(2)}px/900ms`);
  console.log(`[portfolio-time-pocket-browser] rate=${coast.pocket.coastRatePxPerSecond.toFixed(2)}px/s`);
  console.log(`[portfolio-time-pocket-browser] field=${coast.pocket.timeFieldStrength.toFixed(3)}`);
  console.log(`[portfolio-time-pocket-browser] progress=${driftProgress.toFixed(5)}`);
  console.log(`[portfolio-time-pocket-browser] shipDrift=${shipDrift.toFixed(3)}`);
  console.log('[portfolio-time-pocket-browser] focus=Engineering-latched');
  console.log('[portfolio-time-pocket-browser] reverseJump=immediate-reacquire');
  console.log('[portfolio-time-pocket-browser] artwork=quieted-not-hidden');
  console.log('[portfolio-time-pocket-browser] interaction=active-during-slow-pass');
  console.log('[portfolio-time-pocket-browser] engine=idle-drift-animated');
  console.log('[portfolio-time-pocket-browser] resume=user-wheel-releases-pocket');
} finally {
  await browser.close();
}
