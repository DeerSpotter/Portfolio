// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from loop state: this adapter reports a
// semantic flight-loop intent, while canvas-flight remains the single owner of
// loopCycle, scroll recycling, travel continuity, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;

function resetGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
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

function deliverCompletedGesture(direction) {
  if (documentEdge(direction)) {
    sendLoopIntent(direction);
    return;
  }

  // Mobile Safari can finish updating scrollY after touchend has fired. Check
  // again on the next animation frame so the same completed swipe can cross the
  // boundary instead of requiring a second gesture against the rubber-band.
  requestAnimationFrame(() => {
    if (documentEdge(direction)) sendLoopIntent(direction);
  });
}

addEventListener('touchstart', event => {
  const touch = event.touches[0];
  if (!touch) return;
  blocked = event.target instanceof Element && Boolean(event.target.closest('.detail, dialog'));
  startY = touch.clientY;
  lastY = touch.clientY;
  travelY = 0;
}, { passive: true });

addEventListener('touchmove', event => {
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;
  travelY += lastY - touch.clientY;
  lastY = touch.clientY;
}, { passive: true });

addEventListener('touchend', () => {
  if (blocked || startY === null || Math.abs(travelY) < MIN_GESTURE_PX) {
    resetGesture();
    return;
  }

  const direction = Math.sign(travelY);
  resetGesture();
  deliverCompletedGesture(direction);
}, { passive: true });

addEventListener('touchcancel', resetGesture, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v2',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
  delivery: 'semantic-intent-after-scroll-settle',
};
