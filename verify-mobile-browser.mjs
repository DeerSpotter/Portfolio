import fs from 'node:fs';
import { chromium } from 'playwright';

const touchSource = fs.readFileSync('src/touch-flight-input.js', 'utf8');
for (const required of [
  "const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';",
  'function deliverActiveGesture()',
  'function deliverCompletedGesture(direction)',
  "new CustomEvent(LOOP_INTENT_EVENT",
  "contract: 'touch-edge-to-flight-loop-v3'",
  "delivery: 'active-gesture-edge-intent-with-touchend-fallback'",
  'BLOCKED_SWIPE_SELECTOR',
]) {
  if (!touchSource.includes(required)) throw new Error(`Touch flight contract missing: ${required}`);
}
for (const forbidden of ['new WheelEvent(', 'dispatchEvent(new WheelEvent']) {
  if (touchSource.includes(forbidden)) throw new Error(`Touch flight must not synthesize desktop wheel input: ${forbidden}`);
}
if (touchSource.includes("closest('.detail")) {
  throw new Error('The flight billboard must remain a swipe surface; only actual controls/dialogs may block touch flight.');
}

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

function numericPx(value) {
  return Number.parseFloat(value || '0');
}

async function inspectHud(targetPage = page) {
  return targetPage.evaluate(() => {
    const detail = document.querySelector('.detail');
    const detailRect = detail.getBoundingClientRect();
    const action = document.getElementById('detailAction');
    const actionRect = action.getBoundingClientRect();
    const actionStyle = getComputedStyle(action);
    const footerRect = document.querySelector('.hud-bottom').getBoundingClientRect();
    const h1 = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    const buttons = [...document.querySelectorAll('.waypoint-nav button')];
    const frontField = document.querySelector('.billboard-field-canvas-front');
    const fieldRect = frontField?.getBoundingClientRect();
    const visible = element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      mobileSheet: Boolean(document.querySelector('link[href$="/mobile.css"]')),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      textSizeAdjust: getComputedStyle(document.documentElement).webkitTextSizeAdjust,
      hudDisplay: getComputedStyle(document.getElementById('hud')).display,
      h1Font: getComputedStyle(h1).fontSize,
      subtitleFont: getComputedStyle(subtitle).fontSize,
      detailPosition: getComputedStyle(detail).position,
      detailWidth: detail.offsetWidth,
      renderedDetailWidth: detailRect.width,
      detailTransform: getComputedStyle(detail).transform,
      cardBottom: detailRect.bottom,
      navigationTop: footerRect.top,
      detailCenter: { x: detailRect.x + detailRect.width / 2, y: detailRect.y + detailRect.height / 2 },
      actionHeight: actionRect.height,
      actionMinHeight: actionStyle.minHeight,
      actionBorderRadius: actionStyle.borderRadius,
      fieldCenter: fieldRect ? { x: fieldRect.x + fieldRect.width / 2, y: fieldRect.y + fieldRect.height / 2 } : null,
      navCount: buttons.length,
      navHeights: buttons.map(button => button.getBoundingClientRect().height),
      hiddenWaypoints: buttons.filter(button => !visible(button)).length,
      hiddenTopActions: [...document.querySelectorAll('.identity-actions > *')].filter(element => !visible(element)).length,
      chapterVisible: visible(document.querySelector('.chapter')),
      subtitleVisible: visible(subtitle),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      billboard: structuredClone(window.__portfolioBillboardDebug),
      touchInput: structuredClone(window.__portfolioTouchFlightDebug),
      canvasInputLoop: window.__portfolioCanvasDebug?.inputLoop || null,
      fieldTransform: frontField?.style.transform || '',
      fieldComputedTransform: frontField ? getComputedStyle(frontField).transform : '',
      fieldPointerEvents: frontField ? getComputedStyle(frontField).pointerEvents : null,
    };
  });
}

