const TAU = Math.PI * 2;

export const ORBITAL_HANDOFF_CONTRACT = 'command-to-orbital-payload-handoff-v1';
export const ORBITAL_HANDOFF_START = 0.300;
export const ORBITAL_HANDOFF_END = 0.455;

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
  dark: '#25302d',
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stageFor(phase) {
  if (phase < 0.16) return 'command-uplink';
  if (phase < 0.38) return 'satellite-relay';
  if (phase < 0.66) return 'launch';
  if (phase < 0.84) return 'payload-separation';
  return 'flight-handoff';
}

export function describeOrbitalHandoff(progress) {
  const wrapped = wrap01(progress);
  const active = wrapped >= ORBITAL_HANDOFF_START && wrapped <= ORBITAL_HANDOFF_END;
  if (!active) {
    return {
      contract: ORBITAL_HANDOFF_CONTRACT,
      active: false,
      phase: null,
      stage: 'inactive',
      payloadReleased: false,
      shipOpacity: 1,
    };
  }

  const phase = clamp((wrapped - ORBITAL_HANDOFF_START) / (ORBITAL_HANDOFF_END - ORBITAL_HANDOFF_START));
  return {
    contract: ORBITAL_HANDOFF_CONTRACT,
    active: true,
    phase,
    stage: stageFor(phase),
    payloadReleased: phase >= 0.78,
    shipOpacity: smoothstep(0.79, 0.96, phase),
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

function label(ctx, text, x, y, size = 9, color = COLORS.ink, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function pulseOnLine(ctx, a, b, t, radius, color, alpha) {
  const x = lerp(a.x, b.x, clamp(t));
  const y = lerp(a.y, b.y, clamp(t));
  circle(ctx, x, y, radius * 2.5, null, color, 0.7, alpha * 0.24);
  circle(ctx, x, y, radius, color, null, 0, alpha);
}

function drawEarth(ctx, width, height, phase, alpha) {
  const pullback = smoothstep(0.06, 0.34, phase);
  const radius = Math.min(width, height) * lerp(0.72, 0.34, pullback);
  const cx = width * lerp(0.52, 0.45, pullback);
  const cy = height * lerp(1.12, 0.91, pullback);

  ctx.save();
  ctx.globalAlpha *= alpha;
  const glow = ctx.createRadialGradient(cx, cy - radius * 0.18, radius * 0.3, cx, cy, radius * 1.08);
  glow.addColorStop(0, 'rgba(240,227,197,.94)');
  glow.addColorStop(0.58, 'rgba(142,151,118,.88)');
  glow.addColorStop(1, 'rgba(45,62,58,.98)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, TAU);
  ctx.lineTo(cx + radius, height + 2);
  ctx.lineTo(cx - radius, height + 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(240,227,197,.34)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * (0.48 + i * 0.12), radius * (0.18 + i * 0.04), -0.12, Math.PI, TAU);
    ctx.stroke();
  }
  ctx.restore();
  return { cx, cy, radius };
}

function satellitePoint(width, height, index, phase) {
  const base = [
    [0.24, 0.27],
    [0.48, 0.16],
    [0.72, 0.28],
    [0.82, 0.48],
  ][index];
  const drift = Math.sin(phase * TAU * 0.72 + index * 1.4) * 0.012;
  return { x: width * (base[0] + drift), y: height * (base[1] - drift * 0.45) };
}

function drawSatellite(ctx, point, scale, index, alpha) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(-0.18 + index * 0.09);
  ctx.globalAlpha *= alpha;

  ctx.fillStyle = COLORS.paperDeep;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.fillRect(-9 * scale, -6 * scale, 18 * scale, 12 * scale);
  ctx.strokeRect(-9 * scale, -6 * scale, 18 * scale, 12 * scale);

  ctx.fillStyle = 'rgba(76,99,120,.58)';
  for (const side of [-1, 1]) {
    ctx.fillRect(side * 12 * scale - (side < 0 ? 19 * scale : 0), -7 * scale, 19 * scale, 14 * scale);
    ctx.strokeRect(side * 12 * scale - (side < 0 ? 19 * scale : 0), -7 * scale, 19 * scale, 14 * scale);
  }
  circle(ctx, 0, 0, 2.8 * scale, COLORS.gold, COLORS.ink, 0.7, 1);
  line(ctx, 0, -6 * scale, 0, -14 * scale, 1, COLORS.ink, 0.8);
  ctx.restore();
}

function drawNetwork(ctx, width, height, phase, compact, alpha) {
  const reveal = smoothstep(0.12, 0.38, phase);
  const points = [0, 1, 2, 3].map(index => satellitePoint(width, height, index, phase));
  const scale = Math.min(width, height) / (compact ? 430 : 620);

  ctx.save();
  ctx.globalAlpha *= alpha * reveal;
  const segments = [[0, 1], [1, 2], [2, 3]];
  segments.forEach(([a, b], index) => {
    const pa = points[a];
    const pb = points[b];
    line(ctx, pa.x, pa.y, pb.x, pb.y, 1, index === 1 ? COLORS.gold : COLORS.blue, 0.42);
    const local = clamp((phase - (0.16 + index * 0.055)) / 0.12);
    pulseOnLine(ctx, pa, pb, local, 2.3 * scale, index === 1 ? COLORS.gold : COLORS.fox, 0.95);
  });

  points.forEach((point, index) => drawSatellite(ctx, point, scale, index, 0.94));
  label(ctx, 'ORBITAL RELAY / PUBLIC CONCEPT', width * 0.5, height * (compact ? 0.08 : 0.09), compact ? 7 : 9, COLORS.olive, 'center', 0.9);
  ctx.restore();
  return points;
}

function drawRocket(ctx, width, height, earth, phase, compact, alpha) {
  const launch = smoothstep(0.28, 0.70, phase);
  const separate = smoothstep(0.66, 0.84, phase);
  const x = lerp(earth.cx + earth.radius * 0.34, width * 0.61, launch);
  const y = lerp(earth.cy - earth.radius * 0.25, height * 0.31, launch);
  const scale = Math.min(width, height) / (compact ? 430 : 620);
  const body = 72 * scale;
  const bodyW = 19 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.20 + launch * 0.08);
  ctx.globalAlpha *= alpha * smoothstep(0.24, 0.40, phase) * (1 - smoothstep(0.83, 0.98, phase));

  ctx.fillStyle = COLORS.paperLight;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -body * 0.62);
  ctx.lineTo(bodyW * 0.54, -body * 0.40);
  ctx.lineTo(bodyW * 0.54, body * 0.46);
  ctx.lineTo(-bodyW * 0.54, body * 0.46);
  ctx.lineTo(-bodyW * 0.54, -body * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  line(ctx, -bodyW * 0.54, body * 0.05, bodyW * 0.54, body * 0.05, 1, COLORS.rust, 0.7);
  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(-bodyW * 0.48, body * 0.28, bodyW * 0.96, body * 0.16);

  const plume = (14 + 42 * launch) * scale;
  const flicker = 0.82 + Math.sin(phase * 54) * 0.18;
  ctx.fillStyle = `rgba(207,111,47,${0.65 * flicker})`;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.35, body * 0.46);
  ctx.quadraticCurveTo(0, body * 0.46 + plume, bodyW * 0.35, body * 0.46);
  ctx.closePath();
  ctx.fill();

  if (separate > 0.01) {
    const fairing = 18 * scale * separate;
    ctx.save();
    ctx.translate(0, -body * 0.48);
    ctx.rotate(-0.45 * separate);
    line(ctx, -2 * scale, 0, -fairing, -11 * scale, 2.2 * scale, COLORS.paperDeep, 0.85);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -body * 0.48);
    ctx.rotate(0.45 * separate);
    line(ctx, 2 * scale, 0, fairing, -11 * scale, 2.2 * scale, COLORS.paperDeep, 0.85);
    ctx.restore();
  }

  ctx.restore();
  label(ctx, phase < 0.66 ? 'LAUNCH VEHICLE / ASCENT' : 'PAYLOAD SEPARATION', x + 28 * scale, y - 26 * scale, compact ? 7 : 8, COLORS.rust, 'left', 0.82);
  return { x, y: y - body * 0.52, scale };
}

