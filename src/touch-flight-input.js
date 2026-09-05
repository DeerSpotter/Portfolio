// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from loop state: this adapter reports a
// semantic flight-loop intent, while canvas-flight remains the single owner of
// loopCycle, scroll recycling, travel continuity, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';
const BLOCKED_SWIPE_SELECTOR = 'dialog, button, a, input, textarea, select, [contenteditable="true"]';

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;
let deliveredDuringGesture = false;

function resetGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
  deliveredDuringGesture = false;
}

function documentEdge(direction) {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  if (direction > 0) return scrollY >= maxScroll - EDGE_PX;
  if (direction < 0) return scrollY <= EDGE_PX;
  return false;
}

function sendLoopIntent(direction) {
  dispatchEvent(new CustomEvent(LOOP_INTENT_EVENT, {
    detail: { direction },
  }));
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

  // Mobile Safari can finish updating scrollY after touchend has fired. Check
  // once on the next frame as a fallback, but do not make release the primary
  // loop trigger. The active touchmove path above handles the normal case.
  requestAnimationFrame(() => {
    if (documentEdge(direction)) sendLoopIntent(direction);
  });
}

addEventListener('touchstart', event => {
  const touch = event.touches[0];
  if (!touch) return;
  blocked = event.target instanceof Element && Boolean(event.target.closest(BLOCKED_SWIPE_SELECTOR));
  startY = touch.clientY;
  lastY = touch.clientY;
  travelY = 0;
  deliveredDuringGesture = false;
}, { passive: true });

addEventListener('touchmove', event => {
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;
  travelY += lastY - touch.clientY;
  lastY = touch.clientY;
  deliverActiveGesture();
}, { passive: true });

addEventListener('touchend', () => {
  if (blocked || startY === null || deliveredDuringGesture || Math.abs(travelY) < MIN_GESTURE_PX) {
    resetGesture();
    return;
  }

  const direction = Math.sign(travelY);
  resetGesture();
  deliverCompletedGesture(direction);
}, { passive: true });

addEventListener('touchcancel', resetGesture, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v3',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
  delivery: 'active-gesture-edge-intent-with-touchend-fallback',
  blockedSelector: BLOCKED_SWIPE_SELECTOR,
};
