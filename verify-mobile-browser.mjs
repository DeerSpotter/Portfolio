import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

function numericPx(value) {
  return Number.parseFloat(value || '0');
}

async function inspectHud() {
  return page.evaluate(() => {
    const detail = document.querySelector('.detail');
    const detailRect = detail.getBoundingClientRect();
    const footerRect = document.querySelector('.hud-bottom').getBoundingClientRect();
    const h1 = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    const buttons = [...document.querySelectorAll('.waypoint-nav button')];
    const frontField = document.querySelector('.billboard-field-canvas-front');
    const visible = element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      mobileSheet: Boolean(document.querySelector('link[href$="/mobile.css"]')),
      hudDisplay: getComputedStyle(document.getElementById('hud')).display,
      h1Font: getComputedStyle(h1).fontSize,
      subtitleFont: getComputedStyle(subtitle).fontSize,
      detailPosition: getComputedStyle(detail).position,
      detailWidth: detail.offsetWidth,
      detailTransform: getComputedStyle(detail).transform,
      cardBottom: detailRect.bottom,
      navigationTop: footerRect.top,
      navCount: buttons.length,
      navHeights: buttons.map(button => button.getBoundingClientRect().height),
      hiddenWaypoints: buttons.filter(button => !visible(button)).length,
      hiddenTopActions: [...document.querySelectorAll('.identity-actions > *')].filter(element => !visible(element)).length,
      chapterVisible: visible(document.querySelector('.chapter')),
      subtitleVisible: visible(subtitle),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      billboard: structuredClone(window.__portfolioBillboardDebug),
      fieldTransform: frontField?.style.transform || '',
      fieldPointerEvents: frontField ? getComputedStyle(frontField).pointerEvents : null,
    };
  });
}

