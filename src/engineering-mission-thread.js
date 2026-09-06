const TAU = Math.PI * 2;

export const ENGINEERING_TRANSFORM_CONTRACT = 'engineering-sketch-to-drone-v2';
export const ENGINEERING_TRANSFORM_START = 0.105;
export const ENGINEERING_TRANSFORM_END = 0.315;

const COLORS = {
  ink: '#3b2f21',
  muted: '#8a765a',
  paperLight: '#f0e3c5',
  paperDeep: '#c9ad78',
  fox: '#cf6f2f',
  rust: '#96543f',
  olive: '#66713f',
  blue: '#4c6378',
  gold: '#a9792f',
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function stageAlpha(phase, start, end, feather = 0.08) {
  const enter = smoothstep(start, Math.min(end, start + feather), phase);
  const leave = 1 - smoothstep(Math.max(start, end - feather), end, phase);
  return clamp(enter * leave);
}

function stageFor(phase) {
  if (phase < 0.18) return 'sketch';
  if (phase < 0.36) return 'block';
  if (phase < 0.54) return 'part';
  if (phase < 0.72) return 'motor';
  return 'drone';
}

export function describeEngineeringTransform(progress) {
  const wrapped = wrap01(progress);
  const active = wrapped >= ENGINEERING_TRANSFORM_START && wrapped <= ENGINEERING_TRANSFORM_END;
  if (!active) {
    return {
      contract: ENGINEERING_TRANSFORM_CONTRACT,
      active: false,
      phase: null,
      stage: 'inactive',
      terminalStage: 'drone',
    };
  }

  const phase = clamp((wrapped - ENGINEERING_TRANSFORM_START)
    / (ENGINEERING_TRANSFORM_END - ENGINEERING_TRANSFORM_START));
  return {
    contract: ENGINEERING_TRANSFORM_CONTRACT,
    active: true,
    phase,
    stage: stageFor(phase),
    terminalStage: 'drone',
  };
}

function line(ctx, x1, y1, x2, y2, width = 1, color = COLORS.ink, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function circle(ctx, x, y, radius, fill = null, stroke = COLORS.ink, width = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

function polygon(ctx, points, fill = null, stroke = COLORS.ink, width = 1, alpha = 1) {
  if (!points.length) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

function label(ctx, text, x, y, size = 10, color = COLORS.ink, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrowDimension(ctx, x1, y1, x2, y2, text, alpha) {
  line(ctx, x1, y1, x2, y2, 0.8, COLORS.rust, alpha);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 5;
  for (const [x, y, direction] of [[x1, y1, 1], [x2, y2, -1]]) {
    line(ctx, x, y,
      x + Math.cos(angle + direction * 0.55) * head * direction,
      y + Math.sin(angle + direction * 0.55) * head * direction,
      0.8, COLORS.rust, alpha);
  }
  label(ctx, text, (x1 + x2) / 2, (y1 + y2) / 2 - 8, 8, COLORS.rust, 'center', alpha);
}

function drawSketch(ctx, cx, cy, scale, phase, alpha) {
  const reveal = smoothstep(0.00, 0.20, phase);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.setLineDash([4, 5]);
  line(ctx, -82, 0, 82, 0, 0.7, COLORS.muted, 0.55 * reveal);
  line(ctx, 0, -66, 0, 66, 0.7, COLORS.muted, 0.55 * reveal);
  ctx.setLineDash([]);

  const edges = [
    [-60, 34, -60, -26], [-60, -26, -25, -42], [-25, -42, 42, -42],
    [42, -42, 60, -24], [60, -24, 60, 34], [60, 34, 18, 34],
    [18, 34, 18, 10], [18, 10, -18, 10], [-18, 10, -18, 34], [-18, 34, -60, 34],
  ];
  const visibleEdges = Math.ceil(edges.length * reveal);
  for (let i = 0; i < visibleEdges; i++) {
    const edge = edges[i];
    const local = clamp(edges.length * reveal - i);
    line(ctx, edge[0], edge[1], edge[2], edge[3], 1.6, COLORS.ink, local);
  }

  circle(ctx, 0, -6, 18, null, COLORS.blue, 1.4, reveal);
  for (const x of [-38, 38]) circle(ctx, x, 15, 5, null, COLORS.ink, 1, reveal);
  arrowDimension(ctx, -60, 52, 60, 52, '120.0 ±0.10', reveal);
  arrowDimension(ctx, 76, -42, 76, 34, '76.0', reveal);
  label(ctx, 'Ø36 H7', 24, -10, 8, COLORS.blue, 'left', reveal);
  label(ctx, 'DATUM A', -60, -56, 8, COLORS.rust, 'left', reveal);
  label(ctx, 'CONCEPT / CONSTRAINTS', 0, 72, 9, COLORS.olive, 'center', reveal);
  ctx.restore();
}

function drawBlock(ctx, cx, cy, scale, phase, alpha) {
  const extrusion = 8 + smoothstep(0.14, 0.34, phase) * 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';

  const front = [[-56, -36], [48, -36], [62, -22], [62, 34], [-56, 34]];
  const back = front.map(([x, y]) => [x + extrusion, y - extrusion * 0.55]);
  polygon(ctx, back, COLORS.paperDeep, COLORS.muted, 1.0, 0.55);
  polygon(ctx, [front[1], back[1], back[2], front[2]], '#d8c39b', COLORS.ink, 1.0, 0.7);
  polygon(ctx, [front[2], back[2], back[3], front[3]], '#bda371', COLORS.ink, 1.0, 0.65);
  polygon(ctx, front, COLORS.paperLight, COLORS.ink, 1.6, 0.94);
  for (let i = 0; i < front.length; i++) {
    line(ctx, front[i][0], front[i][1], back[i][0], back[i][1], 0.9, COLORS.muted, 0.7);
  }
  label(ctx, 'STOCK / MATERIAL', 0, 58, 9, COLORS.olive, 'center', 0.95);
  ctx.restore();
}

function drawMachinedPart(ctx, cx, cy, scale, phase, alpha) {
  const cut = smoothstep(0.30, 0.52, phase);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  polygon(ctx, [[-58, -26], [-38, -46], [38, -46], [58, -26], [58, 34], [24, 34], [16, 20], [-16, 20], [-24, 34], [-58, 34]],
    COLORS.paperDeep, COLORS.ink, 1.4, 0.92);
  circle(ctx, 0, -8, 22 + cut * 2, COLORS.paperLight, COLORS.blue, 2.2, 1);
  circle(ctx, 0, -8, 10, null, COLORS.ink, 1.1, 0.8);
  for (const [x, y] of [[-36, 12], [36, 12], [-30, -28], [30, -28]]) {
    circle(ctx, x, y, 4.5, COLORS.paperLight, COLORS.ink, 1, 0.95);
  }
  line(ctx, -52, 42, 52, 42, 0.8, COLORS.rust, 0.75);
  label(ctx, 'MACHINED HOUSING', 0, 58, 9, COLORS.olive, 'center', 1);
  label(ctx, '4X Ø9 THRU', 68, 4, 8, COLORS.rust, 'left', 0.9);
  label(ctx, 'R0.8 MAX', -68, -34, 8, COLORS.rust, 'right', 0.9);
  ctx.restore();
}

function drawMotor(ctx, cx, cy, scale, phase, now, alpha) {
  const spin = now * 0.008;
  const energize = smoothstep(0.48, 0.70, phase);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  circle(ctx, 0, 0, 42, COLORS.paperDeep, COLORS.ink, 1.5, 0.96);
  circle(ctx, 0, 0, 28, COLORS.paperLight, COLORS.blue, 2.2, 1);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * TAU;
    const x = Math.cos(angle) * 34;
    const y = Math.sin(angle) * 34;
    circle(ctx, x, y, 3.4, i % 2 ? COLORS.fox : COLORS.gold, null, 0, 0.45 + energize * 0.45);
  }
  ctx.save();
  ctx.rotate(spin);
  for (let i = 0; i < 4; i++) {
    const angle = i / 4 * TAU;
    line(ctx, Math.cos(angle) * 7, Math.sin(angle) * 7, Math.cos(angle) * 29, Math.sin(angle) * 29, 4.4, COLORS.ink, 0.82);
  }
  ctx.restore();
  circle(ctx, 0, 0, 6, COLORS.rust, COLORS.ink, 1, 1);
  label(ctx, 'MOTOR / TORQUE', 0, 62, 9, COLORS.olive, 'center', 1);
  label(ctx, 'RPM', 54, -26, 8, COLORS.blue, 'left', energize);
  ctx.restore();
}

function drawRotor(ctx, x, y, radius, angle, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.18, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(76,99,120,.13)';
  ctx.fill();
  line(ctx, -radius, 0, radius, 0, 1.8, COLORS.ink, 0.72);
  circle(ctx, 0, 0, 3.5, COLORS.rust, COLORS.ink, 0.8, 1);
  ctx.restore();
}

function drawDrone(ctx, cx, cy, scale, phase, now, alpha) {
  const unfold = smoothstep(0.64, 0.82, phase);
  const rotorSpin = now * 0.015;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  polygon(ctx, [[-22, -14], [22, -14], [32, 0], [22, 18], [-22, 18], [-32, 0]],
    COLORS.paperDeep, COLORS.ink, 1.5, 0.96);
  circle(ctx, 0, 0, 9, COLORS.blue, COLORS.ink, 1.2, 1);
  const arm = 42 + unfold * 34;
  const rotorRadius = 18 + unfold * 8;
  const arms = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  arms.forEach(([sx, sy], index) => {
    line(ctx, sx * 20, sy * 10, sx * arm, sy * arm * 0.62, 5, COLORS.ink, 0.82);
    drawRotor(ctx, sx * arm, sy * arm * 0.62, rotorRadius, rotorSpin + index * 0.7, 0.9);
  });
  line(ctx, -8, 22, -8, 34, 2, COLORS.ink, 0.8);
  line(ctx, 8, 22, 8, 34, 2, COLORS.ink, 0.8);
  label(ctx, 'UAS / PLATFORM', 0, 72, 9, COLORS.olive, 'center', 1);
  ctx.restore();
}

export function createEngineeringTransformRenderer() {
  return {
    render(ctx, width, height, progress, now) {
      const state = describeEngineeringTransform(progress);
      if (!state.active) return state;

      const phase = state.phase;
      const compact = width <= 720;
      const edgeFade = smoothstep(0, 0.045, phase) * (1 - smoothstep(0.965, 1, phase));
      const objectScale = Math.min(width, height) / (compact ? 370 : 480);
      const objectX = width * (compact ? 0.56 : 0.64);
      const objectY = height * (compact ? 0.43 : 0.44);

      ctx.save();
      ctx.globalAlpha = edgeFade;

      const sketchA = stageAlpha(phase, 0.00, 0.28, 0.07);
      const blockA = stageAlpha(phase, 0.14, 0.44, 0.08);
      const partA = stageAlpha(phase, 0.30, 0.60, 0.08);
      const motorA = stageAlpha(phase, 0.46, 0.76, 0.08);
      const droneA = smoothstep(0.62, 0.76, phase) * (1 - smoothstep(0.94, 1.0, phase));

      drawSketch(ctx, objectX, objectY, objectScale, phase, sketchA);
      drawBlock(ctx, objectX, objectY, objectScale, phase, blockA);
      drawMachinedPart(ctx, objectX, objectY, objectScale, phase, partA);
      drawMotor(ctx, objectX, objectY, objectScale, phase, now, motorA);

      const droneLift = smoothstep(0.68, 0.90, phase);
      const droneScale = objectScale * (1 - droneLift * 0.18);
      drawDrone(ctx,
        objectX - width * 0.02 * droneLift,
        objectY - height * 0.045 * droneLift,
        droneScale,
        phase,
        now,
        droneA);

      const storyAlpha = smoothstep(0.06, 0.18, phase) * (1 - smoothstep(0.91, 0.99, phase));
      label(ctx,
        compact ? 'SKETCH → PART → MOTOR → UAS' : 'MECHANICAL DESIGN → HARDWARE → MOTION → PLATFORM',
        width * 0.5,
        height * (compact ? 0.73 : 0.80),
        compact ? 8 : 10,
        COLORS.rust,
        'center',
        storyAlpha);

      ctx.restore();
      return state;
    },
  };
}