function assertCompactHud(sample, label, limits) {
  if (!sample.mobileSheet) throw new Error(`${label}: mobile stylesheet is not loaded.`);
  if (sample.textSizeAdjust !== '100%') throw new Error(`${label}: iOS text inflation is not locked: ${sample.textSizeAdjust}.`);
  if (sample.hudDisplay !== 'grid') throw new Error(`${label}: HUD fell back to document layout (${sample.hudDisplay}).`);
  if (sample.detailPosition !== 'absolute' || sample.detailTransform === 'none') {
    throw new Error(`${label}: flight billboard is static instead of compact/projected: position=${sample.detailPosition}, transform=${sample.detailTransform}`);
  }
  if (sample.navCount !== 6 || sample.hiddenWaypoints !== 0) {
    throw new Error(`${label}: waypoint controls were removed or hidden: count=${sample.navCount}, hidden=${sample.hiddenWaypoints}`);
  }
  if (sample.hiddenTopActions !== 0 || !sample.chapterVisible || !sample.subtitleVisible) {
    throw new Error(`${label}: mobile compacting suppressed content: topActions=${sample.hiddenTopActions}, chapter=${sample.chapterVisible}, subtitle=${sample.subtitleVisible}`);
  }
  if (sample.cardBottom > sample.navigationTop + 1) {
    throw new Error(`${label}: card overlaps waypoint HUD: card bottom=${sample.cardBottom}, navigation top=${sample.navigationTop}`);
  }
  if (sample.overflow) throw new Error(`${label}: compact HUD creates horizontal page overflow.`);
  if (numericPx(sample.h1Font) > limits.h1 || numericPx(sample.subtitleFont) > limits.subtitle) {
    throw new Error(`${label}: identity is not compact enough: h1=${sample.h1Font}, subtitle=${sample.subtitleFont}`);
  }
  if (sample.detailWidth > limits.detailWidth) {
    throw new Error(`${label}: billboard base width is too large for game HUD: ${sample.detailWidth}px.`);
  }
  if (sample.actionHeight > 16 || numericPx(sample.actionMinHeight) > 1) {
    throw new Error(`${label}: billboard action reverted to a large button: height=${sample.actionHeight}px, minHeight=${sample.actionMinHeight}.`);
  }
  if (Math.max(...sample.navHeights) > limits.navHeight) {
    throw new Error(`${label}: waypoint controls are too tall: ${sample.navHeights.map(value => value.toFixed(1)).join(', ')}`);
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
  assertCompactHud(portrait, '390x844 portrait', { h1: 16, subtitle: 9, detailWidth: 178, navHeight: 25 });
  if (!portrait.fieldTransform.includes(`scale(${portrait.billboard.scale})`)) {
    throw new Error(`390x844 portrait: procedural field lost billboard flight scale: field=${portrait.fieldTransform}, billboard=${portrait.billboard.scale}`);
  }

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
  assertCompactHud(narrow, '320x568 portrait', { h1: 15, subtitle: 8, detailWidth: 166, navHeight: 24 });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  const landscape = await inspectHud();
  assertCompactHud(landscape, '844x390 landscape', { h1: 15, subtitle: 8, detailWidth: 157, navHeight: 23 });
  if (!(landscape.billboard.scale < narrow.billboard.scale * 0.9)) {
    throw new Error(`Landscape resize reused a stale portrait pose: portrait scale=${narrow.billboard.scale}, landscape scale=${landscape.billboard.scale}`);
  }

  // Reproduce the real iPhone screenshots: Reduce Motion is enabled before the
  // page loads. It must keep the same left/right waypoint projection as the
  // desktop flight rather than forcing every card into the center corridor.
  const reducedPage = await browser.newPage({ viewport: { width: 414, height: 896 } });
  await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
  await reducedPage.goto(url, { waitUntil: 'load', timeout: 30000 });
  await reducedPage.waitForFunction(() => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready, null, { timeout: 15000 });
  await reducedPage.locator('[data-stop="1"]').click();
  await reducedPage.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Engineering');
  await reducedPage.waitForTimeout(300);
  const reduced = await inspectHud(reducedPage);
  assertCompactHud(reduced, '414x896 reduced-motion iPhone', { h1: 16, subtitle: 9, detailWidth: 166, navHeight: 24 });
  if (!reduced.reducedMotion) throw new Error('Reduced-motion phone proof did not actually emulate Reduce Motion.');
  if (Math.abs(reduced.detailCenter.x - reduced.viewport.width / 2) < 45) {
    throw new Error(`Reduced-motion billboard was centered instead of using the desktop side lane: center=${reduced.detailCenter.x}px.`);
  }
  if (reduced.renderedDetailWidth > 165) {
    throw new Error(`Reduced-motion projected card grew beyond mobile game scale: rendered width=${reduced.renderedDetailWidth}px.`);
  }
  if (!reduced.fieldCenter) throw new Error('Reduced-motion procedural field is missing.');
  const fieldOffset = Math.hypot(
    reduced.fieldCenter.x - reduced.detailCenter.x,
    reduced.fieldCenter.y - reduced.detailCenter.y,
  );
  if (fieldOffset > 2) {
    throw new Error(`Reduced-motion field detached from projected card: center offset=${fieldOffset.toFixed(2)}px.`);
  }
  if (reduced.fieldComputedTransform === 'none') throw new Error('Reduced-motion procedural field lost its projected transform.');
  if (reduced.touchInput?.contract !== 'touch-edge-to-flight-loop-v3'
    || reduced.touchInput?.delivery !== 'active-gesture-edge-intent-with-touchend-fallback') {
    throw new Error(`Touch flight input adapter is missing: ${JSON.stringify(reduced.touchInput)}`);
  }
  if (reduced.touchInput?.blockedSelector?.includes('.detail')) {
    throw new Error(`Flight billboard is still blocked as a swipe surface: ${reduced.touchInput.blockedSelector}`);
  }
  if (reduced.canvasInputLoop !== 'wheel-plus-semantic-touch-intent-v2') {
    throw new Error(`Canvas flight does not own semantic touch recycle intent: ${reduced.canvasInputLoop}`);
  }

  // The reported iPhone failure happens before finger release: the native page
  // reaches its hard lower boundary while the finger is still moving, and the
  // ship parks there until touchend. Prove that reaching the edge on touchmove
  // recycles immediately, even when the swipe starts on the billboard itself.
  await reducedPage.locator('[data-stop="5"]').click();
  await reducedPage.waitForFunction(() => window.__portfolioCanvasDebug?.activeStop === 'Clarity');
  await reducedPage.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight - innerHeight);
    window.__portfolioTestWheelEvents = 0;
    addEventListener('wheel', () => { window.__portfolioTestWheelEvents += 1; });
  });
  await reducedPage.waitForTimeout(100);
  const beforeTouchLoop = await reducedPage.evaluate(() => window.__portfolioCanvasDebug.loopCycle);

  await reducedPage.evaluate(() => {
    const surface = document.querySelector('.detail');
    const touchEvent = (type, y = null) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: y === null ? [] : [{ clientY: y }] });
      surface.dispatchEvent(event);
    };
    window.__portfolioFinishTestTouch = () => touchEvent('touchend');
    touchEvent('touchstart', 320);
    touchEvent('touchmove', 235);
  });

  await reducedPage.waitForFunction(before => window.__portfolioCanvasDebug.loopCycle >= before + 1, beforeTouchLoop, { timeout: 1000 });
  const duringTouchLoop = await reducedPage.evaluate(() => ({
    loopCycle: window.__portfolioCanvasDebug.loopCycle,
    progress: window.__portfolioCanvasDebug.progress,
    y: scrollY,
    wheelEvents: window.__portfolioTestWheelEvents,
  }));
  if (duringTouchLoop.wheelEvents !== 0) {
    throw new Error(`Active touch loop remapped through synthetic wheel input: ${JSON.stringify(duringTouchLoop)}`);
  }
  if (duringTouchLoop.loopCycle !== beforeTouchLoop + 1) {
    throw new Error(`Active swipe did not recycle exactly once before release: ${JSON.stringify(duringTouchLoop)}`);
  }
  if (duringTouchLoop.y > 12) {
    throw new Error(`Active swipe did not recycle away from the document boundary: ${JSON.stringify(duringTouchLoop)}`);
  }

  await reducedPage.evaluate(() => {
    window.__portfolioFinishTestTouch();
    delete window.__portfolioFinishTestTouch;
  });
  await reducedPage.waitForTimeout(250);
  const afterTouchLoop = await reducedPage.evaluate(() => ({
    loopCycle: window.__portfolioCanvasDebug.loopCycle,
    progress: window.__portfolioCanvasDebug.progress,
    y: scrollY,
    wheelEvents: window.__portfolioTestWheelEvents,
  }));
  if (afterTouchLoop.loopCycle !== beforeTouchLoop + 1) {
    throw new Error(`Releasing the same swipe caused a duplicate recycle: ${JSON.stringify(afterTouchLoop)}`);
  }
  if (afterTouchLoop.wheelEvents !== 0) {
    throw new Error(`Touch release emitted a synthetic wheel event: ${JSON.stringify(afterTouchLoop)}`);
  }
  if (afterTouchLoop.progress > 0.10) {
    throw new Error(`Mobile flight did not continue into the start corridor after active-swipe recycle: ${JSON.stringify(afterTouchLoop)}`);
  }
  await reducedPage.close();

  console.log('[portfolio-mobile] PASS');
  console.log('[portfolio-mobile] layout=miniature-game-hud');
  console.log('[portfolio-mobile] ios-text-inflation=disabled');
  console.log('[portfolio-mobile] reduced-motion=side-projected-reading-plane');
  console.log('[portfolio-mobile] billboard-action=compact-inline-link');
  console.log('[portfolio-mobile] touch-loop=active-swipe-recycle-before-release');
  console.log('[portfolio-mobile] billboard=valid-flight-swipe-surface');
  console.log('[portfolio-mobile] content=present-not-hidden');
  console.log('[portfolio-mobile] destination=compact-flight-corridor');
} finally {
  await browser.close();
}
