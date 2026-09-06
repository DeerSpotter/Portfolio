import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 414, height: 896 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

function assertNear(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected=${expected}, actual=${actual}`);
  }
}

async function openEngineeringDestination(targetPage) {
  await targetPage.locator('[data-stop="1"]').click();
  await targetPage.waitForFunction(
    () => window.__portfolioCanvasDebug?.activeStop === 'Engineering'
      && window.__portfolioBillboardDebug?.readingHold,
    null,
    { timeout: 5000 },
  );
  await targetPage.locator('#detailAction').click();
  await targetPage.waitForFunction(
    () => document.getElementById('destination')?.open
      && window.__portfolioDestinationDebug?.ready,
    null,
    { timeout: 5000 },
  );
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.__portfolioCanvasDebug?.ready
      && window.__portfolioBillboardDebug?.ready
      && window.__portfolioTouchFlightDebug,
    null,
    { timeout: 15000 },
  );

  const touchContract = await page.evaluate(() => structuredClone(window.__portfolioTouchFlightDebug));
  if (touchContract.gestureOwnership !== 'one-finger-flight-multitouch-browser') {
    throw new Error(`Pinch ownership contract missing: ${JSON.stringify(touchContract)}`);
  }

  await page.locator('[data-stop="1"]').click();
  await page.waitForFunction(
    () => window.__portfolioCanvasDebug?.activeStop === 'Engineering'
      && window.__portfolioBillboardDebug?.readingHold,
    null,
    { timeout: 5000 },
  );

  const beforePinch = await page.evaluate(() => ({
    targetTravel: window.__portfolioCanvasDebug.targetTravel,
    travel: window.__portfolioCanvasDebug.travel,
    scrollY,
    readingHold: window.__portfolioBillboardDebug.readingHold,
  }));

  const pinchResult = await page.evaluate(() => {
    const surface = document.querySelector('.detail');
    const makeTouch = (x, y) => ({ clientX: x, clientY: y });
    const dispatch = (type, touches) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: touches });
      surface.dispatchEvent(event);
      return event.defaultPrevented;
    };

    dispatch('touchstart', [makeTouch(145, 420), makeTouch(265, 420)]);
    const movePrevented = dispatch('touchmove', [makeTouch(120, 390), makeTouch(290, 450)]);
    dispatch('touchend', [makeTouch(290, 450)]);
    dispatch('touchend', []);
    return { movePrevented };
  });

  await page.waitForTimeout(120);
  const afterPinch = await page.evaluate(() => ({
    targetTravel: window.__portfolioCanvasDebug.targetTravel,
    travel: window.__portfolioCanvasDebug.travel,
    scrollY,
    readingHold: window.__portfolioBillboardDebug.readingHold,
  }));

  if (pinchResult.movePrevented) {
    throw new Error('Two-finger pinch was canceled by application flight input.');
  }
  assertNear(afterPinch.targetTravel, beforePinch.targetTravel, 0.0005, 'Pinch changed flight target travel');
  assertNear(afterPinch.scrollY, beforePinch.scrollY, 1, 'Synthetic pinch changed document travel');
  if (!afterPinch.readingHold) {
    throw new Error(`Pinch released the selected billboard reading hold: ${JSON.stringify(afterPinch)}`);
  }

  await page.locator('#detailAction').click();
  await page.waitForFunction(
    () => document.getElementById('destination')?.open
      && window.__portfolioDestinationDebug?.ready,
    null,
    { timeout: 5000 },
  );

  const destinationContract = await page.evaluate(() => {
    const destination = document.getElementById('destination');
    return {
      contract: window.__portfolioDestinationDebug.contract,
      zoomGeometry: window.__portfolioDestinationDebug.zoomGeometry,
      presentation: window.__portfolioDestinationDebug.presentation,
      datasetPresentation: destination.dataset.presentation,
      flightPosition: window.__portfolioDestinationDebug.flightPosition,
      nativeModal: destination.matches(':modal'),
      ariaModal: destination.getAttribute('aria-modal'),
      hudInert: document.getElementById('hud').inert,
      worldInert: document.getElementById('world').inert,
      shipInert: document.getElementById('ship3d').inert,
    };
  });
  if (destinationContract.zoomGeometry !== 'layout-viewport-owned') {
    throw new Error(`Destination still treats visual zoom as geometry: ${JSON.stringify(destinationContract)}`);
  }
  if (destinationContract.presentation !== 'mobile-overlay'
      || destinationContract.datasetPresentation !== 'mobile-overlay'
      || destinationContract.nativeModal
      || destinationContract.ariaModal !== 'true') {
    throw new Error(`Coarse-touch destination entered Safari-style native modal state: ${JSON.stringify(destinationContract)}`);
  }
  if (!destinationContract.hudInert || !destinationContract.worldInert || !destinationContract.shipInert) {
    throw new Error(`Mobile overlay did not isolate the flight background: ${JSON.stringify(destinationContract)}`);
  }

  const destinationPinch = await page.evaluate(() => {
    const surface = document.getElementById('destination');
    const makeTouch = (x, y) => ({ clientX: x, clientY: y });
    const dispatch = (type, touches) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: touches });
      surface.dispatchEvent(event);
      return event.defaultPrevented;
    };
    dispatch('touchstart', [makeTouch(120, 360), makeTouch(294, 510)]);
    const movePrevented = dispatch('touchmove', [makeTouch(90, 330), makeTouch(324, 540)]);
    dispatch('touchend', [makeTouch(324, 540)]);
    dispatch('touchend', []);
    return { movePrevented };
  });
  if (destinationPinch.movePrevented) {
    throw new Error('Destination overlay canceled the browser-owned pinch gesture.');
  }

  const viewportResizeIgnored = await page.evaluate(async () => {
    if (!visualViewport) return { supported: false, sentinel: true };
    window.__portfolioDestinationDebug.__pinchSentinel = true;
    visualViewport.dispatchEvent(new Event('resize'));
    visualViewport.dispatchEvent(new Event('scroll'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      supported: true,
      sentinel: window.__portfolioDestinationDebug.__pinchSentinel === true,
    };
  });
  if (viewportResizeIgnored.supported && !viewportResizeIgnored.sentinel) {
    throw new Error('visualViewport pinch events recomputed destination geometry.');
  }

  await page.locator('#destination .close-button').click();
  await page.waitForFunction(() => !document.getElementById('destination')?.open, null, { timeout: 5000 });
  const restoredBackground = await page.evaluate(() => ({
    hudInert: document.getElementById('hud').inert,
    worldInert: document.getElementById('world').inert,
    shipInert: document.getElementById('ship3d').inert,
  }));
  if (restoredBackground.hudInert || restoredBackground.worldInert || restoredBackground.shipInert) {
    throw new Error(`Closing mobile destination left flight background inert: ${JSON.stringify(restoredBackground)}`);
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await desktop.goto(url, { waitUntil: 'load', timeout: 30000 });
    await desktop.waitForFunction(
      () => window.__portfolioCanvasDebug?.ready && window.__portfolioBillboardDebug?.ready,
      null,
      { timeout: 15000 },
    );
    await openEngineeringDestination(desktop);
    const desktopPresentation = await desktop.evaluate(() => {
      const destination = document.getElementById('destination');
      return {
        presentation: window.__portfolioDestinationDebug.presentation,
        datasetPresentation: destination.dataset.presentation,
        nativeModal: destination.matches(':modal'),
        hudInert: document.getElementById('hud').inert,
      };
    });
    if (desktopPresentation.presentation !== 'modal'
        || desktopPresentation.datasetPresentation !== 'modal'
        || !desktopPresentation.nativeModal
        || desktopPresentation.hudInert) {
      throw new Error(`Desktop destination lost native modal behavior: ${JSON.stringify(desktopPresentation)}`);
    }
  } finally {
    await desktop.close();
  }

  console.log('[portfolio-pinch-zoom] PASS');
  console.log('[portfolio-pinch-zoom] one-finger=flight');
  console.log('[portfolio-pinch-zoom] multi-touch=browser-owned');
  console.log('[portfolio-pinch-zoom] billboard-reading-hold=preserved');
  console.log('[portfolio-pinch-zoom] visual-viewport=display-only');
  console.log('[portfolio-pinch-zoom] mobile-destination=fixed-nonmodal-overlay');
  console.log('[portfolio-pinch-zoom] desktop-destination=native-modal');
} finally {
  await browser.close();
}
