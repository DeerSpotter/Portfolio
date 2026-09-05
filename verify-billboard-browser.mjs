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
  await page.waitForTimeout(180);
  return page.evaluate(() => {
    const detail = document.querySelector('.detail');
    const smoke = document.querySelector('.billboard-smoke-canvas');
    return {
      billboard: structuredClone(window.__portfolioBillboardDebug),
      state: detail?.dataset.billboardState,
      interactive: detail?.dataset.interactive,
      pointerEvents: getComputedStyle(detail).pointerEvents,
      actionTabIndex: document.getElementById('detailAction')?.tabIndex,
      smoke: {
        exists: Boolean(smoke),
        pointerEvents: smoke ? getComputedStyle(smoke).pointerEvents : null,
        zIndex: smoke ? Number.parseInt(getComputedStyle(smoke).zIndex, 10) : null,
        ariaHidden: smoke?.getAttribute('aria-hidden'),
        width: smoke?.width || 0,
        height: smoke?.height || 0,
      },
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

  if (active.billboard.side * 0.66 >= 0) {
    throw new Error(`Engineering billboard is not opposite its positive-side artwork: billboard side=${active.billboard.side}`);
  }

  if (!active.smoke.exists || active.smoke.ariaHidden !== 'true' || active.smoke.width <= 0 || active.smoke.height <= 0) {
    throw new Error(`Smoke canvas is incomplete: exists=${active.smoke.exists}, ariaHidden=${active.smoke.ariaHidden}, size=${active.smoke.width}x${active.smoke.height}`);
  }
  if (active.smoke.pointerEvents !== 'none') {
    throw new Error(`Smoke atmosphere intercepts input: pointer-events=${active.smoke.pointerEvents}`);
  }
  if (!(active.smoke.zIndex < active.detailZIndex)) {
    throw new Error(`Smoke must render behind billboard text: smoke z=${active.smoke.zIndex}, billboard z=${active.detailZIndex}`);
  }

  const smokeStrengths = samples.map(sample => sample.billboard.smokeStrength);
  if (!(smokeStrengths[0] < smokeStrengths[1]
    && smokeStrengths[1] < smokeStrengths[2]
    && smokeStrengths[2] < smokeStrengths[3])) {
    throw new Error(`Smoke did not strengthen with approach: ${smokeStrengths.map(value => value.toFixed(3)).join(' -> ')}`);
  }
  if (!(passing.billboard.smokeStrength < active.billboard.smokeStrength
    && passing.billboard.smokeStrength > distant.billboard.smokeStrength)) {
    throw new Error(`Smoke did not thin naturally after pass: active=${active.billboard.smokeStrength}, passing=${passing.billboard.smokeStrength}, distant=${distant.billboard.smokeStrength}`);
  }
  if (active.billboard.smokeContract !== 'canvas2d-charcoal-wisp-smoke-v2'
    || active.billboard.smokeRenderer !== 'canvas-2d-particle-wisps') {
    throw new Error(`Smoke debug contract mismatch: ${active.billboard.smokeContract}, renderer=${active.billboard.smokeRenderer}`);
  }
  if (!(active.billboard.smokeParticleCount > 0)) {
    throw new Error(`Active JavaScript smoke emitted no particles: ${active.billboard.smokeParticleCount}`);
  }

  console.log('[portfolio-billboard-browser] PASS');
  console.log(`[portfolio-billboard-browser] states=${expectedStates.join('->')}`);
  console.log(`[portfolio-billboard-browser] scale=${samples.map(s => s.billboard.scale.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] lateral=${lateral.map(v => v.toFixed(1)).join('->')}`);
  console.log(`[portfolio-billboard-browser] yaw=${distant.billboard.yaw.toFixed(1)}deg->${active.billboard.yaw.toFixed(1)}deg`);
  console.log('[portfolio-billboard-browser] interaction=near-range-only');
  console.log(`[portfolio-billboard-browser] smokeStrength=${smokeStrengths.map(value => value.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] smokeParticlesActive=${active.billboard.smokeParticleCount}`);
  console.log('[portfolio-billboard-browser] smoke=canvas2d-directional-charcoal-wisps-behind-card');
} finally {
  await browser.close();
}
