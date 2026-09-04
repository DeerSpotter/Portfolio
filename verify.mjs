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
if (initial.shipAsset !== 'documented-procedural-stub') {
  throw new Error(`Unexpected ship asset contract: ${initial.shipAsset}`);
}

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.58));
await page.waitForTimeout(1100);
const middle = await page.evaluate(() => structuredClone(window.__portfolioDebug));

if (!(middle.progress > initial.progress + 0.35)) {
  throw new Error(`Scroll did not advance the world enough: ${initial.progress} -> ${middle.progress}`);
}
if (!(middle.ship.z < initial.ship.z - 150)) {
  throw new Error(`Ship did not travel through world space: z ${initial.ship.z} -> ${middle.ship.z}`);
}
if (Math.abs(middle.ship.roll) < 0.01 && Math.abs(middle.ship.pitch) < 0.01) {
  throw new Error('Ship attitude stayed flat; expected route-driven pitch or roll.');
}
if (!(middle.camera.z < initial.camera.z - 140)) {
  throw new Error(`Camera did not chase the ship: z ${initial.camera.z} -> ${middle.camera.z}`);
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
const returned = await page.evaluate(() => structuredClone(window.__portfolioDebug));
if (!(returned.progress < 0.08)) {
  throw new Error(`Reverse scrolling did not reconstruct the departure state: progress=${returned.progress}`);
}

if (browserErrors.length) {
  throw new Error(`Browser diagnostics:\n${browserErrors.join('\n')}`);
}

console.log('[portfolio-live3d] PASS');
console.log(`[portfolio-live3d] routeLength=${middle.routeLength.toFixed(2)}`);
console.log(`[portfolio-live3d] middleChapter=${middle.chapter}`);
console.log(`[portfolio-live3d] middleShip=(${middle.ship.x.toFixed(2)}, ${middle.ship.y.toFixed(2)}, ${middle.ship.z.toFixed(2)})`);
console.log(`[portfolio-live3d] middleAttitude=(${middle.ship.pitch.toFixed(3)}, ${middle.ship.yaw.toFixed(3)}, ${middle.ship.roll.toFixed(3)})`);

await browser.close();
