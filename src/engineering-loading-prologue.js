const TAU = Math.PI * 2;

export const LOADING_PROLOGUE_CONTRACT = 'mission-software-launch-loading-v1';
export const LOADING_PROLOGUE_DURATION_MS = 14800;

const COLORS = {
  screen: '#0a100e',
  panel: '#121b18',
  panel2: '#18231f',
  line: 'rgba(213,224,207,.22)',
  grid: 'rgba(183,198,181,.08)',
  text: '#e2e8dc',
  muted: '#98a398',
  blue: '#7895a8',
  olive: '#82906c',
  gold: '#c49a55',
  orange: '#cf6f2f',
  rust: '#a75d47',
  white: '#f3ead8',
  black: '#050807',
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function line(ctx, x1, y1, x2, y2, width = 1, color = COLORS.line, alpha = 1) {
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

function label(ctx, text, x, y, size = 10, color = COLORS.text, align = 'left', weight = 600, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function circle(ctx, x, y, radius, fill = null, stroke = null, width = 1, alpha = 1) {
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

function panel(ctx, x, y, w, h, fill = COLORS.panel, stroke = COLORS.line, radius = 4, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function stageFor(phase) {
  if (phase < 0.065) return 'system-start';
  if (phase < 0.205) return 'common-operating-picture';
  if (phase < 0.345) return 'select-platform';
  if (phase < 0.485) return 'assign-route';
  if (phase < 0.625) return 'review-task';
  if (phase < 0.710) return 'execute-command';
  if (phase < 0.805) return 'orbital-relay';
  if (phase < 0.910) return 'launch';
  if (phase < 0.965) return 'payload-separation';
  return 'flight-handoff';
}

export function describeLoadingPrologue(phase, appReady = true) {
  const p = clamp(phase);
  const stage = stageFor(p);
  const complete = p >= 1 && appReady;
  return {
    contract: LOADING_PROLOGUE_CONTRACT,
    phase: p,
    stage,
    softwareFocused: p >= 0.04 && p < 0.72,
    commandIssued: p >= 0.66,
    payloadReleased: p >= 0.945,
    appReady,
    complete,
  };
}

function drawBoot(ctx, width, height, phase) {
  const alpha = 1 - smoothstep(0.055, 0.082, phase);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.screen;
  ctx.fillRect(0, 0, width, height);
  const x = width * 0.08;
  const y = height * 0.72;
  const lines = [
    ['INITIALIZING MISSION WORKSPACE', 0.010],
    ['LOADING LOCAL FLIGHT STATE', 0.020],
    ['VERIFYING SENSOR / NETWORK SERVICES', 0.031],
    ['BUILDING COMMON OPERATING PICTURE', 0.043],
  ];
  lines.forEach(([text, at], index) => {
    const a = smoothstep(at, at + 0.008, phase);
    label(ctx, text, x, y + index * 22, 9, index === lines.length - 1 ? COLORS.gold : COLORS.muted, 'left', 600, a);
  });
  label(ctx, 'PUBLIC CONCEPT / PROCEDURAL JS', width - x, height * 0.12, 8, COLORS.olive, 'right', 650, 0.7);
  ctx.restore();
}

function drawContours(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#101815';
  ctx.fillRect(x, y, w, h);
  for (let gx = x; gx <= x + w; gx += 46) line(ctx, gx, y, gx, y + h, 0.7, COLORS.grid, 1);
  for (let gy = y; gy <= y + h; gy += 46) line(ctx, x, gy, x + w, gy, 0.7, COLORS.grid, 1);

  ctx.strokeStyle = 'rgba(130,151,122,.22)';
  ctx.lineWidth = 0.8;
  for (let row = 0; row < 12; row++) {
    const baseY = y + h * (0.055 + row * 0.082);
    ctx.beginPath();
    for (let i = 0; i <= 42; i++) {
      const px = x + i / 42 * w;
      const py = baseY
        + Math.sin(i * 0.52 + row * 0.74) * (6 + row * 0.28)
        + Math.sin(i * 0.19 - row * 0.45) * 4;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(207,111,47,.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h * 0.78);
  ctx.bezierCurveTo(x + w * 0.22, y + h * 0.61, x + w * 0.36, y + h * 0.67, x + w * 0.50, y + h * 0.43);
  ctx.bezierCurveTo(x + w * 0.65, y + h * 0.22, x + w * 0.79, y + h * 0.34, x + w * 0.94, y + h * 0.17);
  ctx.stroke();

  ctx.restore();
}

function drawPlatform(ctx, x, y, selected, heading = -0.25) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.strokeStyle = selected ? COLORS.gold : COLORS.blue;
  ctx.lineWidth = selected ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8, 8);
  ctx.lineTo(0, 5);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.stroke();
  if (selected) circle(ctx, 0, 1, 15, null, COLORS.gold, 0.8, 0.55);
  ctx.restore();
}

function drawMissionMap(ctx, x, y, w, h, phase) {
  drawContours(ctx, x, y, w, h);
  const select = smoothstep(0.22, 0.28, phase);
  const route = smoothstep(0.36, 0.45, phase);
  const review = smoothstep(0.50, 0.58, phase);

  const uas = { x: x + w * 0.23, y: y + h * 0.72 };
  const sensor = { x: x + w * 0.37, y: y + h * 0.34 };
  const team = { x: x + w * 0.53, y: y + h * 0.67 };
  drawPlatform(ctx, uas.x, uas.y, select > 0.5, -0.33);
  drawPlatform(ctx, sensor.x, sensor.y, false, 0.25);
  drawPlatform(ctx, team.x, team.y, false, 0.55);
  label(ctx, 'UAS-02', uas.x + 14, uas.y - 9, 8, select > 0.5 ? COLORS.gold : COLORS.muted, 'left', 650, 0.95);
  label(ctx, 'SENSOR-1', sensor.x + 14, sensor.y - 9, 8, COLORS.muted, 'left', 650, 0.88);
  label(ctx, 'TEAM-A', team.x + 14, team.y - 9, 8, COLORS.muted, 'left', 650, 0.88);

  const contacts = [
    { x: x + w * 0.72, y: y + h * 0.30, id: 'TRACK-14' },
    { x: x + w * 0.82, y: y + h * 0.43, id: 'TRACK-15' },
  ];
  contacts.forEach(contact => {
    circle(ctx, contact.x, contact.y, 8, null, COLORS.rust, 1.2, 0.95);
    line(ctx, contact.x - 5, contact.y - 5, contact.x + 5, contact.y + 5, 1, COLORS.rust, 0.85);
    line(ctx, contact.x + 5, contact.y - 5, contact.x - 5, contact.y + 5, 1, COLORS.rust, 0.85);
    label(ctx, contact.id, contact.x + 13, contact.y, 7, COLORS.rust, 'left', 600, 0.84);
  });

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(sensor.x, sensor.y);
  ctx.lineTo(x + w * 0.63, y + h * 0.17);
  ctx.lineTo(x + w * 0.66, y + h * 0.51);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (route > 0.01) {
    ctx.save();
    ctx.globalAlpha = route * 0.92;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(uas.x, uas.y);
    ctx.bezierCurveTo(x + w * 0.34, y + h * 0.53, x + w * 0.55, y + h * 0.55, contacts[0].x, contacts[0].y);
    ctx.stroke();
    ctx.restore();
  }

  if (review > 0.01) {
    ctx.save();
    ctx.globalAlpha = review * 0.6;
    ctx.setLineDash([3, 5]);
    line(ctx, uas.x, uas.y, contacts[0].x, contacts[0].y, 1.1, COLORS.gold, 1);
    ctx.restore();
  }

  ctx.strokeStyle = COLORS.line;
  ctx.strokeRect(x, y, w, h);
}

function drawTopBar(ctx, width, phase) {
  ctx.fillStyle = '#070b0a';
  ctx.fillRect(0, 0, width, 42);
  line(ctx, 0, 42, width, 42, 1, COLORS.line, 1);
  label(ctx, 'MISSION SYSTEM / PUBLIC DEMONSTRATION', 20, 21, 9, COLORS.text, 'left', 700, 0.94);
  circle(ctx, width - 246, 21, 4, COLORS.olive, null, 0, 1);
  label(ctx, 'LINK NOMINAL', width - 236, 21, 8, COLORS.olive, 'left', 650, 0.92);
  label(ctx, stageFor(phase).replaceAll('-', ' ').toUpperCase(), width - 20, 21, 8, phase >= 0.625 ? COLORS.gold : COLORS.blue, 'right', 700, 0.94);
}

function drawAssetRail(ctx, x, y, w, h, phase) {
  panel(ctx, x, y, w, h, COLORS.panel, COLORS.line, 0);
  label(ctx, 'ASSETS', x + 14, y + 22, 8, COLORS.gold, 'left', 700, 0.9);
  const selected = phase >= 0.205;
  const rows = [
    ['UAS-02', 'AIR', 'READY'],
    ['SENSOR-1', 'ISR', 'TRACK'],
    ['TEAM-A', 'GROUND', 'LINK'],
    ['RELAY-3', 'COMMS', 'NOM'],
  ];
  rows.forEach((row, index) => {
    const ry = y + 54 + index * 48;
    if (index === 0 && selected) {
      ctx.fillStyle = 'rgba(196,154,85,.13)';
      ctx.fillRect(x + 8, ry - 18, w - 16, 38);
      line(ctx, x + 8, ry - 18, x + 8, ry + 20, 2, COLORS.gold, 1);
    }
    circle(ctx, x + 18, ry, 3, index === 0 ? COLORS.blue : COLORS.olive, null, 0, 0.95);
    label(ctx, row[0], x + 29, ry - 7, 8, index === 0 && selected ? COLORS.gold : COLORS.text, 'left', 700, 0.94);
    label(ctx, `${row[1]} / ${row[2]}`, x + 29, ry + 8, 7, COLORS.muted, 'left', 500, 0.8);
  });
  label(ctx, 'FUSED SOURCES', x + 14, y + h - 72, 7, COLORS.muted, 'left', 650, 0.72);
  label(ctx, 'EO/IR   RF   BLUE FORCE', x + 14, y + h - 51, 7, COLORS.text, 'left', 500, 0.76);
  label(ctx, '4/4 LINKS NOMINAL', x + 14, y + h - 26, 7, COLORS.olive, 'left', 650, 0.9);
}

function drawInspector(ctx, x, y, w, h, phase) {
  panel(ctx, x, y, w, h, COLORS.panel, COLORS.line, 0);
  const selected = smoothstep(0.205, 0.25, phase);
  const route = smoothstep(0.345, 0.43, phase);
  const review = smoothstep(0.485, 0.57, phase);
  const executed = phase >= 0.66;
  label(ctx, 'MISSION TASK', x + 16, y + 22, 8, COLORS.gold, 'left', 700, 0.92);
  label(ctx, 'UAS-02', x + 16, y + 54, 18, COLORS.text, 'left', 700, 0.42 + selected * 0.58);
  label(ctx, 'MULTI-SENSOR PLATFORM', x + 16, y + 76, 7, COLORS.muted, 'left', 600, 0.82);

  const fields = [
    ['TASK', route > 0.2 ? 'RECON ROUTE' : 'UNASSIGNED'],
    ['ROUTE', route > 0.65 ? 'RTE-ALPHA' : 'PENDING'],
    ['SENSOR', 'EO/IR AUTO'],
    ['LINK', 'RELAY-3'],
  ];
  fields.forEach(([name, value], index) => {
    const fy = y + 118 + index * 43;
    label(ctx, name, x + 16, fy, 7, COLORS.muted, 'left', 600, 0.75);
    label(ctx, value, x + 16, fy + 17, 9, COLORS.text, 'left', 650, 0.94);
    line(ctx, x + 16, fy + 29, x + w - 16, fy + 29, 0.7, COLORS.line, 0.72);
  });

  const buttonY = y + h - 76;
  ctx.fillStyle = executed ? 'rgba(130,144,108,.55)' : review > 0.55 ? 'rgba(196,154,85,.30)' : 'rgba(90,100,93,.15)';
  ctx.fillRect(x + 16, buttonY, w - 32, 42);
  ctx.strokeStyle = executed ? COLORS.olive : review > 0.55 ? COLORS.gold : COLORS.line;
  ctx.strokeRect(x + 16, buttonY, w - 32, 42);
  label(ctx,
    executed ? 'COMMAND SENT' : review > 0.55 ? 'EXECUTE TASK' : 'TASK INCOMPLETE',
    x + w / 2,
    buttonY + 21,
    9,
    executed ? COLORS.text : review > 0.55 ? COLORS.gold : COLORS.muted,
    'center', 700, 0.98);
  if (executed) label(ctx, 'ACK / RELAY-3 / 42 ms', x + 16, y + h - 18, 7, COLORS.olive, 'left', 650, 0.94);
}

function drawCommandLog(ctx, x, y, w, h, phase) {
  panel(ctx, x, y, w, h, '#090e0c', COLORS.line, 0);
  label(ctx, 'COMMAND LOG', x + 12, y + 15, 8, COLORS.muted, 'left', 700, 0.82);
  const events = [
    [0.09, '12:04:16', 'COP synchronized'],
    [0.23, '12:04:21', 'UAS-02 selected'],
    [0.39, '12:04:27', 'RTE-ALPHA assigned'],
    [0.53, '12:04:34', 'Task review complete'],
    [0.66, '12:04:39', 'Command acknowledged'],
  ];
  let row = 0;
  for (const [at, time, text] of events) {
    if (phase < at) continue;
    const ly = y + 35 + row * 18;
    label(ctx, time, x + 12, ly, 7, COLORS.blue, 'left', 600, 0.78);
    label(ctx, text, x + 77, ly, 7, COLORS.text, 'left', 500, 0.86);
    row++;
  }
  const pct = Math.round(clamp((phase - 0.065) / 0.645) * 100);
  label(ctx, `MISSION LOAD ${String(pct).padStart(2, '0')}%`, x + w - 12, y + 15, 7, phase >= 0.625 ? COLORS.gold : COLORS.muted, 'right', 650, 0.84);
}

function drawCursor(ctx, width, height, phase) {
  if (phase < 0.16 || phase > 0.70) return;
  const keys = [
    [0.16, 0.38, 0.48],
    [0.26, 0.14, 0.31],
    [0.40, 0.46, 0.60],
    [0.55, 0.79, 0.46],
    [0.64, 0.89, 0.81],
    [0.70, 0.89, 0.81],
  ];
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (phase >= keys[i][0] && phase <= keys[i + 1][0]) {
      a = keys[i]; b = keys[i + 1]; break;
    }
  }
  const t = smoothstep(0, 1, clamp((phase - a[0]) / Math.max(0.0001, b[0] - a[0])));
  const x = lerp(a[1], b[1], t) * width;
  const y = lerp(a[2], b[2], t) * height;
  const pressed = Math.abs(phase - 0.26) < 0.018 || Math.abs(phase - 0.40) < 0.018 || Math.abs(phase - 0.655) < 0.022;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 19);
  ctx.lineTo(5, 14);
  ctx.lineTo(10, 23);
  ctx.lineTo(14, 21);
  ctx.lineTo(9, 12);
  ctx.lineTo(16, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (pressed) circle(ctx, 1, 1, 13, null, COLORS.gold, 1.1, 0.7);
  ctx.restore();
}

function drawMissionSoftware(ctx, width, height, phase) {
  const enter = smoothstep(0.045, 0.072, phase);
  const leave = 1 - smoothstep(0.705, 0.755, phase);
  const alpha = enter * leave;
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0b1210');
  bg.addColorStop(0.55, '#111a17');
  bg.addColorStop(1, '#080d0b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawTopBar(ctx, width, phase);

  const compact = width < 800;
  const margin = compact ? 10 : Math.max(16, Math.min(28, width * 0.018));
  const top = 42 + margin;
  const bottomH = compact ? Math.max(84, height * 0.17) : Math.max(110, height * 0.18);
  const contentH = height - top - bottomH - margin * 2;
  const leftW = compact ? Math.max(116, width * 0.19) : Math.max(170, width * 0.16);
  const rightW = compact ? Math.max(150, width * 0.25) : Math.max(220, width * 0.20);
  const mapX = margin + leftW + 8;
  const mapW = width - margin * 2 - leftW - rightW - 16;

  drawAssetRail(ctx, margin, top, leftW, contentH, phase);
  drawMissionMap(ctx, mapX, top, mapW, contentH, phase);
  drawInspector(ctx, mapX + mapW + 8, top, rightW, contentH, phase);
  drawCommandLog(ctx, margin, top + contentH + 8, width - margin * 2, bottomH, phase);
  drawCursor(ctx, width, height, phase);

  label(ctx, 'OPERATOR DECISION → NETWORK EFFECT', width * 0.5, height - 12, compact ? 6 : 7, COLORS.muted, 'center', 650, 0.55);
  ctx.restore();
}

function seededStars(width, height, count) {
  const stars = [];
  let seed = 0x9e3779b9;
  for (let i = 0; i < count; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const a = (seed >>> 0) / 4294967296;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const b = (seed >>> 0) / 4294967296;
    stars.push({ x: a * width, y: b * height, r: 0.4 + ((i * 17) % 7) * 0.16 });
  }
  return stars;
}

function drawSpace(ctx, width, height, phase) {
  const alpha = smoothstep(0.72, 0.78, phase);
  if (alpha <= 0) return null;
  ctx.save();
  ctx.globalAlpha = alpha;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#020607');
  bg.addColorStop(0.62, '#081012');
  bg.addColorStop(1, '#101714');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (const star of seededStars(width, height, width < 800 ? 54 : 95)) {
    circle(ctx, star.x, star.y, star.r, 'rgba(230,236,227,.72)', null, 0, 0.7);
  }

  const earthR = Math.max(width, height) * 0.58;
  const earthX = width * 0.47;
  const earthY = height + earthR * 0.71;
  const glow = ctx.createRadialGradient(earthX, earthY - earthR * 0.46, earthR * 0.28, earthX, earthY, earthR);
  glow.addColorStop(0, '#c9d2bd');
  glow.addColorStop(0.38, '#6f7e6b');
  glow.addColorStop(0.72, '#263934');
  glow.addColorStop(1, '#08110f');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, Math.PI, TAU);
  ctx.lineTo(earthX + earthR, height + 1);
  ctx.lineTo(earthX - earthR, height + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(202,216,198,.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, Math.PI * 1.08, Math.PI * 1.91);
  ctx.stroke();

  ctx.restore();
  return { x: earthX, y: earthY, r: earthR };
}

function satellitePosition(width, height, index, phase) {
  const base = [
    [0.20, 0.27],
    [0.43, 0.15],
    [0.67, 0.24],
    [0.82, 0.40],
  ][index];
  const drift = Math.sin(phase * TAU * 0.8 + index * 1.8) * 0.008;
  return { x: width * (base[0] + drift), y: height * (base[1] - drift * 0.45) };
}

function drawSatellite(ctx, point, scale, alpha) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.globalAlpha *= alpha;
  const bodyW = 18 * scale;
  const bodyH = 10 * scale;
  const panelW = 28 * scale;
  const panelH = 12 * scale;
  ctx.fillStyle = '#9a8b70';
  ctx.strokeStyle = '#d6c7aa';
  ctx.lineWidth = 0.8;
  ctx.fillRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  ctx.strokeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  ctx.fillStyle = '#243d4b';
  ctx.fillRect(-bodyW / 2 - panelW - 4 * scale, -panelH / 2, panelW, panelH);
  ctx.fillRect(bodyW / 2 + 4 * scale, -panelH / 2, panelW, panelH);
  ctx.strokeRect(-bodyW / 2 - panelW - 4 * scale, -panelH / 2, panelW, panelH);
  ctx.strokeRect(bodyW / 2 + 4 * scale, -panelH / 2, panelW, panelH);
  circle(ctx, 0, 0, 2.4 * scale, COLORS.gold, null, 0, 1);
  line(ctx, 0, -bodyH / 2, 0, -17 * scale, 0.8, '#d6c7aa', 0.8);
  ctx.restore();
}

function pulse(ctx, a, b, t, scale, color) {
  const p = clamp(t);
  const x = lerp(a.x, b.x, p);
  const y = lerp(a.y, b.y, p);
  circle(ctx, x, y, 8 * scale, null, color, 0.7, 0.25);
  circle(ctx, x, y, 2.2 * scale, color, null, 0, 0.95);
}

function drawRelay(ctx, width, height, earth, phase) {
  if (!earth) return [];
  const alpha = smoothstep(0.755, 0.805, phase) * (1 - smoothstep(0.88, 0.94, phase));
  const points = [0, 1, 2, 3].map(index => satellitePosition(width, height, index, phase));
  const scale = Math.min(width, height) / 700;
  const ground = { x: earth.x - earth.r * 0.19, y: earth.y - earth.r * 0.80 };

  line(ctx, ground.x, ground.y, points[0].x, points[0].y, 1.0, 'rgba(196,154,85,.55)', alpha);
  for (let i = 0; i < points.length - 1; i++) {
    line(ctx, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, 1.0, 'rgba(120,149,168,.42)', alpha);
  }
  points.forEach(point => drawSatellite(ctx, point, scale, alpha));

  const relayLocal = clamp((phase - 0.765) / 0.082);
  pulse(ctx, ground, points[0], relayLocal * 4, scale, COLORS.gold);
  for (let i = 0; i < 3; i++) pulse(ctx, points[i], points[i + 1], relayLocal * 4 - (i + 1), scale, i === 1 ? COLORS.gold : COLORS.orange);

  label(ctx, 'GROUND → ORBITAL RELAY → FLIGHT VEHICLE', width * 0.5, height * 0.08, width < 800 ? 7 : 9, COLORS.muted, 'center', 650, alpha * 0.9);
  return points;
}

function drawRocket(ctx, width, height, earth, phase) {
  if (!earth) return null;
  const alpha = smoothstep(0.82, 0.86, phase) * (1 - smoothstep(0.955, 0.985, phase));
  if (alpha <= 0) return null;
  const local = smoothstep(0.82, 0.93, phase);
  const scale = Math.min(width, height) / 760;
  const x = lerp(earth.x + earth.r * 0.30, width * 0.62, local);
  const y = lerp(earth.y - earth.r * 0.74, height * 0.26, local);
  const bodyH = 138 * scale;
  const bodyW = 24 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-0.055 + local * 0.03);

  const bodyGrad = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
  bodyGrad.addColorStop(0, '#7f8580');
  bodyGrad.addColorStop(0.35, '#e9e4d9');
  bodyGrad.addColorStop(0.72, '#bfc2ba');
  bodyGrad.addColorStop(1, '#727a75');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#222b27';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -bodyH * 0.62);
  ctx.quadraticCurveTo(bodyW * 0.56, -bodyH * 0.50, bodyW * 0.54, -bodyH * 0.30);
  ctx.lineTo(bodyW * 0.54, bodyH * 0.43);
  ctx.lineTo(-bodyW * 0.54, bodyH * 0.43);
  ctx.lineTo(-bodyW * 0.54, -bodyH * 0.30);
  ctx.quadraticCurveTo(-bodyW * 0.56, -bodyH * 0.50, 0, -bodyH * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#27302d';
  ctx.fillRect(-bodyW * 0.50, bodyH * 0.18, bodyW, bodyH * 0.16);
  line(ctx, -bodyW * 0.54, -bodyH * 0.05, bodyW * 0.54, -bodyH * 0.05, 0.8, COLORS.rust, 0.75);

  const flameH = (22 + local * 68) * scale;
  const flame = ctx.createLinearGradient(0, bodyH * 0.43, 0, bodyH * 0.43 + flameH);
  flame.addColorStop(0, 'rgba(245,229,191,.95)');
  flame.addColorStop(0.30, 'rgba(220,147,62,.90)');
  flame.addColorStop(1, 'rgba(207,111,47,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.32, bodyH * 0.43);
  ctx.quadraticCurveTo(0, bodyH * 0.43 + flameH, bodyW * 0.32, bodyH * 0.43);
  ctx.closePath();
  ctx.fill();

  const separation = smoothstep(0.925, 0.965, phase);
  if (separation > 0) {
    const fairingOffset = separation * 38 * scale;
    ctx.save();
    ctx.translate(-fairingOffset, -bodyH * 0.50 - fairingOffset * 0.28);
    ctx.rotate(-separation * 0.36);
    line(ctx, 0, 0, -bodyW * 0.58, bodyH * 0.17, 4 * scale, '#bfc2ba', 0.9);
    ctx.restore();
    ctx.save();
    ctx.translate(fairingOffset, -bodyH * 0.50 - fairingOffset * 0.28);
    ctx.rotate(separation * 0.36);
    line(ctx, 0, 0, bodyW * 0.58, bodyH * 0.17, 4 * scale, '#bfc2ba', 0.9);
    ctx.restore();
  }

  ctx.restore();
  label(ctx, phase < 0.925 ? 'ASCENT / FLIGHT LINK ACTIVE' : 'PAYLOAD SEPARATION', x + 34 * scale, y - 34 * scale, width < 800 ? 7 : 8, phase < 0.925 ? COLORS.muted : COLORS.gold, 'left', 650, alpha * 0.85);
  return { x, y: y - bodyH * 0.55, scale };
}

function drawPayload(ctx, rocket, shipScreen, phase, width, height) {
  if (!rocket) return;
  const local = smoothstep(0.935, 0.997, phase);
  const target = shipScreen && Number.isFinite(shipScreen.x) && Number.isFinite(shipScreen.y)
    ? shipScreen
    : { x: width * 0.50, y: height * 0.66 };
  const x = lerp(rocket.x, target.x, local);
  const y = lerp(rocket.y, target.y, local);
  const scale = rocket.scale * lerp(0.82, 1.45, local);
  const alpha = smoothstep(0.935, 0.952, phase) * (1 - smoothstep(0.984, 1, phase));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(lerp(-0.06, 0, local));
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-25 * scale, 6 * scale);
  ctx.lineTo(-9 * scale, -10 * scale);
  ctx.lineTo(14 * scale, -7 * scale);
  ctx.lineTo(28 * scale, 6 * scale);
  ctx.lineTo(11 * scale, 12 * scale);
  ctx.lineTo(-15 * scale, 12 * scale);
  ctx.closePath();
  ctx.stroke();
  circle(ctx, 0, 3 * scale, 4 * scale, COLORS.gold, null, 0, 0.95);
  ctx.restore();
}

export function createLoadingPrologueRenderer() {
  return {
    render(ctx, width, height, phase, appReady, shipScreen) {
      const state = describeLoadingPrologue(phase, appReady);
      ctx.save();
      ctx.fillStyle = COLORS.screen;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      drawBoot(ctx, width, height, phase);
      drawMissionSoftware(ctx, width, height, phase);
      const earth = drawSpace(ctx, width, height, phase);
      const satellites = drawRelay(ctx, width, height, earth, phase);
      const rocket = drawRocket(ctx, width, height, earth, phase);
      drawPayload(ctx, rocket, shipScreen, phase, width, height);

      if (phase > 0.97) {
        const fade = smoothstep(0.97, 1, phase);
        ctx.save();
        ctx.globalAlpha = 1 - fade;
        label(ctx, appReady ? 'FLIGHT CONTROL TRANSFER' : 'WAITING FOR FLIGHT SYSTEMS', width * 0.5, height * 0.12, width < 800 ? 7 : 9, appReady ? COLORS.gold : COLORS.muted, 'center', 700, 0.9);
        ctx.restore();
      }

      return {
        ...state,
        satelliteCount: satellites.length,
        relaySequence: 'ground-to-satellite-to-satellite-to-flight-vehicle',
        transitionTarget: 'live-3d-ship-screen-position',
        visualLanguage: 'full-screen-mission-workstation-to-cinematic-launch',
      };
    },
  };
}
