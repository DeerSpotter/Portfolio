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
    const rearFlame = document.querySelector('.billboard-field-canvas-rear');
    const frontFlame = document.querySelector('.billboard-field-canvas-front');
    const canvasSnapshot = canvas => ({
      exists: Boolean(canvas),
      pointerEvents: canvas ? getComputedStyle(canvas).pointerEvents : null,
      zIndex: canvas ? Number.parseInt(getComputedStyle(canvas).zIndex, 10) : null,
      ariaHidden: canvas?.getAttribute('aria-hidden'),
      width: canvas?.width || 0,
      height: canvas?.height || 0,
    });
    return {
      billboard: structuredClone(window.__portfolioBillboardDebug),
      state: detail?.dataset.billboardState,
      interactive: detail?.dataset.interactive,
      pointerEvents: getComputedStyle(detail).pointerEvents,
      actionTabIndex: document.getElementById('detailAction')?.tabIndex,
      rearFlame: canvasSnapshot(rearFlame),
      frontFlame: canvasSnapshot(frontFlame),
      detailZIndex: Number.parseInt(getComputedStyle(detail).zIndex, 10),
    };
  });
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready, null, { timeout: 15000 });

  const distant = await moveTo(0.055);
  const approaching = await moveTo(0.100);
  const arming = await moveTo(0.150);
  const active = await moveTo(0.180);
  const passing = await moveTo(0.190);

  const samples = [distant, approaching, arming, active, passing];
  for (const sample of samples) {
    if (sample.billboard.stop !== 'Engineering') {
      throw new Error(`Expected Engineering billboard through pass, got ${sample.billboard.stop} in ${sample.billboard.state}.`);
    }
  }

  const expectedStates = ['distant', 'approaching', 'arming', 'active', 'passing'];
  samples.forEach((sample, index) => {
    if (sample.billboard.state !== expectedStates[index] || sample.state !== expectedStates[index]) {
      throw new Error(`Billboard state mismatch at stage ${index}: debug=${sample.billboard.state}, DOM=${sample.state}, expected=${expectedStates[index]}`);
    }
  });

  if (!(distant.billboard.scale < approaching.billboard.scale
    && approaching.billboard.scale < arming.billboard.scale
    && arming.billboard.scale < active.billboard.scale)) {
    throw new Error(`Billboard did not grow continuously: ${samples.slice(0, 4).map(s => s.billboard.scale.toFixed(3)).join(' -> ')}`);
  }

  const center = 720;
  const lateral = samples.slice(0, 4).map(sample => Math.abs(sample.billboard.x - center));
  if (!(lateral[0] < lateral[1] && lateral[1] < lateral[2] && lateral[2] < lateral[3])) {
    throw new Error(`Billboard did not move outward with approach parallax: ${lateral.map(v => v.toFixed(1)).join(' -> ')}`);
  }

  if (!(Math.abs(distant.billboard.yaw) > Math.abs(active.billboard.yaw))) {
    throw new Error(`Billboard plane did not open toward camera: far yaw=${distant.billboard.yaw}, active yaw=${active.billboard.yaw}`);
  }

  for (const sample of [distant, approaching]) {
    if (sample.billboard.interactive || sample.interactive !== 'false' || sample.actionTabIndex !== -1) {
      throw new Error(`Billboard became interactive too early in ${sample.billboard.state}.`);
    }
  }

  for (const sample of [arming, active]) {
    if (!sample.billboard.interactive || sample.interactive !== 'true' || sample.pointerEvents !== 'auto' || sample.actionTabIndex !== 0) {
      throw new Error(`Billboard was not interactive in near range (${sample.billboard.state}).`);
    }
  }

  if (passing.billboard.interactive || passing.interactive !== 'false' || passing.actionTabIndex !== -1) {
    throw new Error('Passing billboard remained interactive after the ship overtook it.');
  }

  for (const [label, layer] of [['rear', active.rearFlame], ['front', active.frontFlame]]) {
    if (!layer.exists || layer.ariaHidden !== 'true' || layer.width <= 0 || layer.height <= 0) {
      throw new Error(`${label} flame canvas is incomplete: exists=${layer.exists}, ariaHidden=${layer.ariaHidden}, size=${layer.width}x${layer.height}`);
    }
    if (layer.pointerEvents !== 'none') {
      throw new Error(`${label} flame canvas intercepts input: pointer-events=${layer.pointerEvents}`);
    }
  }

  if (!(active.rearFlame.zIndex < active.detailZIndex && active.detailZIndex < active.frontFlame.zIndex)) {
    throw new Error(`Flames must wrap the billboard in depth: rear z=${active.rearFlame.zIndex}, billboard z=${active.detailZIndex}, front z=${active.frontFlame.zIndex}`);
  }

  const flameStrengths = samples.map(sample => sample.billboard.fieldStrength);
  if (!(flameStrengths[0] < flameStrengths[1]
    && flameStrengths[1] < flameStrengths[2]
    && flameStrengths[2] < flameStrengths[3])) {
    throw new Error(`Flame intensity did not build with approach: ${flameStrengths.map(value => value.toFixed(3)).join(' -> ')}`);
  }
  if (!(passing.billboard.fieldStrength < active.billboard.fieldStrength
    && passing.billboard.fieldStrength > distant.billboard.fieldStrength)) {
    throw new Error(`Flame intensity did not fall after pass: active=${active.billboard.fieldStrength}, passing=${passing.billboard.fieldStrength}, distant=${distant.billboard.fieldStrength}`);
  }
  if (active.billboard.fieldContract !== 'procedural-orbital-instrument-v1'
    || active.billboard.fieldRenderer !== 'dual-canvas-turbulent-orbital-field') {
    throw new Error(`Flame debug contract mismatch: ${active.billboard.fieldContract}, renderer=${active.billboard.fieldRenderer}`);
  }
  if (!active.billboard.fieldFrontLayer || !active.billboard.fieldRearLayer) {
    throw new Error(`Billboard flame depth layers missing: front=${active.billboard.fieldFrontLayer}, rear=${active.billboard.fieldRearLayer}`);
  }
  if (!(active.billboard.rearFlameCount >= 18)) {
    throw new Error(`Active rear flame corona is incomplete: ${active.billboard.rearFlameCount}`);
  }
  if (!(active.billboard.frontFlameCount >= 10)) {
    throw new Error(`Active front flame corona is incomplete: ${active.billboard.frontFlameCount}`);
  }

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
  console.log(`[portfolio-billboard-browser] states=${expectedStates.join('->')}`);
  console.log(`[portfolio-billboard-browser] scale=${samples.map(s => s.billboard.scale.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] lateral=${lateral.map(v => v.toFixed(1)).join('->')}`);
  console.log(`[portfolio-billboard-browser] yaw=${distant.billboard.yaw.toFixed(1)}deg->${active.billboard.yaw.toFixed(1)}deg`);
  console.log('[portfolio-billboard-browser] interaction=near-range-only');
  console.log(`[portfolio-billboard-browser] flameStrength=${flameStrengths.map(value => value.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] turbulentVents=rear:${active.billboard.rearFlameCount},front:${active.billboard.frontFlameCount}`);
  console.log('[portfolio-billboard-browser] flameDefinition=continuous-noise-translucent-hot-core');
  console.log('[portfolio-billboard-browser] flameLayers=rear<billboard<front');
} finally {
  await browser.close();
}