function drawGroundUplink(ctx, width, height, earth, satellite, phase, alpha) {
  const send = smoothstep(0.02, 0.21, phase);
  const ground = { x: earth.cx - earth.radius * 0.17, y: earth.cy - earth.radius * 0.33 };
  line(ctx, ground.x, ground.y, satellite.x, satellite.y, 1.2, COLORS.fox, alpha * 0.5 * send);
  pulseOnLine(ctx, ground, satellite, send, 2.1, COLORS.gold, alpha * 0.9);
  label(ctx, phase < 0.13 ? 'TASK ACKNOWLEDGED' : 'UPLINK', ground.x - 10, ground.y - 15, 8, COLORS.rust, 'right', alpha * send);
}

function drawRocketRelay(ctx, satellite, rocket, phase, alpha) {
  const send = smoothstep(0.38, 0.62, phase);
  line(ctx, satellite.x, satellite.y, rocket.x, rocket.y, 1.2, COLORS.gold, alpha * 0.42 * send);
  pulseOnLine(ctx, satellite, rocket, send, 2.2, COLORS.fox, alpha * 0.92);
  label(ctx, 'FLIGHT LINK', lerp(satellite.x, rocket.x, 0.5), lerp(satellite.y, rocket.y, 0.5) - 11, 8, COLORS.gold, 'center', alpha * send);
}

