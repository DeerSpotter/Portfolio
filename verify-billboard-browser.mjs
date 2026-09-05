import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function moveTo(progress) {
  await page.evaluate(p => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * p);
  }, progress);
  await page.waitForFunction(p => Math.abs(window.__portfolioCanvasDebug?.progress - p) < 0.0045, progress, { timeout: 5000 });
  await page.waitForTimeout(240);
  return page.evaluate(() => {
    const detail = document.querySelector('.detail');
    const rearField = document.querySelector('.billboard-field-canvas-rear');
    const frontField = document.querySelector('.billboard-field-canvas-front');
    const canvasSnapshot = canvas => ({
      exists: Boolean(canvas),
      pointerEvents: canvas ? getComputedStyle(canvas).pointerEvents : null,
      zIndex: canvas ? Number.parseInt(getComputedStyle(canvas).zIndex, 10) : null,
      opacity: canvas ? Number.parseFloat(getComputedStyle(canvas).opacity) : null,
      ariaHidden: canvas?.getAttribute('aria-hidden'),
      width: canvas?.width || 0,
      height: canvas?.height || 0,
    });
    return {
      billboard: structuredClone(window.__portfolioBillboardDebug),
      state: detail?.dataset.billboardState,
      interactive: detail?.dataset.interactive,
      opacity: Number.parseFloat(getComputedStyle(detail).opacity),
      pointerEvents: getComputedStyle(detail).pointerEvents,
      actionTabIndex: document.getElementById('detailAction')?.tabIndex,
      rearField: canvasSnapshot(rearField),
      frontField: canvasSnapshot(frontField),
      detailZIndex: Number.parseInt(getComputedStyle(detail).zIndex, 10),
    };
  });
}

function assertSurfaceOpacity(sample, label) {
  for (const [surface, opacity] of [
    ['HTML pane', sample.opacity],
    ['rear field', sample.rearField.opacity],
    ['front field', sample.frontField.opacity],
  ]) {
    if (Math.abs(opacity - sample.billboard.alpha) > 0.02) {
      throw new Error(`${label}: ${surface} did not share projected alpha: rendered=${opacity}, projected=${sample.billboard.alpha}`);
    }
  }
}

function assertSideFade(samples, label, expectedSide) {
  for (const sample of samples) {
    if (sample.billboard.state !== 'passing') {
      throw new Error(`${label}: expected passing state during side fade, got ${sample.billboard.state}.`);
    }
    if (Math.sign(sample.billboard.side) !== expectedSide) {
      throw new Error(`${label}: pane changed assigned side during exit: side=${sample.billboard.side}`);
    }
    assertSurfaceOpacity(sample, label);
  }

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    const lateralTravel = (current.billboard.x - previous.billboard.x) * expectedSide;
    if (lateralTravel <= 0) {
      throw new Error(`${label}: pane did not continue outward: ${previous.billboard.x} -> ${current.billboard.x}`);
    }
    if (!(current.billboard.alpha < previous.billboard.alpha)) {
      throw new Error(`${label}: pane did not fade continuously: ${previous.billboard.alpha} -> ${current.billboard.alpha}`);
    }
    if (!(current.billboard.exitProgress > previous.billboard.exitProgress)) {
      throw new Error(`${label}: exit progress did not advance: ${previous.billboard.exitProgress} -> ${current.billboard.exitProgress}`);
    }
  }

  const late = samples.at(-1);
  if (late.billboard.alpha > 0.14) {
    throw new Error(`${label}: pane remained too visible at end of exit: alpha=${late.billboard.alpha}`);
  }
}