function assertCompactHud(sample, label, limits) {
  if (!sample.mobileSheet) throw new Error(`${label}: mobile stylesheet is not loaded.`);
  if (sample.hudDisplay !== 'grid') throw new Error(`${label}: HUD fell back to document layout (${sample.hudDisplay}).`);
  if (sample.detailPosition !== 'absolute' || sample.detailTransform === 'none') {
    throw new Error(`${label}: flight billboard is static instead of projected: position=${sample.detailPosition}, transform=${sample.detailTransform}`);
  }
  if (sample.navCount !== 6 || sample.hiddenWaypoints !== 0) {
    throw new Error(`${label}: waypoint controls were removed or hidden: count=${sample.navCount}, hidden=${sample.hiddenWaypoints}`);
  }
  if (sample.hiddenTopActions !== 0 || !sample.chapterVisible || !sample.subtitleVisible) {
    throw new Error(`${label}: mobile compacting suppressed content: topActions=${sample.hiddenTopActions}, chapter=${sample.chapterVisible}, subtitle=${sample.subtitleVisible}`);
  }
  if (sample.cardBottom > sample.navigationTop + 1) {
    throw new Error(`${label}: flying card overlaps waypoint HUD: card bottom=${sample.cardBottom}, navigation top=${sample.navigationTop}`);
  }
  if (sample.overflow) throw new Error(`${label}: compact HUD creates horizontal page overflow.`);
  if (numericPx(sample.h1Font) > limits.h1 || numericPx(sample.subtitleFont) > limits.subtitle) {
    throw new Error(`${label}: identity is not compact enough: h1=${sample.h1Font}, subtitle=${sample.subtitleFont}`);
  }
  if (sample.detailWidth > limits.detailWidth) {
    throw new Error(`${label}: billboard base width is too large for game HUD: ${sample.detailWidth}px.`);
  }
  if (Math.max(...sample.navHeights) > limits.navHeight) {
    throw new Error(`${label}: waypoint controls are too tall: ${sample.navHeights.map(value => value.toFixed(1)).join(', ')}`);
  }
  if (!sample.fieldTransform.includes(`scale(${sample.billboard.scale})`)) {
    throw new Error(`${label}: procedural field is not using the billboard flight scale: field=${sample.fieldTransform}, billboard=${sample.billboard.scale}`);
  }
  if (!sample.fieldTransform.includes(`rotateY(${sample.billboard.yaw}deg)`)) {
    throw new Error(`${label}: procedural field is not sharing billboard yaw: field=${sample.fieldTransform}, yaw=${sample.billboard.yaw}`);
  }
  if (sample.fieldPointerEvents !== 'none') throw new Error(`${label}: procedural field intercepts touch input.`);
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready && window.__portfolioShipDebug?.ready, null, { timeout: 15000 });

  await page.locator('[data-stop="1"]').click();
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Engineering' && window.__portfolioBillboardDebug?.stop === 'Engineering');
  await page.waitForTimeout(350);

  const portrait = await inspectHud();
  assertCompactHud(portrait, '390x844 portrait', { h1: 20, subtitle: 11, detailWidth: 212, navHeight: 30 });

  await page.locator('#detailAction').click();
  await page.waitForFunction(() => document.getElementById('destination')?.open && window.__portfolioDestinationDebug?.ready, null, { timeout: 5000 });
  const destination = await page.evaluate(() => {
    const dialog = document.getElementById('destination');
    const active = dialog.querySelector('.destination-stage-panel[data-active="true"]');
    const body = active?.querySelector('.destination-stage-body');
    return {
      panelCount: dialog.querySelectorAll('.destination-stage-panel').length,
      titleFont: getComputedStyle(document.getElementById('destinationTitle')).fontSize,
      bodyFont: body ? getComputedStyle(body).fontSize : null,
      horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
      hiddenPanels: [...dialog.querySelectorAll('.destination-stage-panel')].filter(panel => getComputedStyle(panel).display === 'none').length,
      reparenting: window.__portfolioDestinationDebug?.reparenting,
      contract: window.__portfolioDestinationDebug?.contract,
    };
  });
  if (destination.panelCount !== 2 || destination.hiddenPanels !== 0 || destination.reparenting !== false) {
    throw new Error(`Mobile destination changed the fixed two-panel contract: ${JSON.stringify(destination)}`);
  }
  if (destination.horizontalOverflow) throw new Error('Mobile destination overflows horizontally.');
  if (numericPx(destination.titleFont) > 22 || numericPx(destination.bodyFont) > 11) {
    throw new Error(`Mobile destination is not sufficiently compact: title=${destination.titleFont}, body=${destination.bodyFont}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('destination')?.open);

  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  const narrow = await inspectHud();
  assertCompactHud(narrow, '320x568 portrait', { h1: 18, subtitle: 10, detailWidth: 190, navHeight: 28 });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  const landscape = await inspectHud();
  assertCompactHud(landscape, '844x390 landscape', { h1: 18, subtitle: 9, detailWidth: 192, navHeight: 26 });
  if (!(landscape.billboard.scale < narrow.billboard.scale * 0.9)) {
    throw new Error(`Landscape resize reused a stale portrait pose: portrait scale=${narrow.billboard.scale}, landscape scale=${landscape.billboard.scale}`);
  }

  console.log('[portfolio-mobile] PASS');
  console.log('[portfolio-mobile] layout=compact-game-hud');
  console.log('[portfolio-mobile] content=present-not-hidden');
  console.log('[portfolio-mobile] billboard=projected-with-aligned-field');
  console.log('[portfolio-mobile] resize=reprojected-reading-pose');
  console.log('[portfolio-mobile] destination=compact-flight-corridor');
  console.log(`[portfolio-mobile] portrait=${portrait.viewport.width}x${portrait.viewport.height}, narrow=${narrow.viewport.width}x${narrow.viewport.height}, landscape=${landscape.viewport.width}x${landscape.viewport.height}`);
} finally {
  await browser.close();
}