function drawPayloadHandoff(ctx, width, height, rocket, shipScreen, phase, compact, alpha) {
  const handoff = smoothstep(0.72, 0.98, phase);
  const target = shipScreen && Number.isFinite(shipScreen.x) && Number.isFinite(shipScreen.y)
    ? shipScreen
    : { x: width * 0.50, y: height * 0.68 };
  const x = lerp(rocket.x, target.x, handoff);
  const y = lerp(rocket.y, target.y, handoff);
  const scale = Math.min(width, height) / (compact ? 430 : 620);
  const fade = 1 - smoothstep(0.90, 1.0, phase);

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha * smoothstep(0.69, 0.79, phase) * fade;
  ctx.rotate(-0.18 + handoff * 0.18);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-20 * scale, 4 * scale);
  ctx.lineTo(-8 * scale, -8 * scale);
  ctx.lineTo(13 * scale, -5 * scale);
  ctx.lineTo(23 * scale, 5 * scale);
  ctx.lineTo(10 * scale, 10 * scale);
  ctx.lineTo(-13 * scale, 10 * scale);
  ctx.closePath();
  ctx.stroke();
  circle(ctx, 0, 2 * scale, 3.5 * scale, COLORS.fox, COLORS.ink, 0.8, 0.9);
  ctx.restore();

  const ringAlpha = smoothstep(0.82, 0.95, phase) * (1 - smoothstep(0.96, 1.0, phase));
  circle(ctx, target.x, target.y, 30 * scale * (1 + ringAlpha * 0.4), null, COLORS.gold, 1.1, alpha * ringAlpha);
  label(ctx, phase < 0.88 ? 'PAYLOAD / FLIGHT VEHICLE' : 'FLIGHT CONTROL HANDOFF', target.x, target.y + 48 * scale, compact ? 7 : 8, COLORS.olive, 'center', alpha * ringAlpha);
}

export function createOrbitalHandoffRenderer() {
  return {
    render(ctx, width, height, progress, now, degraded = false, shipScreen = null) {
      const state = describeOrbitalHandoff(progress);
      if (!state.active) return state;

      const phase = state.phase;
      const compact = width <= 720;
      const edge = smoothstep(0, 0.055, phase) * (1 - smoothstep(0.94, 1, phase));
      const backdrop = smoothstep(0.04, 0.28, phase) * (1 - smoothstep(0.90, 1, phase));

      ctx.save();
      ctx.globalAlpha = edge;
      if (backdrop > 0.01) {
        const space = ctx.createLinearGradient(0, 0, 0, height);
        space.addColorStop(0, `rgba(29,39,38,${0.82 * backdrop})`);
        space.addColorStop(1, `rgba(55,65,54,${0.42 * backdrop})`);
        ctx.fillStyle = space;
        ctx.fillRect(0, 0, width, height);

        const starCount = degraded ? 28 : 52;
        ctx.fillStyle = COLORS.paperLight;
        for (let i = 0; i < starCount; i++) {
          const sx = ((i * 71 + 19) % 997) / 997 * width;
          const sy = ((i * 131 + 37) % 991) / 991 * height * 0.72;
          ctx.globalAlpha = edge * backdrop * (0.15 + (i % 5) * 0.055);
          ctx.fillRect(sx, sy, i % 7 === 0 ? 1.4 : 0.8, i % 7 === 0 ? 1.4 : 0.8);
        }
        ctx.globalAlpha = edge;
      }

      const earth = drawEarth(ctx, width, height, phase, 0.96);
      const satellites = drawNetwork(ctx, width, height, phase, compact || degraded, 1);
      drawGroundUplink(ctx, width, height, earth, satellites[0], phase, 1);
      const rocket = drawRocket(ctx, width, height, earth, phase, compact, 1);
      drawRocketRelay(ctx, satellites[2], rocket, phase, 1);
      drawPayloadHandoff(ctx, width, height, rocket, shipScreen, phase, compact, 1);

      const arcAlpha = smoothstep(0.03, 0.15, phase) * (1 - smoothstep(0.90, 0.99, phase));
      label(ctx,
        compact ? 'COMMAND → ORBIT → FLIGHT' : 'HUMAN COMMAND → NETWORK → LAUNCH → FLIGHT',
        width * 0.5,
        height * (compact ? 0.79 : 0.84),
        compact ? 8 : 10,
        COLORS.rust,
        'center',
        arcAlpha);
      ctx.restore();

      return {
        ...state,
        satelliteCount: degraded ? 4 : 4,
        relaySequence: 'ground-to-sat-to-sat-to-vehicle',
        transitionTarget: shipScreen ? 'live-3d-ship-screen-position' : 'fallback-flight-center',
      };
    },
  };
}