function assertLifecycle(samples, expectedStop, label) {
  const expectedStates = ['approaching', 'arming', 'active', 'passing'];
  samples.forEach((sample, index) => {
    if (sample.billboard.stop !== expectedStop) {
      throw new Error(`${label}: expected ${expectedStop}, got ${sample.billboard.stop} in ${sample.billboard.state}.`);
    }
    if (sample.billboard.state !== expectedStates[index] || sample.state !== expectedStates[index]) {
      throw new Error(`${label}: lifecycle mismatch at ${index}: debug=${sample.billboard.state}, DOM=${sample.state}, expected=${expectedStates[index]}`);
    }
  });

  const [approaching, arming, active, passing] = samples;
  if (!(approaching.billboard.scale < arming.billboard.scale
    && arming.billboard.scale < active.billboard.scale)) {
    throw new Error(`${label}: pane did not grow continuously toward reading plane: ${samples.slice(0, 3).map(s => s.billboard.scale.toFixed(3)).join(' -> ')}`);
  }

  const center = 720;
  const lateral = samples.slice(0, 3).map(sample => Math.abs(sample.billboard.x - center));
  if (!(lateral[0] < lateral[1] && lateral[1] < lateral[2])) {
    throw new Error(`${label}: pane did not move outward with approach parallax: ${lateral.map(v => v.toFixed(1)).join(' -> ')}`);
  }

  if (!(Math.abs(approaching.billboard.yaw) > Math.abs(active.billboard.yaw))) {
    throw new Error(`${label}: pane plane did not open toward camera: approaching yaw=${approaching.billboard.yaw}, active yaw=${active.billboard.yaw}`);
  }

  if (approaching.billboard.interactive || approaching.interactive !== 'false' || approaching.actionTabIndex !== -1) {
    throw new Error(`${label}: pane became interactive too early while approaching.`);
  }
  for (const sample of [arming, active]) {
    if (!sample.billboard.interactive || sample.interactive !== 'true' || sample.pointerEvents !== 'auto' || sample.actionTabIndex !== 0) {
      throw new Error(`${label}: pane was not interactive in near range (${sample.billboard.state}).`);
    }
  }
  if (passing.billboard.interactive || passing.interactive !== 'false' || passing.actionTabIndex !== -1) {
    throw new Error(`${label}: passing pane remained interactive after ship overtook it.`);
  }

  for (const [layerLabel, layer] of [['rear', active.rearField], ['front', active.frontField]]) {
    if (!layer.exists || layer.ariaHidden !== 'true' || layer.width <= 0 || layer.height <= 0) {
      throw new Error(`${label}: ${layerLabel} field canvas incomplete: exists=${layer.exists}, ariaHidden=${layer.ariaHidden}, size=${layer.width}x${layer.height}`);
    }
    if (layer.pointerEvents !== 'none') {
      throw new Error(`${label}: ${layerLabel} field intercepts input: pointer-events=${layer.pointerEvents}`);
    }
  }
  if (!(active.rearField.zIndex < active.detailZIndex && active.detailZIndex < active.frontField.zIndex)) {
    throw new Error(`${label}: field layers must wrap pane in depth: rear=${active.rearField.zIndex}, pane=${active.detailZIndex}, front=${active.frontField.zIndex}`);
  }

  const fieldStrengths = samples.map(sample => sample.billboard.fieldStrength);
  if (!(fieldStrengths[0] < fieldStrengths[1]
    && fieldStrengths[1] < fieldStrengths[2]
    && passing.billboard.fieldStrength < active.billboard.fieldStrength)) {
    throw new Error(`${label}: orbital field intensity did not follow approach/pass lifecycle: ${fieldStrengths.map(value => value.toFixed(3)).join(' -> ')}`);
  }
  if (active.billboard.fieldContract !== 'procedural-orbital-instrument-v1'
    || active.billboard.fieldRenderer !== 'dual-canvas-turbulent-orbital-field') {
    throw new Error(`${label}: field debug contract mismatch: ${active.billboard.fieldContract}, renderer=${active.billboard.fieldRenderer}`);
  }
  if (!active.billboard.fieldFrontLayer || !active.billboard.fieldRearLayer) {
    throw new Error(`${label}: field depth layers missing.`);
  }
  if (active.billboard.rearFlameCount < 18 || active.billboard.frontFlameCount < 10) {
    throw new Error(`${label}: active field corona incomplete: rear=${active.billboard.rearFlameCount}, front=${active.billboard.frontFlameCount}`);
  }

  return { lateral, fieldStrengths };
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready, null, { timeout: 15000 });

  // Traverse forward only. The outgoing Start here pane is allowed to finish
  // its new side-fade before Engineering becomes the current pane.
  const engineeringApproaching = await moveTo(0.110);
  const engineeringArming = await moveTo(0.145);
  const engineeringActive = await moveTo(0.178);
  const engineeringPassing = await moveTo(0.190);
  const engineeringExitMid = await moveTo(0.215);
  const engineeringExitLate = await moveTo(0.238);

  const engineering = assertLifecycle(
    [engineeringApproaching, engineeringArming, engineeringActive, engineeringPassing],
    'Engineering',
    'Engineering lifecycle',
  );
  assertSideFade(
    [engineeringPassing, engineeringExitMid, engineeringExitLate],
    'left-side Engineering exit',
    -1,
  );

  // Continue forward into Vault. This proves the same choreography in the
  // opposite direction without resetting or jumping backward through the loop.
  const vaultApproaching = await moveTo(0.270);
  const vaultArming = await moveTo(0.305);
  const vaultActive = await moveTo(0.338);
  const vaultPassing = await moveTo(0.350);
  const vaultExitMid = await moveTo(0.375);
  const vaultExitLate = await moveTo(0.398);

  const vault = assertLifecycle(
    [vaultApproaching, vaultArming, vaultActive, vaultPassing],
    'Vault automation',
    'Vault lifecycle',
  );
  assertSideFade(
    [vaultPassing, vaultExitMid, vaultExitLate],
    'right-side Vault exit',
    1,
  );

  const orbit = await page.evaluate(() => ({
    background: window.__portfolioCanvasDebug.orbitalBackground,
    billboard: window.__portfolioBillboardDebug,
  }));
  if (orbit.background?.systems !== 3 || orbit.background.beltRocks < 126) {
    throw new Error(`Background planetary systems missing: ${JSON.stringify(orbit.background)}`);
  }
  if (orbit.billboard.moonCount < 2 || orbit.billboard.asteroidCount !== 84) {
    throw new Error(`Billboard orbital objects missing: ${JSON.stringify(orbit.billboard)}`);
  }

  console.log('[portfolio-billboard-browser] PASS');
  console.log('[portfolio-billboard-browser] traversal=forward-only');
  console.log('[portfolio-billboard-browser] states=approaching->arming->active->passing');
  console.log(`[portfolio-billboard-browser] engineeringLateral=${engineering.lateral.map(v => v.toFixed(1)).join('->')}`);
  console.log(`[portfolio-billboard-browser] vaultLateral=${vault.lateral.map(v => v.toFixed(1)).join('->')}`);
  console.log(`[portfolio-billboard-browser] engineeringField=${engineering.fieldStrengths.map(v => v.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] vaultField=${vault.fieldStrengths.map(v => v.toFixed(3)).join('->')}`);
  console.log('[portfolio-billboard-browser] paneExit=left->left-fade,right->right-fade');
  console.log('[portfolio-billboard-browser] flameLayers=rear<pane<front');
} finally {
  await browser.close();
}
