// Touch devices do not emit the wheel-edge gesture used by desktop flight.
// Keep touch interpretation separate from loop state: this adapter reports a
// semantic flight-loop intent, while canvas-flight remains the single owner of
// loopCycle, scroll recycling, travel continuity, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;
const LOOP_INTENT_EVENT = 'portfolio-flight-loop-intent';
const BLOCKED_SWIPE_SELECTOR = 'dialog, button, a, input, textarea, select, [contenteditable="true"]';
const SEAM_ENTRY_PROGRESS = 0.93;
const SEAM_EXIT_PROGRESS = 0.08;
const SEAM_ASSIST_DURATION_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 520 : 760;

let startY = null;
let lastY = null;
let travelY = 0;
let blocked = false;
let deliveredDuringGesture = false;
let seamAssistActive = false;
let manualAfterAssist = false;

function resetGesture() {
  startY = null;
  lastY = null;
  travelY = 0;
  blocked = false;
  deliveredDuringGesture = false;
  manualAfterAssist = false;
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

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function startForwardSeamAssist() {
  if (seamAssistActive) return false;

  const { maxScroll, local } = scrollMetrics();
  if (local < SEAM_ENTRY_PROGRESS) return false;

  seamAssistActive = true;
  manualAfterAssist = false;
  deliveredDuringGesture = true;

  const startProgress = local;
  const totalProgress = 1 + SEAM_EXIT_PROGRESS - startProgress;
  const startedAt = performance.now();
  let wrapped = false;

  function advance(now) {
    const elapsed = Math.max(0, now - startedAt);
    const t = Math.min(1, elapsed / SEAM_ASSIST_DURATION_MS);
    const unwrappedProgress = startProgress + totalProgress * easeInOutCubic(t);

    if (unwrappedProgress < 1) {
      scrollTo(0, maxScroll * unwrappedProgress);
    } else {
      if (!wrapped) {
        scrollTo(0, maxScroll);
        sendLoopIntent(1);
        wrapped = true;
      }
      scrollTo(0, maxScroll * Math.min(SEAM_EXIT_PROGRESS, unwrappedProgress - 1));
    }

    if (t < 1) {
      requestAnimationFrame(advance);
      return;
    }

    scrollTo(0, maxScroll * SEAM_EXIT_PROGRESS);
    seamAssistActive = false;
    manualAfterAssist = startY !== null;
    travelY = 0;
  }

  requestAnimationFrame(advance);
  return true;
}

function deliverActiveGesture() {
  if (blocked || deliveredDuringGesture || startY === null || Math.abs(travelY) < MIN_GESTURE_PX) return false;

  const direction = Math.sign(travelY);
  if (direction > 0 && startForwardSeamAssist()) return true;
  if (!documentEdge(direction)) return false;

  deliveredDuringGesture = true;
  sendLoopIntent(direction);
  return true;
}

function deliverCompletedGesture(direction) {
  if (direction > 0 && startForwardSeamAssist()) return;

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

addEventListener('touchstart', event => {
  const touch = event.touches[0];
  if (!touch) return;
  blocked = event.target instanceof Element && Boolean(event.target.closest(BLOCKED_SWIPE_SELECTOR));
  startY = touch.clientY;
  lastY = touch.clientY;
  travelY = 0;
  deliveredDuringGesture = false;
  manualAfterAssist = false;
}, { passive: true });

addEventListener('touchmove', event => {
  if (blocked) return;
  const touch = event.touches[0];
  if (!touch || lastY === null) return;

  const deltaY = lastY - touch.clientY;
  lastY = touch.clientY;

  if (seamAssistActive) {
    event.preventDefault();
    return;
  }

  if (manualAfterAssist) {
    event.preventDefault();
    scrollBy(0, deltaY);
    return;
  }

  travelY += deltaY;
  if (travelY > MIN_GESTURE_PX && scrollMetrics().local >= SEAM_ENTRY_PROGRESS) {
    event.preventDefault();
    startForwardSeamAssist();
    return;
  }

  deliverActiveGesture();
}, { passive: false });

addEventListener('touchend', () => {
  if (blocked || startY === null || seamAssistActive || manualAfterAssist || deliveredDuringGesture || Math.abs(travelY) < MIN_GESTURE_PX) {
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
  seamAssist: 'auto-06-through-01-v1',
  seamEntryProgress: SEAM_ENTRY_PROGRESS,
  seamExitProgress: SEAM_EXIT_PROGRESS,
  seamAssistDurationMs: SEAM_ASSIST_DURATION_MS,
};
