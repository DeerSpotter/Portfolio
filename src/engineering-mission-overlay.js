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
const LEFT_STAGES = new Set(['sketch', 'block', 'part']);
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
  };
  let transformPlacement = 'inactive';
  let transformOffsetX = 0;

  if (flight?.ready) {
    const degraded = Boolean(flight.degraded);
    sketchState = sketchRenderer.render(ctx, cssW, cssH, flight.progress, degraded);

    const layoutState = describeEngineeringTransform(flight.progress);
    const keepLeft = layoutState.active && LEFT_STAGES.has(layoutState.stage);
    transformPlacement = layoutState.active
      ? (keepLeft ? 'left-pre-motor' : 'right-motor-drone')
      : 'inactive';
    transformOffsetX = keepLeft ? cssW * (cssW <= 720 ? -0.20 : -0.30) : 0;

    // Keep sketch, stock, and machined-part work on the left. Once the motor/
    // torque stage begins, return to the original right-side geometry and keep
    // the powered motor -> drone portion there. The scroll timeline is unchanged.
    ctx.save();
    ctx.translate(transformOffsetX, 0);
    transformState = transformRenderer.render(ctx, cssW, cssH, flight.progress, now);
    ctx.restore();
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
