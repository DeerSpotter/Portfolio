import {
  createEngineeringTransformRenderer,
  describeEngineeringTransform,
  ENGINEERING_TRANSFORM_CONTRACT,
} from './engineering-mission-thread.js';
import {
  createEngineeringSketchField,
  ENGINEERING_SKETCH_FIELD_CONTRACT,
} from './engineering-sketch-field.js';

const canvas = document.createElement('canvas');
canvas.id = 'engineeringMissionThread';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
  zIndex: '1',
});

document.body.insertBefore(canvas, document.getElementById('ship3d'));

const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const transformRenderer = createEngineeringTransformRenderer();
const sketchRenderer = createEngineeringSketchField();
const LEFT_STAGES = new Set(['motor', 'drone']);
const coarseTouch = matchMedia('(hover: none) and (pointer: coarse)');
let cssW = 1;
let cssH = 1;
let pixelRatio = 1;

function resize() {
  cssW = innerWidth;
  cssH = innerHeight;
  pixelRatio = Math.max(0.7, Math.min(1.25, devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.round(cssW * pixelRatio));
  canvas.height = Math.max(1, Math.round(cssH * pixelRatio));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function render(now) {
  ctx.clearRect(0, 0, cssW, cssH);
  const flight = window.__portfolioCanvasDebug;
  const mobileTransformSuppressed = coarseTouch.matches || cssW <= 720;

  let sketchState = {
    contract: ENGINEERING_SKETCH_FIELD_CONTRACT,
    active: false,
    motifCount: 0,
    visibleCount: 0,
    visible: [],
    style: 'technical-notebook-linework',
    timeline: 'full-loop',
  };
  let transformState = {
    contract: ENGINEERING_TRANSFORM_CONTRACT,
    active: false,
    phase: null,
    stage: 'waiting-for-flight',
    terminalStage: 'drone',
    suppressed: false,
  };
  let transformPlacement = 'inactive';
  let transformOffsetX = 0;

  if (flight?.ready) {
    const degraded = Boolean(flight.degraded);
    sketchState = sketchRenderer.render(ctx, cssW, cssH, flight.progress, degraded);

    const layoutState = describeEngineeringTransform(flight.progress);

    if (mobileTransformSuppressed) {
      // The focused sketch -> part -> motor -> drone sequence is intentionally
      // desktop-only. On coarse-touch and compact mobile layouts it is not
      // rendered at all, so it cannot leak into or visually interfere with the
      // billboard/destination experience after a tap.
      transformPlacement = 'mobile-suppressed';
      transformState = {
        contract: ENGINEERING_TRANSFORM_CONTRACT,
        active: false,
        phase: layoutState.phase,
        stage: 'mobile-suppressed',
        sourceStage: layoutState.stage,
        terminalStage: 'drone',
        suppressed: true,
      };
    } else {
      const moveLeft = layoutState.active && LEFT_STAGES.has(layoutState.stage);
      transformPlacement = layoutState.active
        ? (moveLeft ? 'left-motor-drone' : 'right-pre-motor')
        : 'inactive';
      transformOffsetX = moveLeft ? cssW * -0.30 : 0;

      // Keep sketch, stock, and machined-part work at the original right-side
      // geometry. When the motor/torque stage begins, move the powered motor ->
      // drone portion to the left. The scroll timeline and stage timing are unchanged.
      ctx.save();
      ctx.translate(transformOffsetX, 0);
      transformState = transformRenderer.render(ctx, cssW, cssH, flight.progress, now);
      ctx.restore();
    }
  }

  window.__portfolioEngineeringMissionDebug = {
    ready: true,
    renderer: 'persistent-sketch-plus-sketch-to-drone-canvas',
    input: 'scroll-owned-flight-progress',
    reparenting: false,
    proprietaryUI: false,
    storyArc: 'sketch-to-drone-only',
    storyActive: Boolean(transformState.active),
    storyStage: transformState.active ? transformState.stage : 'normal-flight',
    transform: transformState,
    transformPlacement,
    transformOffsetX,
    mobileTransformSuppressed,
    coarseTouch: coarseTouch.matches,
    focusedTransformPolicy: 'desktop-only',
    sketchField: sketchState,
    loadingPrologue: false,
    loadingInputBlocked: false,
    commandSequence: false,
    satelliteSequence: false,
    rocketSequence: false,
    liveShipTransition: 'normal-flight',
  };

  requestAnimationFrame(render);
}

addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(render);
