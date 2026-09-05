const TAU = Math.PI * 2;
const FLAME_CONTRACT = 'canvas2d-industrial-edge-flame-v3';
const MAX_REAR_PARTICLES = 58;
const MAX_FRONT_PARTICLES = 34;

const INDUSTRIAL_PALETTES = [
  { outer: [47, 42, 35], core: [184, 92, 46], ember: [128, 52, 34] },
  { outer: [38, 40, 34], core: [101, 112, 61], ember: [164, 92, 42] },
  { outer: [57, 44, 34], core: [198, 111, 46], ember: [139, 56, 37] },
  { outer: [43, 43, 40], core: [126, 119, 96], ember: [156, 70, 39] },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotatePoint(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

function stateStrength(state, timeFieldStrength) {
  const base = {
    distant: 0.02,
    approaching: 0.20,
    arming: 0.54,
    active: 0.90,
    passing: 0.40,
  }[state] ?? 0.03;
  const boost = state === 'active' ? timeFieldStrength * 0.08 : 0;
  return clamp(base + boost, 0.02, 1);
}

function rearEmissionRate(state, strength) {
  const base = {
    distant: 1,
    approaching: 6,
    arming: 17,
    active: 28,
    passing: 13,
  }[state] ?? 1;
  return base * (0.74 + strength * 0.48);
}

function frontEmissionRate(state, strength) {
  const base = {
    distant: 0,
    approaching: 1.5,
    arming: 10,
    active: 18,
    passing: 6,
  }[state] ?? 0;
  return base * (0.70 + strength * 0.50);
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
    dpr = Math.min(1.35, Math.max(0.8, devicePixelRatio || 1));
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
    const edge = Math.floor(Math.random() * 8);
    let ox = 0;
    let oy = 0;
    let normalX = 0;
    let normalY = 0;
    let tangentX = 0;
    let tangentY = 0;

    if (edge <= 2) {
      ox = -halfW + (layer === 'front' ? 2 : -7) * scale;
      oy = (Math.random() * 1.72 - 0.86) * halfH;
      normalX = -1;
      tangentY = 1;
    } else if (edge <= 5) {
      ox = halfW + (layer === 'front' ? -2 : 7) * scale;
      oy = (Math.random() * 1.72 - 0.86) * halfH;
      normalX = 1;
      tangentY = -1;
    } else if (edge === 6) {
      ox = (Math.random() * 1.42 - 0.71) * halfW;
      oy = -halfH + (layer === 'front' ? 2 : -6) * scale;
      normalY = -1;
      tangentX = 1;
    } else {
      ox = (Math.random() * 1.42 - 0.71) * halfW;
      oy = halfH + (layer === 'front' ? -2 : 6) * scale;
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

    const palette = INDUSTRIAL_PALETTES[Math.floor(Math.random() * INDUSTRIAL_PALETTES.length)];
    const sideNoise = (Math.random() - 0.5);
    const front = layer === 'front';
    const speed = front
      ? 28 + strength * 36 + Math.random() * 16
      : 32 + strength * 45 + Math.random() * 22;
    const tangentBias = sideNoise * (front ? 42 : 26);
    const flightBias = front ? 0.36 : 0.88;
    const outwardBias = front ? 13 + strength * 13 : 6 + strength * 8;
    const lift = front ? 16 + strength * 18 : 8 + strength * 12;

    target.push({
      layer,
      x: anchor.x,
      y: anchor.y,
      vx: flightX * speed * flightBias + anchor.tx * tangentBias + anchor.nx * outwardBias,
      vy: flightY * speed * flightBias + anchor.ty * tangentBias + anchor.ny * outwardBias - lift,
      nx: anchor.nx,
      ny: anchor.ny,
      tangentX: anchor.tx,
      tangentY: anchor.ty,
      age: 0,
      life: front
        ? 0.48 + Math.random() * 0.58 + strength * 0.16
        : 1.00 + Math.random() * 1.08 + strength * 0.28,
      width: (front ? 8 : 7) + Math.random() * (front ? 12 : 10),
      length: (front ? 27 : 34) + Math.random() * (front ? 35 : 45),
      scale: anchor.scale,
      phase: Math.random() * TAU,
      frequency: 3.0 + Math.random() * 3.4,
      curl: (front ? 28 : 19) + Math.random() * (front ? 38 : 28),
      alpha: front
        ? 0.22 + strength * 0.28 + Math.random() * 0.08
        : 0.12 + strength * 0.19 + Math.random() * 0.06,
      palette,
    });
  }

  function updateParticle(particle, dt, motionScale) {
    particle.age += dt;
    const t = clamp(particle.age / particle.life, 0, 1);
    const curl = Math.sin(particle.phase + particle.age * particle.frequency) * particle.curl;
    particle.vx += particle.tangentX * curl * dt;
    particle.vy += particle.tangentY * curl * dt - (particle.layer === 'front' ? 5.0 : 2.4) * dt;
    const damping = particle.layer === 'front' ? 0.975 : 0.985;
    particle.vx *= Math.pow(damping, dt * 60);
    particle.vy *= Math.pow(damping + 0.004, dt * 60);
    particle.x += particle.vx * dt * motionScale;
    particle.y += particle.vy * dt * motionScale;
    return t < 1;
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function drawFlameTongue(ctx, particle, strength) {
    const t = clamp(particle.age / particle.life, 0, 1);
    const fade = Math.sin(Math.PI * t) * (1 - t * 0.28);
    if (fade <= 0.001) return;

    const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
    const ux = particle.vx / speed;
    const uy = particle.vy / speed;
    const nx = -uy;
    const ny = ux;
    const wave = Math.sin(particle.phase + particle.age * particle.frequency * 1.35);
    const front = particle.layer === 'front';
    const length = particle.length * particle.scale * (front ? 0.86 : 1.08) * (0.78 + t * 0.50);
    const widthNow = particle.width * particle.scale * (front ? 1.02 : 0.90) * (0.72 + t * 0.42);
    const bend = wave * widthNow * (front ? 1.95 : 1.55);

    const tipX = particle.x;
    const tipY = particle.y;
    const baseX = tipX - ux * length;
    const baseY = tipY - uy * length;
    const controlX = tipX - ux * length * 0.48 + nx * bend;
    const controlY = tipY - uy * length * 0.48 + ny * bend;
    const alpha = particle.alpha * fade * (0.76 + strength * 0.34);

    // Soot-dark outer tongue gives the flame weight against the parchment world.
    const outerGradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    outerGradient.addColorStop(0, rgba(particle.palette.outer, alpha * 0.16));
    outerGradient.addColorStop(0.28, rgba(particle.palette.outer, alpha * 0.70));
    outerGradient.addColorStop(0.72, rgba(particle.palette.outer, alpha * 0.52));
    outerGradient.addColorStop(1, rgba(particle.palette.outer, 0));

    ctx.beginPath();
    ctx.moveTo(baseX + nx * widthNow * 0.52, baseY + ny * widthNow * 0.52);
    ctx.quadraticCurveTo(controlX + nx * widthNow * 1.10, controlY + ny * widthNow * 1.10, tipX, tipY);
    ctx.quadraticCurveTo(controlX - nx * widthNow * 0.92, controlY - ny * widthNow * 0.92, baseX - nx * widthNow * 0.52, baseY - ny * widthNow * 0.52);
    ctx.quadraticCurveTo(baseX - ux * widthNow * 0.18, baseY - uy * widthNow * 0.18, baseX + nx * widthNow * 0.52, baseY + ny * widthNow * 0.52);
    ctx.closePath();
    ctx.fillStyle = outerGradient;
    ctx.fill();

    // A narrower industrial-color core makes it read as flame rather than blur.
    const coreWidth = widthNow * (front ? 0.42 : 0.34);
    const coreLength = length * (front ? 0.76 : 0.62);
    const coreBaseX = tipX - ux * coreLength;
    const coreBaseY = tipY - uy * coreLength;
    const coreControlX = tipX - ux * coreLength * 0.48 + nx * bend * 0.52;
    const coreControlY = tipY - uy * coreLength * 0.48 + ny * bend * 0.52;
    const coreGradient = ctx.createLinearGradient(coreBaseX, coreBaseY, tipX, tipY);
    coreGradient.addColorStop(0, rgba(particle.palette.ember, alpha * 0.10));
    coreGradient.addColorStop(0.30, rgba(particle.palette.core, alpha * (front ? 0.82 : 0.48)));
    coreGradient.addColorStop(0.68, rgba(particle.palette.ember, alpha * (front ? 0.66 : 0.36)));
    coreGradient.addColorStop(1, rgba(particle.palette.core, 0));

    ctx.beginPath();
    ctx.moveTo(coreBaseX + nx * coreWidth, coreBaseY + ny * coreWidth);
    ctx.quadraticCurveTo(coreControlX + nx * coreWidth * 1.06, coreControlY + ny * coreWidth * 1.06, tipX, tipY);
    ctx.quadraticCurveTo(coreControlX - nx * coreWidth * 0.86, coreControlY - ny * coreWidth * 0.86, coreBaseX - nx * coreWidth, coreBaseY - ny * coreWidth);
    ctx.closePath();
    ctx.fillStyle = coreGradient;
    ctx.fill();

    if (!front) {
      // Rear flames dissolve into a thin grey soot tail rather than a round cloud.
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(
        baseX - ux * length * 0.32 + nx * bend * 0.34,
        baseY - uy * length * 0.32 + ny * bend * 0.34,
        baseX - ux * length * 0.58,
        baseY - uy * length * 0.58,
      );
      ctx.strokeStyle = `rgba(92,92,88,${alpha * 0.24})`;
      ctx.lineWidth = Math.max(0.7, widthNow * 0.14);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function drawReducedMotionLayer(ctx, layer, screen, vanishingPoint, strength) {
    if (strength < 0.12) return;
    const { halfW, halfH, scale } = cardGeometry(screen);
    let flightX = vanishingPoint.x - screen.x;
    let flightY = vanishingPoint.y - screen.y;
    const magnitude = Math.max(1, Math.hypot(flightX, flightY));
    flightX /= magnitude;
    flightY /= magnitude;

    const count = layer === 'front' ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const front = layer === 'front';
      const x = screen.x + side * halfW * (front ? 0.96 : 1.06);
      const y = screen.y + ((i / Math.max(1, count - 1)) - 0.5) * halfH * 1.45;
      const palette = INDUSTRIAL_PALETTES[i % INDUSTRIAL_PALETTES.length];
      drawFlameTongue(ctx, {
        layer,
        x,
        y,
        vx: flightX * 42 + side * 12,
        vy: flightY * 42 - 12,
        tangentX: side,
        tangentY: 0.3,
        age: 0.42,
        life: 1.35,
        width: front ? 10 : 8,
        length: front ? 34 : 46,
        scale,
        phase: i * 0.82,
        frequency: 2.8,
        curl: 22,
        alpha: (front ? 0.30 : 0.18) + strength * 0.14,
        palette,
      }, strength);
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
      drawReducedMotionLayer(rearCtx, 'rear', screen, vanishingPoint, strength);
      drawReducedMotionLayer(frontCtx, 'front', screen, vanishingPoint, strength);
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

      const motionScale = interactionHold ? 0.33 : (0.78 + (1 - timeFieldStrength) * 0.38);
      for (const particles of [rearParticles, frontParticles]) {
        for (let i = particles.length - 1; i >= 0; i--) {
          if (!updateParticle(particles[i], dt, motionScale)) particles.splice(i, 1);
        }
      }

      for (const particle of rearParticles) drawFlameTongue(rearCtx, particle, strength);
      for (const particle of frontParticles) drawFlameTongue(frontCtx, particle, strength);
    }

    rearCanvas.dataset.flameState = projected.state;
    frontCanvas.dataset.flameState = projected.state;
    frontCanvas.dataset.interactionHold = interactionHold ? 'true' : 'false';

    return {
      contract: FLAME_CONTRACT,
      renderer: 'dual-canvas-2d-industrial-flames',
      strength,
      particleCount: rearParticles.length + frontParticles.length,
      rearParticleCount: rearParticles.length,
      frontParticleCount: frontParticles.length,
      maxParticles: MAX_REAR_PARTICLES + MAX_FRONT_PARTICLES,
      state: projected.state,
      pointerEvents: 'none',
      frontLayer: true,
      rearLayer: true,
    };
  }

  resize();
  return {
    canvas: rearCanvas,
    rearCanvas,
    frontCanvas,
    render,
    contract: FLAME_CONTRACT,
  };
}
