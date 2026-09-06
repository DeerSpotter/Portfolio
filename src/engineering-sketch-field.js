const TAU = Math.PI * 2;

export const ENGINEERING_SKETCH_FIELD_CONTRACT = 'continuous-engineering-notebook-v1';

const COLORS = {
  ink: '#3b2f21',
  muted: '#8a765a',
  rust: '#96543f',
  blue: '#4c6378',
  olive: '#66713f',
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

function wrapSigned(value) {
  let n = wrap01(value);
  if (n > 0.5) n -= 1;
  return n;
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

function circle(ctx, x, y, radius, color = COLORS.ink, width = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, rotation = 0, color = COLORS.ink, width = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, size = 7, color = COLORS.ink, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function polyline(ctx, points, reveal, width = 1, color = COLORS.ink, alpha = 1) {
  if (points.length < 2 || reveal <= 0) return;
  const segmentCount = points.length - 1;
  const visible = reveal * segmentCount;
  const full = Math.floor(visible);
  const fraction = visible - full;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < full && i < segmentCount; i++) ctx.lineTo(points[i + 1][0], points[i + 1][1]);
  if (full < segmentCount && fraction > 0) {
    const a = points[full];
    const b = points[full + 1];
    ctx.lineTo(a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction);
  }
  ctx.stroke();
  ctx.restore();
}

function centerlines(ctx, w, h, alpha) {
  ctx.save();
  ctx.setLineDash([5, 5]);
  line(ctx, -w, 0, w, 0, 0.65, COLORS.muted, alpha * 0.55);
  line(ctx, 0, -h, 0, h, 0.65, COLORS.muted, alpha * 0.55);
  ctx.restore();
}

function dimension(ctx, x1, y1, x2, y2, text, alpha) {
  line(ctx, x1, y1, x2, y2, 0.7, COLORS.rust, alpha);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hx = Math.cos(angle) * 4;
  const hy = Math.sin(angle) * 4;
  line(ctx, x1, y1, x1 + hx + hy, y1 + hy - hx, 0.7, COLORS.rust, alpha);
  line(ctx, x2, y2, x2 - hx + hy, y2 - hy - hx, 0.7, COLORS.rust, alpha);
  label(ctx, text, (x1 + x2) / 2, (y1 + y2) / 2 - 8, 7, COLORS.rust, 'center', alpha);
}

function drawBracket(ctx, reveal, alpha) {
  centerlines(ctx, 72, 54, alpha);
  polyline(ctx, [[-54, 30], [-54, -18], [-34, -38], [32, -38], [54, -18], [54, 30], [18, 30], [18, 8], [-18, 8], [-18, 30], [-54, 30]], reveal, 1.2, COLORS.ink, alpha);
  circle(ctx, 0, -8, 17, COLORS.blue, 1.1, alpha * reveal);
  circle(ctx, -34, 10, 4, COLORS.ink, 0.9, alpha * reveal);
  circle(ctx, 34, 10, 4, COLORS.ink, 0.9, alpha * reveal);
  dimension(ctx, -54, 45, 54, 45, '108.0 ±0.10', alpha * reveal);
  label(ctx, 'DATUM A', -54, -50, 7, COLORS.rust, 'left', alpha * reveal);
  label(ctx, 'Ø34 H7', 23, -8, 7, COLORS.blue, 'left', alpha * reveal);
}

function drawBearingSection(ctx, reveal, alpha) {
  centerlines(ctx, 58, 58, alpha);
  circle(ctx, 0, 0, 43, COLORS.ink, 1.2, alpha * reveal);
  circle(ctx, 0, 0, 31, COLORS.blue, 1.0, alpha * reveal);
  circle(ctx, 0, 0, 19, COLORS.ink, 1.0, alpha * reveal);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    circle(ctx, Math.cos(a) * 25, Math.sin(a) * 25, 3.2, COLORS.rust, 0.8, alpha * reveal);
  }
  for (let x = -39; x <= 39; x += 8) line(ctx, x, -40, x + 12, -28, 0.6, COLORS.muted, alpha * reveal * 0.45);
  label(ctx, 'SECTION B-B', 0, 56, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawGearMesh(ctx, reveal, alpha) {
  const gears = [{ x: -23, r: 26, teeth: 12 }, { x: 26, r: 19, teeth: 10 }];
  for (const gear of gears) {
    circle(ctx, gear.x, 0, gear.r, COLORS.ink, 1.0, alpha * reveal);
    circle(ctx, gear.x, 0, gear.r * 0.34, COLORS.blue, 0.9, alpha * reveal);
    for (let i = 0; i < gear.teeth; i++) {
      const a = i / gear.teeth * TAU;
      line(ctx,
        gear.x + Math.cos(a) * gear.r,
        Math.sin(a) * gear.r,
        gear.x + Math.cos(a) * (gear.r + 6),
        Math.sin(a) * (gear.r + 6),
        1.4, COLORS.ink, alpha * reveal);
    }
  }
  dimension(ctx, -23, 42, 26, 42, 'C-C 49.0', alpha * reveal);
  label(ctx, 'GEAR TRAIN / BACKLASH', 0, -48, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawFastenerStack(ctx, reveal, alpha) {
  line(ctx, 0, -48, 0, 48, 1.0, COLORS.ink, alpha * reveal);
  for (let y = -31; y <= 31; y += 7) line(ctx, -9, y, 9, y + 4, 0.6, COLORS.muted, alpha * reveal * 0.65);
  polyline(ctx, [[-24, -38], [24, -38], [17, -28], [-17, -28], [-24, -38]], reveal, 1.1, COLORS.ink, alpha);
  polyline(ctx, [[-22, 23], [22, 23], [17, 35], [-17, 35], [-22, 23]], reveal, 1.1, COLORS.ink, alpha);
  line(ctx, -42, -20, 42, -20, 2.0, COLORS.blue, alpha * reveal);
  line(ctx, -42, 15, 42, 15, 2.0, COLORS.blue, alpha * reveal);
  label(ctx, 'M8 × 1.25', 31, 2, 7, COLORS.rust, 'left', alpha * reveal);
  label(ctx, 'PRELOAD', -31, 45, 7, COLORS.olive, 'right', alpha * reveal);
}

function drawHarness(ctx, reveal, alpha) {
  const boxes = [[-54, -24, 'P1'], [-54, 24, 'P2'], [50, 0, 'J3']];
  for (const [x, y, name] of boxes) {
    ctx.save();
    ctx.globalAlpha *= alpha * reveal;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 14, y - 10, 28, 20);
    ctx.restore();
    label(ctx, name, x, y, 7, COLORS.ink, 'center', alpha * reveal);
  }
  const wires = [
    [[-40, -28], [-8, -32], [16, -16], [36, -5]],
    [[-40, -20], [-6, -18], [18, -7], [36, -1]],
    [[-40, 20], [-8, 16], [18, 7], [36, 3]],
    [[-40, 28], [-5, 30], [20, 16], [36, 7]],
  ];
  wires.forEach((points, index) => polyline(ctx, points, reveal, 1, index % 2 ? COLORS.blue : COLORS.rust, alpha * 0.9));
  label(ctx, 'HARNESS / SIGNAL', 0, 46, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawConnector(ctx, reveal, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha * reveal;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-44, -31, 88, 62);
  ctx.restore();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      circle(ctx, -30 + col * 12, -18 + row * 18, 3, col < 2 ? COLORS.rust : COLORS.blue, 0.8, alpha * reveal);
    }
  }
  label(ctx, 'A1', -30, 40, 7, COLORS.rust, 'center', alpha * reveal);
  label(ctx, 'CAN / POWER / IO', 0, -43, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawMotorSection(ctx, reveal, alpha) {
  circle(ctx, 0, 0, 44, COLORS.ink, 1.1, alpha * reveal);
  circle(ctx, 0, 0, 28, COLORS.blue, 1.1, alpha * reveal);
  circle(ctx, 0, 0, 11, COLORS.ink, 0.9, alpha * reveal);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    ellipse(ctx, Math.cos(a) * 35, Math.sin(a) * 35, 4, 8, a, i % 2 ? COLORS.rust : COLORS.gold, 0.7, alpha * reveal);
  }
  line(ctx, -58, 0, 58, 0, 0.6, COLORS.muted, alpha * reveal * 0.5);
  label(ctx, 'STATOR / ROTOR', 0, 56, 7, COLORS.olive, 'center', alpha * reveal);
  label(ctx, '3φ', 48, -27, 8, COLORS.rust, 'left', alpha * reveal);
}

function drawAirframe(ctx, reveal, alpha) {
  polyline(ctx, [[-67, 1], [-38, -13], [4, -18], [48, -9], [67, 1], [48, 9], [4, 18], [-38, 13], [-67, 1]], reveal, 1.1, COLORS.ink, alpha);
  line(ctx, -64, 0, 64, 0, 0.6, COLORS.muted, alpha * reveal * 0.55);
  line(ctx, -19, -13, -19, 13, 0.8, COLORS.blue, alpha * reveal);
  line(ctx, 21, -14, 21, 14, 0.8, COLORS.blue, alpha * reveal);
  dimension(ctx, -67, 35, 67, 35, 'SPAN REF', alpha * reveal);
  label(ctx, 'SECTION / LOAD PATH', 0, -34, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawSensorCone(ctx, reveal, alpha) {
  circle(ctx, -37, 11, 7, COLORS.ink, 1, alpha * reveal);
  line(ctx, -30, 11, 46, -33, 0.9, COLORS.blue, alpha * reveal);
  line(ctx, -30, 11, 53, 34, 0.9, COLORS.blue, alpha * reveal);
  ctx.save();
  ctx.globalAlpha *= alpha * reveal * 0.18;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(-30, 11);
  ctx.lineTo(46, -33);
  ctx.lineTo(53, 34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (let r = 18; r <= 54; r += 12) {
    ctx.save();
    ctx.globalAlpha *= alpha * reveal * 0.7;
    ctx.strokeStyle = COLORS.rust;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.arc(-37, 11, r, -0.46, 0.28);
    ctx.stroke();
    ctx.restore();
  }
  label(ctx, 'FOV / COVERAGE', 0, 48, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawOrbit(ctx, reveal, alpha) {
  ellipse(ctx, 0, 8, 58, 25, -0.22, COLORS.blue, 0.9, alpha * reveal);
  circle(ctx, 0, 8, 21, COLORS.ink, 1.0, alpha * reveal);
  const p = { x: 45, y: -6 };
  ctx.save();
  ctx.globalAlpha *= alpha * reveal;
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeRect(p.x - 7, p.y - 5, 14, 10);
  ctx.strokeRect(p.x - 27, p.y - 6, 17, 12);
  ctx.strokeRect(p.x + 10, p.y - 6, 17, 12);
  ctx.restore();
  line(ctx, -10, 11, 38, -2, 0.7, COLORS.rust, alpha * reveal);
  label(ctx, 'LINK BUDGET / ORBIT', 0, 48, 7, COLORS.olive, 'center', alpha * reveal);
}

function drawTolerance(ctx, reveal, alpha) {
  const ys = [-28, -7, 14, 35];
  ys.forEach((y, index) => {
    line(ctx, -55, y, 55, y, 0.9, COLORS.ink, alpha * reveal);
    line(ctx, -55 + index * 8, y - 5, -55 + index * 8, y + 5, 0.8, COLORS.rust, alpha * reveal);
  });
  dimension(ctx, -55, -42, 55, -42, 'STACK = 0.42', alpha * reveal);
  ctx.save();
  ctx.globalAlpha *= alpha * reveal;
  ctx.strokeStyle = COLORS.blue;
  ctx.strokeRect(-44, 48, 88, 16);
  ctx.restore();
  label(ctx, '⌖ 0.20 | A | B', 0, 56, 7, COLORS.blue, 'center', alpha * reveal);
}

function drawRotorHub(ctx, reveal, alpha) {
  circle(ctx, 0, 0, 13, COLORS.ink, 1.2, alpha * reveal);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    const x1 = Math.cos(a) * 14;
    const y1 = Math.sin(a) * 14;
    const x2 = Math.cos(a) * 53;
    const y2 = Math.sin(a) * 53;
    line(ctx, x1, y1, x2, y2, 2.5, COLORS.ink, alpha * reveal);
    ellipse(ctx, x2, y2, 24, 6, a, COLORS.blue, 0.9, alpha * reveal);
  }
  label(ctx, 'ROTOR HUB / LOAD PATH', 0, 67, 7, COLORS.olive, 'center', alpha * reveal);
}

const MOTIFS = [
  { at: 0.03, x: 0.17, y: 0.30, scale: 0.95, rotation: -0.08, draw: drawBracket, name: 'bracket' },
  { at: 0.10, x: 0.83, y: 0.23, scale: 0.82, rotation: 0.05, draw: drawBearingSection, name: 'bearing-section' },
  { at: 0.18, x: 0.16, y: 0.67, scale: 0.88, rotation: -0.04, draw: drawGearMesh, name: 'gear-mesh' },
  { at: 0.26, x: 0.83, y: 0.68, scale: 0.82, rotation: 0.06, draw: drawFastenerStack, name: 'fastener-stack' },
  { at: 0.34, x: 0.16, y: 0.36, scale: 0.92, rotation: -0.05, draw: drawHarness, name: 'harness' },
  { at: 0.43, x: 0.84, y: 0.31, scale: 0.82, rotation: 0.04, draw: drawConnector, name: 'connector' },
  { at: 0.51, x: 0.16, y: 0.70, scale: 0.86, rotation: -0.05, draw: drawMotorSection, name: 'motor-section' },
  { at: 0.59, x: 0.82, y: 0.68, scale: 0.88, rotation: 0.03, draw: drawAirframe, name: 'airframe-section' },
  { at: 0.67, x: 0.15, y: 0.33, scale: 0.90, rotation: -0.04, draw: drawSensorCone, name: 'sensor-cone' },
  { at: 0.76, x: 0.83, y: 0.26, scale: 0.84, rotation: 0.05, draw: drawTolerance, name: 'tolerance-stack' },
  { at: 0.85, x: 0.17, y: 0.68, scale: 0.88, rotation: -0.05, draw: drawOrbit, name: 'orbit' },
  { at: 0.94, x: 0.82, y: 0.63, scale: 0.88, rotation: 0.03, draw: drawRotorHub, name: 'rotor-hub' },
];

export function createEngineeringSketchField() {
  return {
    render(ctx, width, height, progress, degraded = false) {
      const viewportScale = Math.min(width, height) / 760;
      const windowRadius = degraded ? 0.125 : 0.155;
      const visible = [];

      for (const motif of MOTIFS) {
        const signed = wrapSigned(motif.at - progress);
        const distance = Math.abs(signed);
        if (distance > windowRadius) continue;

        const alpha = (1 - smoothstep(windowRadius * 0.55, windowRadius, distance)) * (degraded ? 0.28 : 0.42);
        const reveal = signed > 0
          ? 1 - smoothstep(0, windowRadius, signed)
          : 1;
        const drift = signed * width * 0.10;

        ctx.save();
        ctx.translate(motif.x * width + drift, motif.y * height);
        ctx.rotate(motif.rotation + signed * 0.16);
        ctx.scale(viewportScale * motif.scale, viewportScale * motif.scale);
        motif.draw(ctx, clamp(reveal), alpha);
        ctx.restore();
        visible.push(motif.name);
      }

      return {
        contract: ENGINEERING_SKETCH_FIELD_CONTRACT,
        active: true,
        motifCount: MOTIFS.length,
        visibleCount: visible.length,
        visible,
        style: 'technical-notebook-linework',
        timeline: 'full-loop',
      };
    },
  };
}
