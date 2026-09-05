const TAU = Math.PI * 2;
const FLAME_CONTRACT = 'canvas2d-anchored-flame-corona-v5';

const INDUSTRIAL_PALETTES = [
  { outline: [52, 35, 24], outer: [126, 54, 32], mid: [196, 88, 38], core: [232, 132, 49], accent: [103, 112, 55] },
  { outline: [42, 39, 27], outer: [96, 93, 46], mid: [177, 77, 35], core: [224, 119, 43], accent: [139, 48, 34] },
  { outline: [58, 39, 25], outer: [151, 61, 31], mid: [207, 96, 38], core: [238, 145, 54], accent: [113, 118, 58] },
  { outline: [47, 42, 30], outer: [111, 103, 49], mid: [183, 71, 34], core: [218, 112, 42], accent: [151, 51, 35] },
];

const REAR_ANCHORS = [
  ['left', .10, 1.10, 0], ['left', .28, .88, 1], ['left', .46, 1.16, 2], ['left', .66, .94, 3], ['left', .85, 1.08, 1],
  ['right', .08, 1.04, 2], ['right', .26, .92, 0], ['right', .45, 1.18, 3], ['right', .64, .90, 1], ['right', .84, 1.12, 2],
  ['top', .18, .82, 1], ['top', .42, 1.02, 3], ['top', .68, .88, 0], ['top', .86, .76, 2],
  ['bottom', .14, .80, 2], ['bottom', .38, 1.00, 0], ['bottom', .62, .86, 3], ['bottom', .84, .76, 1],
];

const FRONT_ANCHORS = [
  ['left', .18, .82, 2], ['left', .48, 1.00, 0], ['left', .76, .78, 1],
  ['right', .16, .80, 1], ['right', .44, 1.04, 2], ['right', .74, .82, 3],
  ['top', .34, .72, 0], ['top', .72, .68, 2],
  ['bottom', .26, .72, 3], ['bottom', .68, .70, 1],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotatePoint(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

function normalize(x, y) {
  const m = Math.max(0.0001, Math.hypot(x, y));
  return { x: x / m, y: y / m };
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function stateStrength(state, timeFieldStrength) {
  const base = {
    distant: 0,
    approaching: 0.20,
    arming: 0.58,
    active: 0.96,
    passing: 0.44,
  }[state] ?? 0;
  return clamp(base + (state === 'active' ? timeFieldStrength * 0.04 : 0), 0, 1);
}

function makeCanvas(className, zIndex) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: String(zIndex),
  });
  return canvas;
}

