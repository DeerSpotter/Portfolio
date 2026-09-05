const TAU = Math.PI * 2;
const FLAME_CONTRACT = 'canvas2d-defined-industrial-flame-v4';
const MAX_REAR_PARTICLES = 42;
const MAX_FRONT_PARTICLES = 28;

const INDUSTRIAL_PALETTES = [
  { outer: [52, 38, 28], mid: [159, 70, 38], core: [222, 126, 48], accent: [111, 120, 62] },
  { outer: [40, 43, 31], mid: [111, 119, 58], core: [190, 105, 38], accent: [144, 51, 35] },
  { outer: [58, 41, 29], mid: [181, 78, 38], core: [229, 139, 54], accent: [128, 65, 37] },
  { outer: [49, 48, 34], mid: [126, 122, 61], core: [202, 91, 40], accent: [153, 54, 36] },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotatePoint(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function stateStrength(state, timeFieldStrength) {
  const base = {
    distant: 0.015,
    approaching: 0.18,
    arming: 0.56,
    active: 0.94,
    passing: 0.42,
  }[state] ?? 0.02;
  return clamp(base + (state === 'active' ? timeFieldStrength * 0.06 : 0), 0.01, 1);
}

function rearEmissionRate(state, strength) {
  const base = { distant: 0, approaching: 4, arming: 13, active: 20, passing: 9 }[state] ?? 0;
  return base * (0.78 + strength * 0.44);
}

function frontEmissionRate(state, strength) {
  const base = { distant: 0, approaching: 1, arming: 7, active: 13, passing: 4 }[state] ?? 0;
  return base * (0.76 + strength * 0.46);
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
  const rearParticles = [];
  const frontParticles = [];

  let dpr = 1;
  let width = 0;
  let height = 0;
  let lastTime = performance.now();
  let rearCarry = 0;
  let frontCarry = 0;
  let lastStopTitle = '';
  let lastCenter = null;

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    dpr = Math.min(1.4, Math.max(0.8, devicePixelRatio || 1));
    for (const [canvas, ctx] of [[rearCanvas, rearCtx], [frontCanvas, frontCtx]]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function clearParticles() {
    rearParticles.length = 0;
    frontParticles.length = 0;
    rearCarry = 0;
    frontCarry = 0;
  }

  function cardGeometry(screen) {
    const scale = Math.max(0.18, screen.scale);
    const yawCompression = 0.78 + Math.cos(Math.min(70, Math.abs(screen.yaw)) * Math.PI / 180) * 0.22;
    return {
      scale,
      halfW: Math.max(34, billboard.offsetWidth * scale * 0.51 * yawCompression),
      halfH: Math.max(28, billboard.offsetHeight * scale * 0.51),
    };
  }

  function edgeAnchor(screen, layer) {
    const { scale, halfW, halfH } = cardGeometry(screen);
    const front = layer === 'front';
    const edgePick = Math.random();
    const edge = edgePick < 0.39 ? 'left'
      : edgePick < 0.78 ? 'right'
        : edgePick < 0.89 ? 'top'
          : 'bottom';

    let ox = 0;
    let oy = 0;
    let normalX = 0;
    let normalY = 0;
    let tangentX = 0;
    let tangentY = 0;
    const inset = front ? (6 + Math.random() * 12) * scale : -(5 + Math.random() * 8) * scale;

    if (edge === 'left') {
      ox = -halfW + inset;
      oy = (Math.random() * 1.74 - 0.87) * halfH;
      normalX = -1;
      tangentY = 1;
    } else if (edge === 'right') {
      ox = halfW - inset;
      oy = (Math.random() * 1.74 - 0.87) * halfH;
      normalX = 1;
      tangentY = -1;
    } else if (edge === 'top') {
      ox = (Math.random() * 1.48 - 0.74) * halfW;
      oy = -halfH + inset;
      normalY = -1;
      tangentX = 1;
    } else {
      ox = (Math.random() * 1.48 - 0.74) * halfW;
      oy = halfH - inset;
      normalY = 1;
      tangentX = -1;
    }

    const angle = screen.roll * Math.PI / 180;
    const rotated = rotatePoint(ox, oy, angle);
    const normal = rotatePoint(normalX, normalY, angle);
    const tangent = rotatePoint(tangentX, tangentY, angle);
    return {
      x: screen.x + rotated.x,
      y: screen.y + rotated.y,
      nx: normal.x,
      ny: normal.y,
      tx: tangent.x,
      ty: tangent.y,
      scale,
      edge,
    };
  }

  function spawn(screen, projected, vanishingPoint, strength, layer) {
    const target = layer === 'front' ? frontParticles : rearParticles;
    const max = layer === 'front' ? MAX_FRONT_PARTICLES : MAX_REAR_PARTICLES;
    if (target.length >= max) return;

    const anchor = edgeAnchor(screen, layer);
    let flightX = vanishingPoint.x - screen.x;
    let flightY = vanishingPoint.y - screen.y;
    const flightMagnitude = Math.max(1, Math.hypot(flightX, flightY));
    flightX /= flightMagnitude;
    flightY /= flightMagnitude;

    const front = layer === 'front';
    const palette = INDUSTRIAL_PALETTES[Math.floor(Math.random() * INDUSTRIAL_PALETTES.length)];
    const jitter = Math.random() - 0.5;
    const speed = front ? 24 + strength * 28 + Math.random() * 12 : 30 + strength * 34 + Math.random() * 18;
    const outward = front ? 28 + strength * 22 : 18 + strength * 14;
    const tangent = jitter * (front ? 24 : 18);
    const flightBias = front ? 0.24 : 0.64;

    target.push({
      layer,
      x: anchor.x,
      y: anchor.y,
      vx: anchor.nx * outward + anchor.tx * tangent + flightX * speed * flightBias,
      vy: anchor.ny * outward + anchor.ty * tangent + flightY * speed * flightBias - (front ? 18 : 10),
      tangentX: anchor.tx,
      tangentY: anchor.ty,
      age: 0,
      life: front ? 0.55 + Math.random() * 0.42 : 0.90 + Math.random() * 0.72,
      width: (front ? 10 : 9) + Math.random() * (front ? 9 : 8),
      length: (front ? 48 : 58) + Math.random() * (front ? 28 : 38),
      scale: anchor.scale,
      phase: Math.random() * TAU,
      frequency: 4.4 + Math.random() * 2.5,
      curl: (front ? 18 : 14) + Math.random() * (front ? 16 : 12),
      alpha: front ? 0.66 + strength * 0.22 : 0.42 + strength * 0.20,
      palette,
      front,
    });
  }

  function updateParticle(particle, dt, motionScale) {
    particle.age += dt;
    const curl = Math.sin(particle.phase + particle.age * particle.frequency) * particle.curl;
    particle.vx += particle.tangentX * curl * dt;
    particle.vy += particle.tangentY * curl * dt - (particle.front ? 7.0 : 3.4) * dt;
    const damping = particle.front ? 0.978 : 0.986;
    particle.vx *= Math.pow(damping, dt * 60);
    particle.vy *= Math.pow(damping + 0.003, dt * 60);
    particle.x += particle.vx * dt * motionScale;
    particle.y += particle.vy * dt * motionScale;
    return particle.age < particle.life;
  }

  function flamePath(ctx, baseX, baseY, tipX, tipY, nx, ny, widthNow, bend, inset = 0) {
    const ux = tipX - baseX;
    const uy = tipY - baseY;
    const len = Math.max(1, Math.hypot(ux, uy));
    const dx = ux / len;
    const dy = uy / len;
    const w = Math.max(1, widthNow - inset);

    const shoulder1X = baseX + dx * len * 0.22 + nx * (w * 0.92 + bend * 0.18);
    const shoulder1Y = baseY + dy * len * 0.22 + ny * (w * 0.92 + bend * 0.18);
    const neck1X = baseX + dx * len * 0.66 + nx * (w * 0.34 + bend);
    const neck1Y = baseY + dy * len * 0.66 + ny * (w * 0.34 + bend);
    const shoulder2X = baseX + dx * len * 0.23 - nx * (w * 0.76 - bend * 0.12);
    const shoulder2Y = baseY + dy * len * 0.23 - ny * (w * 0.76 - bend * 0.12);
    const neck2X = baseX + dx * len * 0.62 - nx * (w * 0.28 - bend * 0.72);
    const neck2Y = baseY + dy * len * 0.62 - ny * (w * 0.28 - bend * 0.72);

    ctx.beginPath();
    ctx.moveTo(baseX + nx * w * 0.74, baseY + ny * w * 0.74);
    ctx.bezierCurveTo(shoulder1X, shoulder1Y, neck1X, neck1Y, tipX, tipY);
    ctx.bezierCurveTo(neck2X, neck2Y, shoulder2X, shoulder2Y, baseX - nx * w * 0.68, baseY - ny * w * 0.68);
    ctx.quadraticCurveTo(baseX - dx * w * 0.26, baseY - dy * w * 0.26, baseX + nx * w * 0.74, baseY + ny * w * 0.74);
    ctx.closePath();
  }

  function drawDefinedFlame(ctx, particle, strength) {
    const t = clamp(particle.age / particle.life, 0, 1);
    const grow = clamp(t / 0.16, 0, 1);
    const fade = 1 - Math.pow(clamp((t - 0.62) / 0.38, 0, 1), 1.35);
    const pulse = 0.92 + Math.sin(particle.phase + particle.age * particle.frequency * 1.8) * 0.08;
    const alpha = particle.alpha * grow * fade * pulse;
    if (alpha <= 0.01) return;

    const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
    const ux = particle.vx / speed;
    const uy = particle.vy / speed;
    const nx = -uy;
    const ny = ux;
    const front = particle.front;
    const length = particle.length * particle.scale * (front ? 0.92 : 1.06) * (0.82 + t * 0.38);
    const widthNow = particle.width * particle.scale * (front ? 1.06 : 0.96) * (0.92 - t * 0.22);
    const bend = Math.sin(particle.phase + particle.age * particle.frequency) * widthNow * (front ? 0.72 : 0.58);

    const baseX = particle.x;
    const baseY = particle.y;
    const tipX = baseX + ux * length + nx * bend;
    const tipY = baseY + uy * length + ny * bend;

    // Crisp dark silhouette. This is intentionally opaque enough to read as flame,
    // not translucent smoke or a feather.
    const outerGradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    outerGradient.addColorStop(0, rgba(particle.palette.outer, alpha * 0.96));
    outerGradient.addColorStop(0.44, rgba(particle.palette.mid, alpha * 0.90));
    outerGradient.addColorStop(0.82, rgba(particle.palette.accent, alpha * 0.58));
    outerGradient.addColorStop(1, rgba(particle.palette.outer, alpha * 0.10));
    flamePath(ctx, baseX, baseY, tipX, tipY, nx, ny, widthNow, bend);
    ctx.fillStyle = outerGradient;
    ctx.fill();
    ctx.strokeStyle = rgba(particle.palette.outer, alpha * 0.78);
    ctx.lineWidth = Math.max(0.8, widthNow * 0.09);
    ctx.stroke();

    // Bright inner tongue gives a defined hot core.
    const innerLength = length * 0.72;
    const innerBaseX = baseX + ux * length * 0.08;
    const innerBaseY = baseY + uy * length * 0.08;
    const innerTipX = innerBaseX + ux * innerLength + nx * bend * 0.46;
    const innerTipY = innerBaseY + uy * innerLength + ny * bend * 0.46;
    const innerGradient = ctx.createLinearGradient(innerBaseX, innerBaseY, innerTipX, innerTipY);
    innerGradient.addColorStop(0, rgba(particle.palette.core, alpha * 0.96));
    innerGradient.addColorStop(0.46, rgba(particle.palette.mid, alpha * 0.94));
    innerGradient.addColorStop(0.86, rgba(particle.palette.accent, alpha * 0.66));
    innerGradient.addColorStop(1, rgba(particle.palette.core, 0));
    flamePath(ctx, innerBaseX, innerBaseY, innerTipX, innerTipY, nx, ny, widthNow * 0.46, bend * 0.42);
    ctx.fillStyle = innerGradient;
    ctx.fill();

    // Small ember kernel right on the card edge makes the source of each tongue obvious.
    const emberRadius = Math.max(1.6, widthNow * (front ? 0.22 : 0.16));
    ctx.beginPath();
    ctx.arc(baseX, baseY, emberRadius, 0, TAU);
    ctx.fillStyle = rgba(particle.palette.core, alpha * (front ? 0.82 : 0.58));
    ctx.fill();

    if (!front && t > 0.34) {
      const sootAlpha = alpha * (0.16 + t * 0.10);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(
        tipX + ux * length * 0.22 + nx * bend * 0.35,
        tipY + uy * length * 0.22 + ny * bend * 0.35,
        tipX + ux * length * 0.46,
        tipY + uy * length * 0.46,
      );
      ctx.strokeStyle = `rgba(78,74,68,${sootAlpha})`;
      ctx.lineWidth = Math.max(0.7, widthNow * 0.10);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function drawStaticFlames(ctx, screen, layer, strength) {
    if (strength < 0.12) return;
    const { halfW, halfH, scale } = cardGeometry(screen);
    const front = layer === 'front';
    const count = front ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = screen.x + side * (halfW - (front ? 9 : -5) * scale);
      const y = screen.y + ((i / Math.max(1, count - 1)) - 0.5) * halfH * 1.55;
      const palette = INDUSTRIAL_PALETTES[i % INDUSTRIAL_PALETTES.length];
      const particle = {
        front,
        x,
        y,
        vx: side * (front ? 38 : 30),
        vy: -24 - i * 1.5,
        age: 0.22,
        life: 0.85,
        width: front ? 13 : 11,
        length: front ? 58 : 72,
        scale,
        phase: i * 0.84,
        frequency: 5.2,
        alpha: front ? 0.72 : 0.48,
        palette,
      };
      drawDefinedFlame(ctx, particle, strength);
    }
  }

  function render({ screen, projected, vanishingPoint, timeFieldStrength, stopTitle, interactionHold }) {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (rearCanvas.width === 0 || width !== innerWidth || height !== innerHeight) resize();

    const strength = stateStrength(projected.state, timeFieldStrength);
    const movedFar = lastCenter && Math.hypot(screen.x - lastCenter.x, screen.y - lastCenter.y) > Math.max(innerWidth, innerHeight) * 0.32;
    if (stopTitle !== lastStopTitle || movedFar) clearParticles();
    lastStopTitle = stopTitle;
    lastCenter = { x: screen.x, y: screen.y };

    rearCtx.clearRect(0, 0, width, height);
    frontCtx.clearRect(0, 0, width, height);

    if (reducedMotion) {
      clearParticles();
      drawStaticFlames(rearCtx, screen, 'rear', strength);
      drawStaticFlames(frontCtx, screen, 'front', strength);
    } else {
      rearCarry += rearEmissionRate(projected.state, strength) * dt;
      frontCarry += frontEmissionRate(projected.state, strength) * dt;
      while (rearCarry >= 1 && rearParticles.length < MAX_REAR_PARTICLES) {
        spawn(screen, projected, vanishingPoint, strength, 'rear');
        rearCarry -= 1;
      }
      while (frontCarry >= 1 && frontParticles.length < MAX_FRONT_PARTICLES) {
        spawn(screen, projected, vanishingPoint, strength, 'front');
        frontCarry -= 1;
      }

      const motionScale = interactionHold ? 0.42 : (0.82 + (1 - timeFieldStrength) * 0.28);
      for (let i = rearParticles.length - 1; i >= 0; i--) {
        if (!updateParticle(rearParticles[i], dt, motionScale)) rearParticles.splice(i, 1);
      }
      for (let i = frontParticles.length - 1; i >= 0; i--) {
        if (!updateParticle(frontParticles[i], dt, motionScale)) frontParticles.splice(i, 1);
      }

      rearCtx.save();
      rearCtx.globalCompositeOperation = 'source-over';
      for (const particle of rearParticles) drawDefinedFlame(rearCtx, particle, strength);
      rearCtx.restore();

      frontCtx.save();
      frontCtx.globalCompositeOperation = 'source-over';
      for (const particle of frontParticles) drawDefinedFlame(frontCtx, particle, strength);
      frontCtx.restore();
    }

    return {
      contract: FLAME_CONTRACT,
      renderer: 'dual-canvas-defined-industrial-flames',
      strength,
      particleCount: rearParticles.length + frontParticles.length,
      rearParticleCount: rearParticles.length,
      frontParticleCount: frontParticles.length,
      maxParticles: MAX_REAR_PARTICLES + MAX_FRONT_PARTICLES,
      rearLayer: true,
      frontLayer: true,
      pointerEvents: 'none',
    };
  }

  resize();
  return { rearCanvas, frontCanvas, render, contract: FLAME_CONTRACT };
}
