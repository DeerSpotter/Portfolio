// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from flight state: this adapter reports
// semantic touch travel while canvas-flight remains the single owner of
// loopCycle, scroll recycling, travel continuity, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const VIRTUAL_ENTRY_PROGRESS = 0.93;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';
const VIRTUAL_TRAVEL_EVENT = 'portfolio-flight-virtual-touch';
const BLOCKED_SWIPE_SELECTOR = 'dialog, button, a, input, textarea, select, [contenteditable="true"]';

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;
let deliveredDuringGesture = false;
let virtualTravelActive = false;
let browserMultitouchActive = false;

function clearFlightGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
  deliveredDuringGesture = false;
  virtualTravelActive = false;
}

function resetGesture() {
  clearFlightGesture();
  browserMultitouchActive = false;
}

function handGestureToBrowser() {
  if (virtualTravelActive) sendVirtualTravel('cancel');
  clearFlightGesture();
  browserMultitouchActive = true;
}

function scrollMetrics() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return {
    maxScroll,
    local: Math.max(0, Math.min(1, scrollY / maxScroll)),
  };
}

function documentEdge(direction) {
  const { maxScroll } = scrollMetrics();
  if (direction > 0) return scrollY >= maxScroll - EDGE_PX;
  if (direction < 0) return scrollY <= EDGE_PX;
  return false;
}

function sendLoopIntent(direction) {
  dispatchEvent(new CustomEvent(LOOP_INTENT_EVENT, {
    detail: { direction },
  }));
}

function sendVirtualTravel(phase, deltaProgress = 0) {
  dispatchEvent(new CustomEvent(VIRTUAL_TRAVEL_EVENT, {
    detail: { phase, deltaProgress },
  }));
}

function beginVirtualTravel(deltaY) {
  const { maxScroll, local } = scrollMetrics();
  if (virtualTravelActive || deltaY <= 0 || local < VIRTUAL_ENTRY_PROGRESS) return false;

  virtualTravelActive = true;
  deliveredDuringGesture = true;
  sendVirtualTravel('begin');
  sendVirtualTravel('delta', deltaY / maxScroll);
  return true;
}

function deliverActiveGesture() {
  if (blocked || deliveredDuringGesture || startY === null || Math.abs(travelY) < MIN_GESTURE_PX) return false;

  const direction = Math.sign(travelY);
  if (!documentEdge(direction)) return false;

  deliveredDuringGesture = true;
  sendLoopIntent(direction);
  return true;
}

function deliverCompletedGesture(direction) {
  if (documentEdge(direction)) {
    sendLoopIntent(direction);
    return;
  }

  // Mobile Safari can finish updating scrollY after touchend has fired. Keep a
  // one-frame fallback for gestures that never entered virtual seam travel.
  requestAnimationFrame(() => {
    if (documentEdge(direction)) sendLoopIntent(direction);
  });
}

addEventListener('touchstart', event => {
  // Two or more fingers belong entirely to the browser. Do not reinterpret a
  // pinch as flight, and do not resume flight if one finger lifts before the
  // other. A fresh one-finger touchstart is required after zooming finishes.
  if (event.touches.length !== 1) {
    handGestureToBrowser();
    return;
  }
  if (browserMultitouchActive) return;

  const touch = event.touches[0];
  if (!touch) return;
  blocked = event.target instanceof Element && Boolean(event.target.closest(BLOCKED_SWIPE_SELECTOR));
  startY = touch.clientY;
  lastY = touch.clientY;
  travelY = 0;
  deliveredDuringGesture = false;
  virtualTravelActive = false;
}, { passive: true });

addEventListener('touchmove', event => {
  if (event.touches.length !== 1 || browserMultitouchActive) {
    if (!browserMultitouchActive) handGestureToBrowser();
    // Keep application-level touchmove handlers from treating pinch movement
    // as navigation. This does not cancel the event, so Safari still owns zoom.
    event.stopImmediatePropagation();
    return;
  }
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;

  const deltaY = lastY - touch.clientY;
  lastY = touch.clientY;
  travelY += deltaY;

  if (virtualTravelActive) {
    event.preventDefault();
    const { maxScroll } = scrollMetrics();
    sendVirtualTravel('delta', deltaY / maxScroll);
    return;
  }

  if (travelY >= MIN_GESTURE_PX && beginVirtualTravel(deltaY)) {
    // Capture the gesture before Safari reaches the physical document edge.
    // From here until release, canvas-flight owns travel and scrollY stays put.
    event.preventDefault();
    return;
  }

  deliverActiveGesture();
}, { passive: false });

addEventListener('touchend', event => {
  if (browserMultitouchActive) {
    if (event.touches.length === 0) resetGesture();
    return;
  }

  if (virtualTravelActive) {
    sendVirtualTravel('end');
    resetGesture();
    return;
  }

  if (blocked || startY === null || deliveredDuringGesture || Math.abs(travelY) < MIN_GESTURE_PX) {
    resetGesture();
    return;
  }

  const direction = Math.sign(travelY);
  resetGesture();
  deliverCompletedGesture(direction);
}, { passive: true });

addEventListener('touchcancel', () => {
  if (browserMultitouchActive) {
    resetGesture();
    return;
  }
  if (virtualTravelActive) sendVirtualTravel('cancel');
  resetGesture();
}, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v4',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
  virtualEntryProgress: VIRTUAL_ENTRY_PROGRESS,
  delivery: 'pre-edge-virtual-travel-with-edge-fallback',
  gestureOwnership: 'one-finger-flight-multitouch-browser',
  blockedSelector: BLOCKED_SWIPE_SELECTOR,
};
