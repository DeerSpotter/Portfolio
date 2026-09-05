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
  await page.waitForTimeout(120);
  return page.evaluate(() => ({
    billboard: structuredClone(window.__portfolioBillboardDebug),
    state: document.querySelector('.detail')?.dataset.billboardState,
    interactive: document.querySelector('.detail')?.dataset.interactive,
    pointerEvents: getComputedStyle(document.querySelector('.detail')).pointerEvents,
    actionTabIndex: document.getElementById('detailAction')?.tabIndex,
  }));
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready, null, { timeout: 15000 });

  // Engineering sits at 0.18. After the first stop has passed, it should be
  // acquired while still far away and then progress continuously toward us.
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

  console.log('[portfolio-billboard-browser] PASS');
  console.log(`[portfolio-billboard-browser] states=${expectedStates.join('->')}`);
  console.log(`[portfolio-billboard-browser] scale=${samples.map(s => s.billboard.scale.toFixed(3)).join('->')}`);
  console.log(`[portfolio-billboard-browser] lateral=${lateral.map(v => v.toFixed(1)).join('->')}`);
  console.log(`[portfolio-billboard-browser] yaw=${distant.billboard.yaw.toFixed(1)}deg->${active.billboard.yaw.toFixed(1)}deg`);
  console.log('[portfolio-billboard-browser] interaction=near-range-only');
} finally {
  await browser.close();
}