export function createBillboardSmokeRenderer({ hud, billboard, reducedMotion }) {
  const rearCanvas = makeCanvas('billboard-flame-canvas billboard-flame-canvas-rear', 1);
  const frontCanvas = makeCanvas('billboard-flame-canvas billboard-flame-canvas-front', 3);
  hud.append(rearCanvas, frontCanvas);

  const rearCtx = rearCanvas.getContext('2d', { alpha: true, desynchronized: true });
  const frontCtx = frontCanvas.getContext('2d', { alpha: true, desynchronized: true });
  let dpr = 1;
  let width = 0;
  let height = 0;
  let lastTime = performance.now();
  let phaseTime = 0;

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    dpr = Math.min(1.45, Math.max(0.8, devicePixelRatio || 1));
    for (const [canvas, ctx] of [[rearCanvas, rearCtx], [frontCanvas, frontCtx]]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function cardGeometry(screen) {
    const scale = Math.max(0.18, screen.scale);
    const yawCompression = 0.78 + Math.cos(Math.min(70, Math.abs(screen.yaw)) * Math.PI / 180) * 0.22;
    return {
      scale,
      halfW: Math.max(34, billboard.offsetWidth * scale * 0.51 * yawCompression),
      halfH: Math.max(28, billboard.offsetHeight * scale * 0.51),
      roll: screen.roll * Math.PI / 180,
    };
  }

  function anchorGeometry(screen, anchor, front) {
    const [edge, position] = anchor;
    const { scale, halfW, halfH, roll } = cardGeometry(screen);
    const inside = front ? (8 + 8 * scale) : -2;
    let ox = 0;
    let oy = 0;
    let nx = 0;
    let ny = 0;
    let tx = 0;
    let ty = 0;

    if (edge === 'left') {
      ox = -halfW + inside;
      oy = -halfH + halfH * 2 * position;
      nx = -1;
      ty = 1;
    } else if (edge === 'right') {
      ox = halfW - inside;
      oy = -halfH + halfH * 2 * position;
      nx = 1;
      ty = -1;
    } else if (edge === 'top') {
      ox = -halfW + halfW * 2 * position;
      oy = -halfH + inside;
      ny = -1;
      tx = 1;
    } else {
      ox = -halfW + halfW * 2 * position;
      oy = halfH - inside;
      ny = 1;
      tx = -1;
    }

    const p = rotatePoint(ox, oy, roll);
    const normal = rotatePoint(nx, ny, roll);
    const tangent = rotatePoint(tx, ty, roll);
    return {
      x: screen.x + p.x,
      y: screen.y + p.y,
      nx: normal.x,
      ny: normal.y,
      tx: tangent.x,
      ty: tangent.y,
      scale,
    };
  }

  function flamePath(ctx, baseX, baseY, tipX, tipY, nx, ny, widthNow, bend) {
    const axis = normalize(tipX - baseX, tipY - baseY);
    const length = Math.max(1, Math.hypot(tipX - baseX, tipY - baseY));
    const w = Math.max(1.5, widthNow);

    const leftBaseX = baseX + nx * w * .86;
    const leftBaseY = baseY + ny * w * .86;
    const rightBaseX = baseX - nx * w * .78;
    const rightBaseY = baseY - ny * w * .78;

    const leftShoulderX = baseX + axis.x * length * .24 + nx * (w * 1.10 + bend * .14);
    const leftShoulderY = baseY + axis.y * length * .24 + ny * (w * 1.10 + bend * .14);
    const leftNeckX = baseX + axis.x * length * .70 + nx * (w * .28 + bend);
    const leftNeckY = baseY + axis.y * length * .70 + ny * (w * .28 + bend);

    const rightShoulderX = baseX + axis.x * length * .22 - nx * (w * .95 - bend * .10);
    const rightShoulderY = baseY + axis.y * length * .22 - ny * (w * .95 - bend * .10);
    const rightNeckX = baseX + axis.x * length * .64 - nx * (w * .24 - bend * .66);
    const rightNeckY = baseY + axis.y * length * .64 - ny * (w * .24 - bend * .66);

    ctx.beginPath();
    ctx.moveTo(leftBaseX, leftBaseY);
    ctx.bezierCurveTo(leftShoulderX, leftShoulderY, leftNeckX, leftNeckY, tipX, tipY);
    ctx.bezierCurveTo(rightNeckX, rightNeckY, rightShoulderX, rightShoulderY, rightBaseX, rightBaseY);
    ctx.quadraticCurveTo(baseX - axis.x * w * .18, baseY - axis.y * w * .18, leftBaseX, leftBaseY);
    ctx.closePath();
  }

  function drawTongue(ctx, screen, anchor, front, strength, vanishingPoint, time, index) {
    if (strength <= 0.02) return false;
    const [edge, , size, paletteIndex] = anchor;
    const a = anchorGeometry(screen, anchor, front);
    const palette = INDUSTRIAL_PALETTES[paletteIndex % INDUSTRIAL_PALETTES.length];
    const flight = normalize(vanishingPoint.x - screen.x, vanishingPoint.y - screen.y);
    const phase = time * (front ? 5.4 : 4.2) + index * 1.17 + paletteIndex * .63;
    const flicker = .86 + Math.sin(phase) * .10 + Math.sin(phase * 1.73) * .04;
    const curl = Math.sin(phase * .78) * (front ? .20 : .15);

    const normalWeight = front ? .98 : .78;
    const flightWeight = front ? .16 : .42;
    const direction = normalize(
      a.nx * normalWeight + flight.x * flightWeight + a.tx * curl,
      a.ny * normalWeight + flight.y * flightWeight + a.ty * curl - .08,
    );

    const baseLength = (front ? 68 : 86) * size * a.scale;
    const stateLength = .34 + strength * .78;
    const length = baseLength * stateLength * flicker;
    const widthNow = (front ? 14 : 16) * size * a.scale * (.62 + strength * .46);
    const bend = Math.sin(phase * 1.13) * widthNow * (front ? .54 : .42);
    const tipX = a.x + direction.x * length + a.tx * bend;
    const tipY = a.y + direction.y * length + a.ty * bend;
    const alpha = clamp((front ? .84 : .66) * strength * (.92 + Math.sin(phase * .91) * .08), 0, .95);

    const outerGradient = ctx.createLinearGradient(a.x, a.y, tipX, tipY);
    outerGradient.addColorStop(0, rgba(palette.core, alpha));
    outerGradient.addColorStop(.24, rgba(palette.mid, alpha * .98));
    outerGradient.addColorStop(.62, rgba(palette.outer, alpha * .94));
    outerGradient.addColorStop(.88, rgba(palette.accent, alpha * .66));
    outerGradient.addColorStop(1, rgba(palette.outline, alpha * .16));

    flamePath(ctx, a.x, a.y, tipX, tipY, -direction.y, direction.x, widthNow, bend);
    ctx.fillStyle = outerGradient;
    ctx.fill();
    ctx.strokeStyle = rgba(palette.outline, alpha * .86);
    ctx.lineWidth = Math.max(1, widthNow * .10);
    ctx.lineJoin = 'round';
    ctx.stroke();

    const innerBaseX = a.x + direction.x * length * .05;
    const innerBaseY = a.y + direction.y * length * .05;
    const innerTipX = a.x + direction.x * length * .70 + a.tx * bend * .38;
    const innerTipY = a.y + direction.y * length * .70 + a.ty * bend * .38;
    const innerGradient = ctx.createLinearGradient(innerBaseX, innerBaseY, innerTipX, innerTipY);
    innerGradient.addColorStop(0, rgba(palette.core, alpha * .98));
    innerGradient.addColorStop(.48, rgba(palette.mid, alpha * .96));
    innerGradient.addColorStop(.84, rgba(palette.accent, alpha * .58));
    innerGradient.addColorStop(1, rgba(palette.outer, 0));

    flamePath(ctx, innerBaseX, innerBaseY, innerTipX, innerTipY, -direction.y, direction.x, widthNow * .43, bend * .34);
    ctx.save();
    ctx.shadowBlur = front ? 7 : 5;
    ctx.shadowColor = rgba(palette.core, alpha * .32);
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.restore();

    // A small bright root keeps every tongue visually attached to the card edge.
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.max(1.8, widthNow * .19), 0, TAU);
    ctx.fillStyle = rgba(palette.core, alpha * .90);
    ctx.fill();

    if (!front && strength > .38) {
      const sootStartX = tipX + direction.x * 3;
      const sootStartY = tipY + direction.y * 3;
      ctx.beginPath();
      ctx.moveTo(sootStartX, sootStartY);
      ctx.quadraticCurveTo(
        sootStartX + flight.x * length * .20 + a.tx * bend * .22,
        sootStartY + flight.y * length * .20 + a.ty * bend * .22,
        sootStartX + flight.x * length * .42,
        sootStartY + flight.y * length * .42,
      );
      ctx.strokeStyle = `rgba(74,70,63,${alpha * .12})`;
      ctx.lineWidth = Math.max(.7, widthNow * .08);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    return true;
  }

  function drawEdgeHeat(ctx, screen, strength) {
    if (strength < .28) return;
    const { halfW, halfH, roll } = cardGeometry(screen);
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(roll);
    ctx.strokeStyle = `rgba(177,74,36,${.08 + strength * .12})`;
    ctx.lineWidth = Math.max(1, screen.scale * 1.4);
    ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
    ctx.restore();
  }

  function render({ screen, projected, vanishingPoint, timeFieldStrength, interactionHold }) {
    const now = performance.now();
    const dt = Math.min(.05, Math.max(.001, (now - lastTime) / 1000));
    lastTime = now;
    if (rearCanvas.width === 0 || width !== innerWidth || height !== innerHeight) resize();

    const strength = stateStrength(projected.state, timeFieldStrength);
    const timeScale = reducedMotion ? 0 : (interactionHold ? .32 : (.72 + (1 - timeFieldStrength) * .34));
    phaseTime += dt * timeScale;

    rearCtx.clearRect(0, 0, width, height);
    frontCtx.clearRect(0, 0, width, height);

    drawEdgeHeat(rearCtx, screen, strength);

    let rearCount = 0;
    let frontCount = 0;
    const animationTime = reducedMotion ? 0.76 : phaseTime;

    rearCtx.save();
    rearCtx.globalCompositeOperation = 'source-over';
    REAR_ANCHORS.forEach((anchor, index) => {
      if (drawTongue(rearCtx, screen, anchor, false, strength, vanishingPoint, animationTime, index)) rearCount++;
    });
    rearCtx.restore();

    frontCtx.save();
    frontCtx.globalCompositeOperation = 'source-over';
    FRONT_ANCHORS.forEach((anchor, index) => {
      if (drawTongue(frontCtx, screen, anchor, true, strength, vanishingPoint, animationTime + .19, index + 23)) frontCount++;
    });
    frontCtx.restore();

    return {
      contract: FLAME_CONTRACT,
      renderer: 'dual-canvas-anchored-flame-corona',
      strength,
      tongueCount: rearCount + frontCount,
      rearTongueCount: rearCount,
      frontTongueCount: frontCount,
      particleCount: rearCount + frontCount,
      rearParticleCount: rearCount,
      frontParticleCount: frontCount,
      maxParticles: REAR_ANCHORS.length + FRONT_ANCHORS.length,
      rearLayer: true,
      frontLayer: true,
      pointerEvents: 'none',
    };
  }

  resize();
  return { rearCanvas, frontCanvas, render, contract: FLAME_CONTRACT };
}
