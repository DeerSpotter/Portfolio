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
await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready === true, null, { timeout: 15000 });

const initial = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));
if (initial.engine !== 'canvas-2d') throw new Error(`Unexpected rendering engine: ${initial.engine}`);
if (initial.movement !== 'forward-chase-perspective') {
  throw new Error(`Canvas prototype lost the forward chase movement contract: ${initial.movement}`);
}
if (initial.palette !== 'fox-paper-earth') {
  throw new Error(`Canvas prototype lost the fox/paper palette contract: ${initial.palette}`);
}

const external3d = await page.evaluate(() => Boolean(document.querySelector('script[src*="three"], script[src*="jsdelivr"]')));
if (external3d) throw new Error('Canvas prototype unexpectedly depends on the prior Three.js/CDN path.');

await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, max * 0.34);
});
await page.waitForTimeout(1900);
const automation = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));

if (!(automation.progress > 0.28 && automation.progress < 0.40)) {
  throw new Error(`Canvas flight did not advance to Automation region: progress=${automation.progress}`);
}
if (automation.trailMode !== 'orbit' || automation.activeStop !== 'Automation') {
  throw new Error(`Trail did not settle into Automation orbit: mode=${automation.trailMode}, stop=${automation.activeStop}`);
}

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(500);
const beforeLoop = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));
await page.mouse.wheel(0, 1000);
await page.waitForTimeout(700);
const afterLoop = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));
if (!(afterLoop.loopCycle >= beforeLoop.loopCycle + 1)) {
  throw new Error(`Forward loop did not recycle: ${beforeLoop.loopCycle} -> ${afterLoop.loopCycle}`);
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const beforeReverse = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));
await page.mouse.wheel(0, -1000);
await page.waitForTimeout(700);
const afterReverse = await page.evaluate(() => structuredClone(window.__portfolioCanvasDebug));
if (!(afterReverse.loopCycle <= beforeReverse.loopCycle - 1)) {
  throw new Error(`Reverse loop did not recycle: ${beforeReverse.loopCycle} -> ${afterReverse.loopCycle}`);
}

if (browserErrors.length) throw new Error(`Browser diagnostics:\n${browserErrors.join('\n')}`);

console.log('[portfolio-canvas] PASS');
console.log(`[portfolio-canvas] movement=${initial.movement}`);
console.log(`[portfolio-canvas] palette=${initial.palette}`);
console.log(`[portfolio-canvas] automationStop=${automation.activeStop}`);
console.log(`[portfolio-canvas] trailMode=${automation.trailMode}`);
console.log(`[portfolio-canvas] renderScale=${automation.renderScale.toFixed(2)}`);
console.log(`[portfolio-canvas] forwardLoop=${beforeLoop.loopCycle}->${afterLoop.loopCycle}`);
console.log(`[portfolio-canvas] reverseLoop=${beforeReverse.loopCycle}->${afterReverse.loopCycle}`);

await browser.close();
