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
await page.waitForFunction(() => window.__portfolioShipDebug?.ready === true, null, { timeout: 15000 });

const initial = await page.evaluate(() => ({
  canvas: structuredClone(window.__portfolioCanvasDebug),
  ship: structuredClone(window.__portfolioShipDebug),
  worldCanvas: Boolean(document.getElementById('world')),
  shipCanvas: Boolean(document.getElementById('ship3d')),
}));

// The illustrated world remains the exact Canvas 2D renderer and art direction.
if (initial.canvas.engine !== 'canvas-2d') throw new Error(`Background renderer changed unexpectedly: ${initial.canvas.engine}`);
if (initial.canvas.movement !== 'forward-chase-perspective') {
  throw new Error(`Canvas prototype lost the forward chase movement contract: ${initial.canvas.movement}`);
}
if (initial.canvas.palette !== 'fox-paper-earth') {
  throw new Error(`Canvas prototype lost the fox/paper palette contract: ${initial.canvas.palette}`);
}
if (!initial.worldCanvas || !initial.shipCanvas) throw new Error('Hybrid renderer is missing one of its two canvas layers.');

// Only the ship is 3D, and it must use the original live3d third-person chase
// contract rather than the later orthographic/top-down overlay experiment.
if (initial.ship.engine !== 'three-overlay') throw new Error(`Unexpected ship renderer: ${initial.ship.engine}`);
if (initial.ship.model !== 'documented-procedural-stub-v2') {
  throw new Error(`Unexpected 3D ship model: ${initial.ship.model}`);
}
if (initial.ship.flightContract !== 'original-live3d-third-person-chase') {
  throw new Error(`Original chase flight contract was not restored: ${initial.ship.flightContract}`);
}
if (initial.ship.cameraType !== 'perspective') {
  throw new Error(`Ship camera must be perspective, not top-down/orthographic: ${initial.ship.cameraType}`);
}
if (initial.ship.backgroundRenderer !== 'canvas-2d') {
  throw new Error(`3D ship is not layered over the Canvas 2D world: ${initial.ship.backgroundRenderer}`);
}
if (initial.ship.rendered3dWorldItems.length !== 0) {
  throw new Error(`Old 3D world items were reintroduced: ${initial.ship.rendered3dWorldItems.join(', ')}`);
}
if (initial.canvas.shipRenderer !== 'original-live3d-third-person-chase') {
  throw new Error(`Canvas expects the wrong ship renderer: ${initial.canvas.shipRenderer}`);
}

const startShip = initial.ship.ship;
const startCamera = initial.ship.camera;

await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, max * 0.34);
});
await page.waitForTimeout(1900);
const automation = await page.evaluate(() => ({
  canvas: structuredClone(window.__portfolioCanvasDebug),
  ship: structuredClone(window.__portfolioShipDebug),
}));

if (!(automation.canvas.progress > 0.28 && automation.canvas.progress < 0.40)) {
  throw new Error(`Canvas flight did not advance to Automation region: progress=${automation.canvas.progress}`);
}
if (automation.canvas.trailMode !== 'orbit' || automation.canvas.activeStop !== 'Automation') {
  throw new Error(`Trail did not settle into Automation orbit: mode=${automation.canvas.trailMode}, stop=${automation.canvas.activeStop}`);
}
if (Math.abs(automation.ship.progress - automation.canvas.progress) > 0.01) {
  throw new Error(`3D ship lost synchronization with the canvas: ship=${automation.ship.progress}, canvas=${automation.canvas.progress}`);
}

const shipMoved = Math.hypot(
  automation.ship.ship.x - startShip.x,
  automation.ship.ship.y - startShip.y,
  automation.ship.ship.z - startShip.z,
);
const cameraMoved = Math.hypot(
  automation.ship.camera.x - startCamera.x,
  automation.ship.camera.y - startCamera.y,
  automation.ship.camera.z - startCamera.z,
);
if (shipMoved < 20) throw new Error(`3D ship did not travel through the original 3D route: displacement=${shipMoved}`);
if (cameraMoved < 20) throw new Error(`Perspective chase camera did not follow the ship: displacement=${cameraMoved}`);
if (Math.abs(automation.ship.ship.roll) < 0.01 && Math.abs(automation.ship.ship.pitch) < 0.01) {
  throw new Error('3D ship attitude remained flat; original banking/pitch behavior is missing.');
}
if (automation.ship.camera.fov < 47.9) {
  throw new Error(`Unexpected chase camera FOV: ${automation.ship.camera.fov}`);
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
console.log(`[portfolio-canvas] background=${initial.canvas.engine}`);
console.log(`[portfolio-canvas] ship=${initial.ship.model}`);
console.log(`[portfolio-canvas] flight=${initial.ship.flightContract}`);
console.log(`[portfolio-canvas] camera=${initial.ship.cameraType}`);
console.log(`[portfolio-canvas] 3dWorldItems=${initial.ship.rendered3dWorldItems.length}`);
console.log(`[portfolio-canvas] palette=${initial.canvas.palette}`);
console.log(`[portfolio-canvas] automationStop=${automation.canvas.activeStop}`);
console.log(`[portfolio-canvas] trailMode=${automation.canvas.trailMode}`);
console.log(`[portfolio-canvas] shipDisplacement=${shipMoved.toFixed(2)}`);
console.log(`[portfolio-canvas] cameraDisplacement=${cameraMoved.toFixed(2)}`);
console.log(`[portfolio-canvas] forwardLoop=${beforeLoop.loopCycle}->${afterLoop.loopCycle}`);
console.log(`[portfolio-canvas] reverseLoop=${beforeReverse.loopCycle}->${afterReverse.loopCycle}`);

await browser.close();
