// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from loop state: this adapter reports
// semantic loop intent while canvas-flight remains the owner of loopCycle,
// travel continuity, rendering, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';
const BLOCKED_SWIPE_SELECTOR = 'dialog, button, a, input, textarea, select, [contenteditable="true"]';
const SEAM_ENTRY_PROGRESS = 0.93;
const SEAM_EXIT_PROGRESS = 0.08;

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;
let deliveredDuringGesture = false;
let manualAfterSeam = false;

function resetGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
  deliveredDuringGesture = false;
  manualAfterSeam = false;
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

function carryForwardAcrossSeam() {
  if (manualAfterSeam) return false;

  const { maxScroll, local } = scrollMetrics();
  if (local < SEAM_ENTRY_PROGRESS) return false;

  deliveredDuringGesture = true;
  manualAfterSeam = true;

  // One atomic controller handoff. There is deliberately no animation loop
  // writing scrollY: the existing canvas travel damper performs the visible
  // fly-through from late 06 to the new lap. We only move the hidden scroll
  // controller to the real edge, let canvas-flight advance loopCycle, then
  // place that controller just beyond waypoint 01 (0.04) at 0.08.
  scrollTo(0, maxScroll);
  sendLoopIntent(1);
  scrollTo(0, maxScroll * SEAM_EXIT_PROGRESS);
  return true;
}

function deliverActiveGesture() {
  if (blocked || deliveredDuringGesture || startY === null || Math.abs(travelY) < MIN_GESTURE_PX) return false;

  const direction = Math.sign(travelY);
  if (direction > 0 && carryForwardAcrossSeam()) return true;
  if (!documentEdge(direction)) return false;

  deliveredDuringGesture = true;
  sendLoopIntent(direction);
  return true;
}

function deliverCompletedGesture(direction) {
  if (direction > 0 && carryForwardAcrossSeam()) return;

  if (documentEdge(direction)) {
    sendLoopIntent(direction);
    return;
  }

  // Mobile Safari can finish updating scrollY after touchend has fired. Check
  // once on the next frame only for ordinary non-assisted edge gestures.
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
  manualAfterSeam = false;
}, { passive: true });

addEventListener('touchmove', event => {
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;

  const deltaY = lastY - touch.clientY;
  lastY = touch.clientY;

  // Once the seam handoff has happened, Safari no longer owns this particular
  // finger-down transaction. Apply its remaining movement directly to the new
  // lap so the user never meets a document boundary or has to release first.
  if (manualAfterSeam) {
    event.preventDefault();
    scrollBy(0, deltaY);
    return;
  }

  travelY += deltaY;
  if (travelY > MIN_GESTURE_PX && scrollMetrics().local >= SEAM_ENTRY_PROGRESS) {
    event.preventDefault();
    carryForwardAcrossSeam();
    return;
  }

  deliverActiveGesture();
}, { passive: false });

addEventListener('touchend', () => {
  if (blocked || startY === null || manualAfterSeam || deliveredDuringGesture || Math.abs(travelY) < MIN_GESTURE_PX) {
    resetGesture();
    return;
  }

  const direction = Math.sign(travelY);
  resetGesture();
  deliverCompletedGesture(direction);
}, { passive: true });

addEventListener('touchcancel', resetGesture, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v5',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
  delivery: 'one-shot-seam-handoff-with-same-gesture-control',
  blockedSelector: BLOCKED_SWIPE_SELECTOR,
  seamAssist: 'single-controller-jump-06-through-01-v3',
  seamEntryProgress: SEAM_ENTRY_PROGRESS,
  seamExitProgress: SEAM_EXIT_PROGRESS,
  frameScrollWrites: 0,
};