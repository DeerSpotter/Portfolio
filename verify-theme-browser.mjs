import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });

async function inspect(page) {
  return page.evaluate(() => {
    const toggle = document.getElementById('themeToggle');
    const rect = toggle?.getBoundingClientRect();
    const themeStyles = document.getElementById('portfolioThemeStyles');
    return {
      theme: document.documentElement.dataset.theme,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
      stored: localStorage.getItem('portfolio-theme'),
      pressed: toggle?.getAttribute('aria-pressed') || null,
      label: toggle?.getAttribute('aria-label') || null,
      value: toggle?.querySelector('.theme-toggle-value')?.textContent || null,
      toggleRect: rect ? { left: rect.left, right: rect.right, top: rect.top, width: rect.width } : null,
      worldFilter: getComputedStyle(document.getElementById('world')).filter,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      stylesheetReady: Boolean(themeStyles?.sheet),
      debug: structuredClone(window.__portfolioThemeDebug),
      progress: window.__portfolioCanvasDebug?.progress ?? null,
    };
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.removeItem('portfolio-theme'));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioThemeDebug?.ready
    && window.__portfolioCanvasDebug?.ready
    && document.getElementById('portfolioThemeStyles')?.sheet, null, { timeout: 15000 });

  const paper = await inspect(page);
  if (paper.theme !== 'paper' || paper.pressed !== 'false' || paper.value !== 'FIELD') {
    throw new Error(`Paper theme did not initialize correctly: ${JSON.stringify(paper)}`);
  }
  if (!paper.toggleRect || paper.toggleRect.left < 1000 || paper.toggleRect.right > 1440) {
    throw new Error(`Theme toggle is not in the top-right HUD cluster: ${JSON.stringify(paper.toggleRect)}`);
  }
  if (paper.debug?.placement !== 'hud-top-right' || paper.debug?.reparenting !== false) {
    throw new Error(`Theme control violated placement/isolation contract: ${JSON.stringify(paper.debug)}`);
  }

  const beforeProgress = paper.progress;
  await page.locator('#themeToggle').click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'military'
    && localStorage.getItem('portfolio-theme') === 'military');
  await page.waitForTimeout(80);

  const military = await inspect(page);
  if (military.pressed !== 'true' || military.value !== 'PAPER' || !military.label?.includes('paper')) {
    throw new Error(`Military toggle state is wrong: ${JSON.stringify(military)}`);
  }
  if (military.colorScheme !== 'dark' || military.themeColor.toLowerCase() !== '#0d130f') {
    throw new Error(`Military browser chrome metadata is wrong: ${JSON.stringify(military)}`);
  }
  if (!military.worldFilter || military.worldFilter === 'none') {
    throw new Error(`Military world treatment was not applied: ${military.worldFilter}`);
  }
  if (military.bodyBackground === paper.bodyBackground) {
    throw new Error(`Military body palette did not change: paper=${paper.bodyBackground}, military=${military.bodyBackground}`);
  }
  if (beforeProgress !== null && military.progress !== null && Math.abs(military.progress - beforeProgress) > 0.01) {
    throw new Error(`Theme toggle moved the flight timeline: before=${beforeProgress}, after=${military.progress}`);
  }

  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioThemeDebug?.ready
    && document.documentElement.dataset.theme === 'military'
    && document.getElementById('portfolioThemeStyles')?.sheet, null, { timeout: 15000 });
  const persisted = await inspect(page);
  if (persisted.stored !== 'military' || persisted.pressed !== 'true') {
    throw new Error(`Military theme did not persist across reload: ${JSON.stringify(persisted)}`);
  }

  await page.locator('#themeToggle').click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'paper'
    && localStorage.getItem('portfolio-theme') === 'paper');
  const restored = await inspect(page);
  if (restored.pressed !== 'false' || restored.value !== 'FIELD') {
    throw new Error(`Paper theme was not restored: ${JSON.stringify(restored)}`);
  }

  await page.close();

  const mobile = await browser.newPage({
    viewport: { width: 414, height: 896 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await mobile.goto(url, { waitUntil: 'load', timeout: 30000 });
  await mobile.waitForFunction(() => window.__portfolioThemeDebug?.ready
    && document.getElementById('portfolioThemeStyles')?.sheet, null, { timeout: 15000 });
  const mobileSample = await inspect(mobile);
  if (!mobileSample.toggleRect
      || mobileSample.toggleRect.right > 414
      || mobileSample.toggleRect.left < 300
      || mobileSample.toggleRect.top > 90) {
    throw new Error(`Mobile theme toggle is not retained at top right: ${JSON.stringify(mobileSample.toggleRect)}`);
  }
  await mobile.close();

  console.log('[portfolio-theme] PASS');
  console.log('[portfolio-theme] modes=paper,military-dark');
  console.log('[portfolio-theme] placement=top-right');
  console.log('[portfolio-theme] persistence=localStorage');
} finally {
  await browser.close();
}
