import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const browserErrors = [];
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForFunction(() => window.__portfolioDebug?.ready === true, null, { timeout: 15000 });

const initial = await page.evaluate(() => structuredClone(window.__portfolioDebug));
if (initial.shipAsset !== 'documented-procedural-stub-v2') {
  throw new Error(`Unexpected ship asset contract: ${initial.shipAsset}`);
}
if (!initial.surrealEffects?.includes('energy-ribbons')) {
  throw new Error('Surreal background/effect contract was not initialized.');
}
if (initial.performance?.qualityTier !== 'medium') {
  throw new Error(`Unknown visitors must start from conservative medium quality, got ${initial.performance?.qualityTier}`);
}
if (initial.performance?.obstacleDrawBatches > 3) {
  throw new Error(`Asteroid field regressed above three draw batches: ${initial.performance?.obstacleDrawBatches}`);
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

const lowPage = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const lowErrors = [];
lowPage.on('pageerror', error => lowErrors.push(`pageerror: ${error.message}`));
lowPage.on('console', message => {
  if (message.type() === 'error') lowErrors.push(`console: ${message.text()}`);
});
await lowPage.goto(`${url}?quality=low`, { waitUntil: 'networkidle', timeout: 30000 });
await lowPage.waitForFunction(() => window.__portfolioDebug?.ready === true, null, { timeout: 15000 });
const low = await lowPage.evaluate(() => structuredClone(window.__portfolioDebug));
if (low.performance?.qualityTier !== 'low') {
  throw new Error(`Forced low-quality path did not initialize as low: ${low.performance?.qualityTier}`);
}
if (low.performance?.pixelRatio > 0.86) {
  throw new Error(`Low-quality DPR cap regressed: ${low.performance?.pixelRatio}`);
}
if (low.performance?.obstacleDrawBatches > 3) {
  throw new Error(`Low-quality asteroid field regressed above three draw batches: ${low.performance?.obstacleDrawBatches}`);
}
if (lowErrors.length) {
  throw new Error(`Low-quality browser diagnostics:\n${lowErrors.join('\n')}`);
}

if (browserErrors.length) {
  throw new Error(`Browser diagnostics:\n${browserErrors.join('\n')}`);
}

console.log('[portfolio-live3d] PASS');
console.log(`[portfolio-live3d] autoQuality=${initial.performance.qualityTier}`);
console.log(`[portfolio-live3d] routeLength=${middle.routeLength.toFixed(2)}`);
console.log(`[portfolio-live3d] middleChapter=${middle.chapter}`);
console.log(`[portfolio-live3d] middleShip=(${middle.ship.x.toFixed(2)}, ${middle.ship.y.toFixed(2)}, ${middle.ship.z.toFixed(2)})`);
console.log(`[portfolio-live3d] middleAttitude=(${middle.ship.pitch.toFixed(3)}, ${middle.ship.yaw.toFixed(3)}, ${middle.ship.roll.toFixed(3)})`);
console.log(`[portfolio-live3d] forwardLoop=${beforeLoop.loopCycle}->${afterLoop.loopCycle}`);
console.log(`[portfolio-live3d] reverseLoop=${beforeReverseLoop.loopCycle}->${afterReverseLoop.loopCycle}`);
console.log(`[portfolio-live3d] lowDpr=${low.performance.pixelRatio.toFixed(2)}`);
console.log(`[portfolio-live3d] lowObstacleBatches=${low.performance.obstacleDrawBatches}`);

await lowPage.close();
await browser.close();
