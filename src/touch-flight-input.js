// Touch devices do not emit the wheel-edge gesture used by the desktop flight
// loop. Translate only a completed touch gesture at a document boundary into
// that existing input path so canvas-flight remains the single owner of loop
// state, travel continuity, and telemetry.
const EDGE_PX = 3;
const MIN_GESTURE_PX = 18;

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
  if (documentEdge(direction)) {
    dispatchEvent(new WheelEvent('wheel', {
      deltaY: direction * 100,
      bubbles: false,
      cancelable: true,
    }));
  }
  resetGesture();
}, { passive: true });

addEventListener('touchcancel', resetGesture, { passive: true });

window.__portfolioTouchFlightDebug = {
  contract: 'touch-edge-to-flight-loop-v1',
  edgePx: EDGE_PX,
  minimumGesturePx: MIN_GESTURE_PX,
};
