import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const browserErrors = [];
function captureErrors(targetPage, label) {
  targetPage.on('pageerror', error => browserErrors.push(`${label} pageerror: ${error.message}`));
  targetPage.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`${label} console: ${message.text()}`);
  });
}
captureErrors(page, 'default');

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForFunction(() => window.__portfolioDebug?.ready === true, null, { timeout: 15000 });

const initial = await page.evaluate(() => structuredClone(window.__portfolioDebug));
if (initial.shipAsset !== 'documented-procedural-stub-v2') {
  throw new Error(`Unexpected ship asset contract: ${initial.shipAsset}`);
}
if (!initial.surrealEffects?.includes('energy-ribbons')) {
  throw new Error('Surreal background/effect contract was not initialized.');
}
if (!initial.performance?.qualityTier) {
  throw new Error('Adaptive performance state was not initialized.');
}
if (!(initial.performance.obstacleDrawBatches <= 3)) {
  throw new Error(`Asteroid field regressed to too many draw batches: ${initial.performance.obstacleDrawBatches}`);
}

await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.58));
await page.waitForTimeout(1200);
const middle = await page.evaluate(() => structuredClone(window.__portfolioDebug));

if (!(middle.travel > initial.travel + 0.35)) {
  throw new Error(`Scroll did not advance the world enough: ${initial.travel} -> ${middle.travel}`);
}
const shipDisplacement = Math.hypot(
  middle.ship.x - initial.ship.x,
  middle.ship.y - initial.ship.y,
  middle.ship.z - initial.ship.z,
);
if (!(shipDisplacement > 80)) {
  throw new Error(`Ship did not travel through enough 3D world space: displacement=${shipDisplacement.toFixed(2)}`);
}
if (Math.abs(middle.ship.roll) < 0.01 && Math.abs(middle.ship.pitch) < 0.01) {
  throw new Error('Ship attitude stayed flat; expected route-driven pitch or roll.');
}
const cameraDisplacement = Math.hypot(
  middle.camera.x - initial.camera.x,
  middle.camera.y - initial.camera.y,
  middle.camera.z - initial.camera.z,
);
if (!(cameraDisplacement > 70)) {
  throw new Error(`Camera did not chase the ship through world space: displacement=${cameraDisplacement.toFixed(2)}`);
}

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(800);
const beforeLoop = await page.evaluate(() => structuredClone(window.__portfolioDebug));
await page.mouse.move(900, 450);
await page.mouse.wheel(0, 1000);
await page.waitForTimeout(1000);
const afterLoop = await page.evaluate(() => structuredClone(window.__portfolioDebug));

if (!(afterLoop.loopCycle >= beforeLoop.loopCycle + 1)) {
  throw new Error(`Forward end did not recycle into the next loop: ${beforeLoop.loopCycle} -> ${afterLoop.loopCycle}`);
}
if (!(afterLoop.travel > beforeLoop.travel - 0.08)) {
  throw new Error(`Loop recycling caused virtual travel to jump backward: ${beforeLoop.travel} -> ${afterLoop.travel}`);
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
const beforeReverseLoop = await page.evaluate(() => structuredClone(window.__portfolioDebug));
await page.mouse.wheel(0, -1000);
await page.waitForTimeout(900);
const afterReverseLoop = await page.evaluate(() => structuredClone(window.__portfolioDebug));
if (!(afterReverseLoop.loopCycle <= beforeReverseLoop.loopCycle - 1)) {
  throw new Error(`Reverse end did not recycle into the previous loop: ${beforeReverseLoop.loopCycle} -> ${afterReverseLoop.loopCycle}`);
}

// Force the lowest tier on a high-DPI viewport. This proves the fallback is a
// real supported path rather than an untested device-detection branch.
const lowUrl = new URL(url);
lowUrl.searchParams.set('quality', 'low');
const lowPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
captureErrors(lowPage, 'low-quality');
await lowPage.goto(lowUrl.toString(), { waitUntil: 'networkidle', timeout: 30000 });
await lowPage.waitForFunction(() => window.__portfolioDebug?.ready === true, null, { timeout: 15000 });
const lowInitial = await lowPage.evaluate(() => structuredClone(window.__portfolioDebug));

if (lowInitial.performance.qualityTier !== 'low' || !lowInitial.performance.forcedQuality) {
  throw new Error(`Forced low-quality mode did not engage: ${JSON.stringify(lowInitial.performance)}`);
}
if (lowInitial.performance.pixelRatio > 0.86) {
  throw new Error(`Low-quality pixel ratio cap was exceeded: ${lowInitial.performance.pixelRatio}`);
}
if (lowInitial.performance.obstacleDrawBatches > 3) {
  throw new Error(`Low-quality obstacle batching regressed: ${lowInitial.performance.obstacleDrawBatches}`);
}

await lowPage.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.42));
await lowPage.waitForTimeout(1100);
const lowMoved = await lowPage.evaluate(() => structuredClone(window.__portfolioDebug));
if (!(lowMoved.travel > lowInitial.travel + 0.25)) {
  throw new Error(`Low-quality mode did not preserve scroll-driven flight: ${lowInitial.travel} -> ${lowMoved.travel}`);
}
await lowPage.close();

if (browserErrors.length) {
  throw new Error(`Browser diagnostics:\n${browserErrors.join('\n')}`);
}

console.log('[portfolio-live3d] PASS');
console.log(`[portfolio-live3d] routeLength=${middle.routeLength.toFixed(2)}`);
console.log(`[portfolio-live3d] defaultQuality=${initial.performance.qualityTier} pixelRatio=${initial.performance.pixelRatio.toFixed(2)}`);
console.log(`[portfolio-live3d] lowQualityPixelRatio=${lowInitial.performance.pixelRatio.toFixed(2)}`);
console.log(`[portfolio-live3d] asteroidDrawBatches=${initial.performance.obstacleDrawBatches}`);
console.log(`[portfolio-live3d] middleChapter=${middle.chapter}`);
console.log(`[portfolio-live3d] middleShip=(${middle.ship.x.toFixed(2)}, ${middle.ship.y.toFixed(2)}, ${middle.ship.z.toFixed(2)})`);
console.log(`[portfolio-live3d] middleAttitude=(${middle.ship.pitch.toFixed(3)}, ${middle.ship.yaw.toFixed(3)}, ${middle.ship.roll.toFixed(3)})`);
console.log(`[portfolio-live3d] forwardLoop=${beforeLoop.loopCycle}->${afterLoop.loopCycle}`);
console.log(`[portfolio-live3d] reverseLoop=${beforeReverseLoop.loopCycle}->${afterReverseLoop.loopCycle}`);

await browser.close();
