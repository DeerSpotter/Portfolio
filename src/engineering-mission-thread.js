const TAU = Math.PI * 2;

export const ENGINEERING_MISSION_CONTRACT = 'engineering-to-mission-scroll-v1';
export const ENGINEERING_MISSION_START = 0.105;
export const ENGINEERING_MISSION_END = 0.315;

const COLORS = {
  ink: '#3b2f21',
  muted: '#8a765a',
  paper: '#e7d8b8',
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
  if (phase < 0.16) return 'sketch';
  if (phase < 0.31) return 'block';
  if (phase < 0.46) return 'part';
  if (phase < 0.61) return 'motor';
  if (phase < 0.76) return 'uas';
  if (phase < 0.89) return 'battlespace';
  return 'command';
}

export function describeEngineeringMission(progress) {
  const wrapped = wrap01(progress);
  const active = wrapped >= ENGINEERING_MISSION_START && wrapped <= ENGINEERING_MISSION_END;
  if (!active) {
    return {
      contract: ENGINEERING_MISSION_CONTRACT,
      active: false,
      phase: null,
      stage: 'inactive',
      commandIssued: false,
    };
  }

  const phase = clamp((wrapped - ENGINEERING_MISSION_START)
    / (ENGINEERING_MISSION_END - ENGINEERING_MISSION_START));
  return {
    contract: ENGINEERING_MISSION_CONTRACT,
    active: true,
    phase,
    stage: stageFor(phase),
    commandIssued: phase >= 0.965,
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
  const reveal = smoothstep(0.00, 0.18, phase);
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
    const e = edges[i];
    const local = clamp(edges.length * reveal - i);
    line(ctx, e[0], e[1], e[2], e[3], 1.6, COLORS.ink, local);
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
  const extrusion = 8 + smoothstep(0.12, 0.30, phase) * 24;
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
  const cut = smoothstep(0.26, 0.47, phase);
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
  const energize = smoothstep(0.40, 0.62, phase);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  circle(ctx, 0, 0, 42, COLORS.paperDeep, COLORS.ink, 1.5, 0.96);
  circle(ctx, 0, 0, 28, COLORS.paperLight, COLORS.blue, 2.2, 1);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    const x = Math.cos(a) * 34;
    const y = Math.sin(a) * 34;
    circle(ctx, x, y, 3.4, i % 2 ? COLORS.fox : COLORS.gold, null, 0, 0.45 + energize * 0.45);
  }
  ctx.save();
  ctx.rotate(spin);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    line(ctx, Math.cos(a) * 7, Math.sin(a) * 7, Math.cos(a) * 29, Math.sin(a) * 29, 4.4, COLORS.ink, 0.82);
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
  const unfold = smoothstep(0.54, 0.75, phase);
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

function drawTerrain(ctx, x, y, w, h, phase, compact, alpha) {
  const reveal = smoothstep(0.67, 0.87, phase);
  ctx.save();
  ctx.globalAlpha *= alpha * reveal;
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(231,216,184,.76)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  const gridStep = compact ? 44 : 36;
  ctx.strokeStyle = 'rgba(86,68,44,.16)';
  ctx.lineWidth = 0.65;
  for (let gx = -w / 2; gx <= w / 2; gx += gridStep) line(ctx, gx, -h / 2, gx, h / 2, 0.65, COLORS.muted, 0.22);
  for (let gy = -h / 2; gy <= h / 2; gy += gridStep) line(ctx, -w / 2, gy, w / 2, gy, 0.65, COLORS.muted, 0.22);

  const contourCount = compact ? 5 : 8;
  for (let i = 0; i < contourCount; i++) {
    const yy = -h * 0.28 + i * h * 0.085;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, yy);
    for (let s = 0; s <= 12; s++) {
      const xx = -w * 0.45 + s / 12 * w * 0.9;
      const wave = Math.sin(s * 0.8 + i * 0.7) * (7 + i * 0.4);
      ctx.lineTo(xx, yy + wave);
    }
    ctx.strokeStyle = 'rgba(102,113,63,.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const friendly = [[-w * 0.25, h * 0.18], [-w * 0.07, h * 0.05], [w * 0.12, h * 0.22]];
  for (const [fx, fy] of friendly) {
    polygon(ctx, [[fx, fy - 7], [fx + 7, fy], [fx, fy + 7], [fx - 7, fy]], COLORS.paperLight, COLORS.blue, 1.4, 0.95);
  }
  const contacts = [[w * 0.26, -h * 0.13], [w * 0.34, h * 0.02]];
  for (const [ex, ey] of contacts) {
    circle(ctx, ex, ey, 6, null, COLORS.rust, 1.5, 0.95);
    line(ctx, ex - 5, ey - 5, ex + 5, ey + 5, 1.2, COLORS.rust, 0.9);
    line(ctx, ex + 5, ey - 5, ex - 5, ey + 5, 1.2, COLORS.rust, 0.9);
  }

  ctx.strokeStyle = COLORS.fox;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, h * 0.18);
  ctx.bezierCurveTo(-w * 0.1, -h * 0.02, w * 0.05, h * 0.05, w * 0.24, -h * 0.12);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.globalAlpha *= 0.14 + reveal * 0.16;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(-w * 0.06, -h * 0.24);
  ctx.lineTo(w * 0.18, -h * 0.02);
  ctx.lineTo(-w * 0.21, h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  label(ctx, 'BATTLESPACE / SENSOR FUSION', -w / 2 + 12, -h / 2 + 16, 8, COLORS.olive, 'left', 0.95);
  ctx.restore();
}

function drawCursor(ctx, x, y, pressed, alpha) {
  const scale = pressed ? 0.86 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  polygon(ctx, [[0, 0], [0, 19], [5, 14], [10, 23], [14, 21], [9, 12], [16, 11]], COLORS.paperLight, COLORS.ink, 1.2, alpha);
  if (pressed) circle(ctx, 2, 2, 12, null, COLORS.fox, 1.4, alpha * 0.75);
  ctx.restore();
}

function drawCommandUI(ctx, x, y, w, h, phase, compact, alpha) {
  const reveal = smoothstep(0.82, 0.98, phase);
  const issued = phase >= 0.965;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha * reveal;

  ctx.fillStyle = 'rgba(35,47,44,.82)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = COLORS.paperDeep;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  const top = -h / 2 + 22;
  line(ctx, -w / 2, top, w / 2, top, 1, COLORS.paperDeep, 0.58);
  label(ctx, 'MISSION CONTROL / PUBLIC CONCEPT', -w / 2 + 12, -h / 2 + 12, compact ? 7 : 8, COLORS.paperLight, 'left', 0.95);
  label(ctx, 'SYSTEMS → DECISION', w / 2 - 12, -h / 2 + 12, compact ? 7 : 8, COLORS.gold, 'right', 0.95);

  const sideW = compact ? w * 0.28 : w * 0.24;
  line(ctx, -w / 2 + sideW, top, -w / 2 + sideW, h / 2, 1, COLORS.paperDeep, 0.45);
  line(ctx, w / 2 - sideW, top, w / 2 - sideW, h / 2, 1, COLORS.paperDeep, 0.45);

  label(ctx, 'TRACKS', -w / 2 + 12, top + 18, 8, COLORS.gold, 'left', 0.9);
  const tracks = compact ? ['UAS-02', 'SENSOR-1', 'TEAM-A'] : ['UAS-02', 'SENSOR-1', 'TEAM-A', 'CONTACT-4'];
  tracks.forEach((track, index) => {
    const ty = top + 38 + index * 20;
    circle(ctx, -w / 2 + 17, ty, 3, index === 3 ? COLORS.rust : COLORS.blue, null, 0, 0.9);
    label(ctx, track, -w / 2 + 27, ty, 7, COLORS.paperLight, 'left', 0.86);
  });

  const buttonW = compact ? sideW - 18 : sideW - 22;
  const buttonX = w / 2 - sideW / 2;
  const buttonY = top + 58;
  ctx.fillStyle = issued ? 'rgba(102,113,63,.78)' : 'rgba(207,111,47,.58)';
  ctx.fillRect(buttonX - buttonW / 2, buttonY - 15, buttonW, 30);
  ctx.strokeStyle = issued ? COLORS.paperLight : COLORS.gold;
  ctx.strokeRect(buttonX - buttonW / 2, buttonY - 15, buttonW, 30);
  label(ctx, issued ? 'COMMAND SENT' : 'TASK UAS-02', buttonX, buttonY, compact ? 7 : 8, COLORS.paperLight, 'center', 1);

  const cursorPhase = smoothstep(0.88, 0.965, phase);
  const cursorX = w * 0.18 + (buttonX - w * 0.18) * cursorPhase;
  const cursorY = h * 0.12 + (buttonY - h * 0.12) * cursorPhase;
  drawCursor(ctx, cursorX, cursorY, issued, 0.95);

  if (!compact) {
    label(ctx, 'ROUTE', w / 2 - sideW + 12, top + 108, 8, COLORS.gold, 'left', 0.9);
    label(ctx, issued ? 'ACK / EXECUTE' : 'PENDING TASK', w / 2 - sideW + 12, top + 128, 7, COLORS.paperLight, 'left', 0.82);
    label(ctx, 'HUMAN DECISION', w / 2 - sideW + 12, top + 148, 7, COLORS.paperLight, 'left', 0.65);
  }

  ctx.restore();
}

export function createEngineeringMissionThread() {
  return {
    render(ctx, width, height, progress, now, degraded = false) {
      const state = describeEngineeringMission(progress);
      if (!state.active) return state;

      const phase = state.phase;
      const compact = width <= 720;
      const edgeFade = smoothstep(0, 0.045, phase) * (1 - smoothstep(0.965, 1, phase));
      const objectScale = Math.min(width, height) / (compact ? 370 : 480);
      const objectX = width * (compact ? 0.56 : 0.64);
      const objectY = height * (compact ? 0.43 : 0.44);

      ctx.save();
      ctx.globalAlpha = edgeFade;

      const sketchA = stageAlpha(phase, 0.00, 0.26, 0.07);
      const blockA = stageAlpha(phase, 0.12, 0.40, 0.08);
      const partA = stageAlpha(phase, 0.26, 0.55, 0.08);
      const motorA = stageAlpha(phase, 0.40, 0.68, 0.08);
      const droneA = stageAlpha(phase, 0.54, 0.82, 0.08);
      const battleA = stageAlpha(phase, 0.68, 0.965, 0.08);
      const commandA = smoothstep(0.82, 0.93, phase);

      drawSketch(ctx, objectX, objectY, objectScale, phase, sketchA);
      drawBlock(ctx, objectX, objectY, objectScale, phase, blockA);
      drawMachinedPart(ctx, objectX, objectY, objectScale, phase, partA);
      drawMotor(ctx, objectX, objectY, objectScale, phase, now, motorA);

      const droneLift = smoothstep(0.62, 0.80, phase);
      const droneScale = objectScale * (1 - droneLift * 0.34);
      drawDrone(ctx,
        objectX - width * 0.03 * droneLift,
        objectY - height * 0.08 * droneLift,
        droneScale,
        phase,
        now,
        droneA);

      const mapExpand = smoothstep(0.67, 0.88, phase);
      const mapW = width * (compact ? 0.46 + mapExpand * 0.42 : 0.30 + mapExpand * 0.52);
      const mapH = height * (compact ? 0.34 + mapExpand * 0.40 : 0.25 + mapExpand * 0.48);
      drawTerrain(ctx, width * 0.52, height * 0.47, mapW, mapH, phase, compact || degraded, battleA);

      if (commandA > 0.01) {
        const commandW = width * (compact ? 0.92 : 0.82);
        const commandH = height * (compact ? 0.58 : 0.68);
        drawCommandUI(ctx, width * 0.52, height * 0.47, commandW, commandH, phase, compact, commandA);
      }

      const storyA = smoothstep(0.06, 0.18, phase) * (1 - smoothstep(0.91, 0.99, phase));
      label(ctx,
        compact ? 'DESIGN → SYSTEM → MISSION' : 'MECHANICAL DESIGN → SYSTEM INTEGRATION → MISSION SOFTWARE',
        width * 0.5,
        height * (compact ? 0.73 : 0.80),
        compact ? 8 : 10,
        COLORS.rust,
        'center',
        storyA);

      ctx.restore();
      return state;
    },
  };
}
