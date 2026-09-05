// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from flight state: this adapter reports
// semantic intent, while canvas-flight remains the sole owner of travel,
// loopCycle, seam animation, and the final scroll-position synchronization.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';
const SEAM_ASSIST_EVENT = 'portfolio-flight-seam-assist';
const SEAM_ASSIST_COMPLETE_EVENT = 'portfolio-flight-seam-assist-complete';
const BLOCKED_SWIPE_SELECTOR = 'dialog, button, a, input, textarea, select, [contenteditable="true"]';
const SEAM_ENTRY_PROGRESS = 0.93;

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;
let deliveredDuringGesture = false;
let seamAssistActive = false;
let gestureConsumed = false;

function resetGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
  deliveredDuringGesture = false;
  gestureConsumed = false;
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

function requestForwardSeamAssist() {
  if (seamAssistActive || gestureConsumed) return false;
  if (scrollMetrics().local < SEAM_ENTRY_PROGRESS) return false;

  seamAssistActive = true;
  gestureConsumed = true;
  deliveredDuringGesture = true;
  dispatchEvent(new CustomEvent(SEAM_ASSIST_EVENT, {
    detail: { direction: 1 },
  }));
  return true;
}

function deliverActiveGesture() {
  if (blocked || deliveredDuringGesture || startY === null || Math.abs(travelY) < MIN_GESTURE_PX) return false;

  const direction = Math.sign(travelY);
  if (direction > 0 && requestForwardSeamAssist()) return true;
  if (!documentEdge(direction)) return false;

  deliveredDuringGesture = true;
  sendLoopIntent(direction);
  return true;
}

function deliverCompletedGesture(direction) {
  if (direction > 0 && requestForwardSeamAssist()) return;

  if (documentEdge(direction)) {
    sendLoopIntent(direction);
    return;
  }

  // Mobile Safari can finish updating scrollY after touchend has fired. Check
  // once on the next frame as a fallback for non-assisted edge gestures.
  requestAnimationFrame(() => {
    if (documentEdge(direction)) sendLoopIntent(direction);
  });
}

addEventListener(SEAM_ASSIST_COMPLETE_EVENT, () => {
  seamAssistActive = false;
  // Once preventDefault has claimed a Safari touch transaction, do not try to
  // restart native scrolling inside that same finger-down gesture. Keep this
  // gesture consumed until release; the next swipe is normal native control.
  travelY = 0;
});

addEventListener('touchstart', event => {
  const touch = event.touches[0];
  if (!touch) return;
  blocked = event.target instanceof Element && Boolean(event.target.closest(BLOCKED_SWIPE_SELECTOR));
  startY = touch.clientY;
  lastY = touch.clientY;
  travelY = 0;
  deliveredDuringGesture = false;
  gestureConsumed = false;
}, { passive: true });

addEventListener('touchmove', event => {
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;

  const deltaY = lastY - touch.clientY;
  lastY = touch.clientY;

  if (seamAssistActive || gestureConsumed) {
    event.preventDefault();
    return;
  }

  travelY += deltaY;
  if (travelY > MIN_GESTURE_PX && scrollMetrics().local >= SEAM_ENTRY_PROGRESS) {
    event.preventDefault();
    requestForwardSeamAssist();
    return;
  }

  deliverActiveGesture();
}, { passive: false });

addEventListener('touchend', () => {
  if (blocked || startY === null || seamAssistActive || gestureConsumed || deliveredDuringGesture || Math.abs(travelY) < MIN_GESTURE_PX) {
    resetGesture();
    return;
  }

  const direction = Math.sign(travelY);
  resetGesture();
  deliverCompletedGesture(direction);
}, { passive: true });

addEventListener('touchcancel', resetGesture, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v4',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
  delivery: 'semantic-canvas-seam-assist',
  blockedSelector: BLOCKED_SWIPE_SELECTOR,
  seamAssist: 'canvas-owned-06-through-01-v2',
  seamEntryProgress: SEAM_ENTRY_PROGRESS,
  frameScrollWrites: 0,
};