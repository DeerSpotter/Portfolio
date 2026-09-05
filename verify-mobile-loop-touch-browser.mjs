import fs from 'node:fs';

const source = fs.readFileSync('src/canvas-flight.js', 'utf8');

for (const required of [
  'const TOUCH_LOOP_SWIPE_THRESHOLD = 18;',
  'function tryRecycleTouchGesture(currentY)',
  "addEventListener('touchstart'",
  "addEventListener('touchmove'",
  "addEventListener('touchend'",
  "addEventListener('touchcancel'",
  "inputLoop: 'wheel-touch-edge-recycle-v1'",
]) {
  if (!source.includes(required)) {
    throw new Error(`Mobile loop touch contract missing: ${required}`);
  }
}

for (const forbidden of [
  "dispatchEvent(new WheelEvent",
  'window.scrollTo =',
  'Element.prototype',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Mobile loop touch handling must not synthesize/patch browser input: ${forbidden}`);
  }
}

console.log('[mobile-loop-touch] PASS native touch edge recycle is wired without synthetic wheel dispatch');
