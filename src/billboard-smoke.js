const TAU = Math.PI * 2;
const SMOKE_CONTRACT = 'canvas2d-charcoal-wisp-smoke-v2';
const MAX_PARTICLES = 64;

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
    distant: 0.025,
    approaching: 0.22,
    arming: 0.56,
    active: 0.88,
    passing: 0.42,
  }[state] ?? 0.03;
  const boost = state === 'active' ? timeFieldStrength * 0.10 : 0;
  return clamp(base + boost, 0.02, 1);
}

function emissionRate(state, strength) {
  const base = {
    distant: 1.5,
    approaching: 8,
    arming: 22,
    active: 38,
    passing: 18,
  }[state] ?? 2;
  return base * (0.72 + strength * 0.55);
}

export function createBillboardSmokeRenderer({ hud, billboard, reducedMotion }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'billboard-smoke-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '1',
    mixBlendMode: 'multiply',
  });
  hud.append(canvas);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const particles = [];
  let dpr = 1;
  let width = 0;
  let height = 0;
  let lastTime = performance.now();
  let emissionCarry = 0;
  let lastStopTitle = '';
  let lastCenter = null;

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    dpr = Math.min(1.35, Math.max(0.8, devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clearParticles() {
    particles.length = 0;
    emissionCarry = 0;
  }

  function spawn(screen, projected, vanishingPoint, strength) {
    if (particles.length >= MAX_PARTICLES) return;

    const scale = Math.max(0.18, screen.scale);
    const halfW = Math.max(34, billboard.offsetWidth * scale * 0.53);
    const halfH = Math.max(28, billboard.offsetHeight * scale * 0.53);
    const edge = Math.floor(Math.random() * 8);
    let ox = 0;
    let oy = 0;

    if (edge <= 2) {
      ox = -halfW - 7 * scale;
      oy = (Math.random() * 1.8 - 0.9) * halfH;
    } else if (edge <= 5) {
      ox = halfW + 7 * scale;
      oy = (Math.random() * 1.8 - 0.9) * halfH;
    } else if (edge === 6) {
      ox = (Math.random() * 1.5 - 0.75) * halfW;
      oy = -halfH - 6 * scale;
    } else {
      ox = (Math.random() * 1.5 - 0.75) * halfW;
      oy = halfH + 6 * scale;
    }

    const rotated = rotatePoint(ox, oy, screen.roll * Math.PI / 180);
    const x = screen.x + rotated.x;
    const y = screen.y + rotated.y;

    let tx = vanishingPoint.x - screen.x;
    let ty = vanishingPoint.y - screen.y;
    const tm = Math.max(1, Math.hypot(tx, ty));
    tx /= tm;
    ty /= tm;
    const nx = -ty;
    const ny = tx;

    const speed = 34 + strength * 54 + Math.random() * 24;
    const curlBias = (Math.random() - 0.5) * (28 + strength * 30);
    const rise = 8 + strength * 18;
    const shade = 18 + Math.floor(Math.random() * 74);

    particles.push({
      x,
      y,
      vx: tx * speed + nx * curlBias,
      vy: ty * speed + ny * curlBias - rise,
      nx,
      ny,
      age: 0,
      life: 1.05 + Math.random() * 1.25 + strength * 0.40,
      width: (7 + Math.random() * 10) * (0.7 + scale * 0.42),
      length: (30 + Math.random() * 40) * (0.75 + scale * 0.36),
      shade,
      phase: Math.random() * TAU,
      frequency: 2.2 + Math.random() * 2.8,
      curl: 18 + Math.random() * 28,
      alpha: 0.12 + strength * 0.22 + Math.random() * 0.08,
    });
  }

  function updateParticle(particle, dt, motionScale) {
    particle.age += dt;
    const t = clamp(particle.age / particle.life, 0, 1);
    const curl = Math.sin(particle.phase + particle.age * particle.frequency) * particle.curl;
    particle.vx += particle.nx * curl * dt;
    particle.vy += particle.ny * curl * dt - 2.8 * dt;
    particle.vx *= Math.pow(0.985, dt * 60);
    particle.vy *= Math.pow(0.987, dt * 60);
    particle.x += particle.vx * dt * motionScale;
    particle.y += particle.vy * dt * motionScale;
    return t < 1;
  }

  function drawWisp(particle, strength) {
    const t = clamp(particle.age / particle.life, 0, 1);
    const fade = Math.sin(Math.PI * t) * (1 - t * 0.38);
    if (fade <= 0.001) return;

    const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
    const ux = particle.vx / speed;
    const uy = particle.vy / speed;
    const nx = -uy;
    const ny = ux;
    const wave = Math.sin(particle.phase + particle.age * particle.frequency * 1.4);
    const length = particle.length * (0.62 + t * 0.92);
    const widthNow = particle.width * (0.68 + t * 0.94);
    const bend = wave * widthNow * 1.65;

    const headX = particle.x;
    const headY = particle.y;
    const tailX = headX - ux * length;
    const tailY = headY - uy * length;
    const midX = headX - ux * length * 0.52 + nx * bend;
    const midY = headY - uy * length * 0.52 + ny * bend;

    const alpha = particle.alpha * fade * (0.72 + strength * 0.38);
    const dark = particle.shade;
    const mid = Math.min(145, dark + 54);

    const gradient = ctx.createLinearGradient(headX, headY, tailX, tailY);
    gradient.addColorStop(0, `rgba(${dark},${dark},${dark},${alpha})`);
    gradient.addColorStop(0.42, `rgba(${mid},${mid},${mid},${alpha * 0.72})`);
    gradient.addColorStop(1, `rgba(155,155,155,0)`);

    ctx.beginPath();
    ctx.moveTo(headX + nx * widthNow * 0.34, headY + ny * widthNow * 0.34);
    ctx.quadraticCurveTo(midX + nx * widthNow, midY + ny * widthNow, tailX, tailY);
    ctx.quadraticCurveTo(midX - nx * widthNow * 0.86, midY - ny * widthNow * 0.86, headX - nx * widthNow * 0.34, headY - ny * widthNow * 0.34);
    ctx.quadraticCurveTo(headX - ux * widthNow * 0.34, headY - uy * widthNow * 0.34, headX + nx * widthNow * 0.34, headY + ny * widthNow * 0.34);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.quadraticCurveTo(midX, midY, tailX, tailY);
    ctx.strokeStyle = `rgba(${Math.max(0, dark - 8)},${Math.max(0, dark - 8)},${Math.max(0, dark - 8)},${alpha * 0.34})`;
    ctx.lineWidth = Math.max(0.8, widthNow * 0.16);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawReducedMotionWisps(screen, projected, vanishingPoint, strength) {
    if (strength < 0.12) return;
    const scale = Math.max(0.2, screen.scale);
    const cardW = billboard.offsetWidth * scale;
    const cardH = billboard.offsetHeight * scale;
    let tx = vanishingPoint.x - screen.x;
    let ty = vanishingPoint.y - screen.y;
    const tm = Math.max(1, Math.hypot(tx, ty));
    tx /= tm;
    ty /= tm;
    const nx = -ty;
    const ny = tx;

    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const x = screen.x + side * cardW * (0.50 + (i % 3) * 0.045);
      const y = screen.y + ((i / 5) - 0.5) * cardH * 0.82;
      const particle = {
        x,
        y,
        vx: tx * 48 + nx * side * 12,
        vy: ty * 48 + ny * side * 12 - 10,
        nx,
        ny,
        age: 0.62,
        life: 1.9,
        width: 8 + i * 0.9,
        length: 38 + i * 4,
        shade: 28 + i * 9,
        phase: i * 0.9,
        frequency: 2.4,
        curl: 20,
        alpha: 0.13 + strength * 0.16,
      };
      drawWisp(particle, strength);
    }
  }

  function render({ screen, projected, vanishingPoint, timeFieldStrength, stopTitle, interactionHold }) {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (canvas.width === 0 || width !== innerWidth || height !== innerHeight) resize();

    const strength = stateStrength(projected.state, timeFieldStrength);
    const movedFar = lastCenter && Math.hypot(screen.x - lastCenter.x, screen.y - lastCenter.y) > Math.max(innerWidth, innerHeight) * 0.32;
    if (stopTitle !== lastStopTitle || movedFar) clearParticles();
    lastStopTitle = stopTitle;
    lastCenter = { x: screen.x, y: screen.y };

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    if (reducedMotion) {
      clearParticles();
      drawReducedMotionWisps(screen, projected, vanishingPoint, strength);
    } else {
      const rate = emissionRate(projected.state, strength);
      emissionCarry += rate * dt;
      while (emissionCarry >= 1 && particles.length < MAX_PARTICLES) {
        spawn(screen, projected, vanishingPoint, strength);
        emissionCarry -= 1;
      }

      const motionScale = interactionHold ? 0.34 : (0.78 + (1 - timeFieldStrength) * 0.40);
      for (let i = particles.length - 1; i >= 0; i--) {
        if (!updateParticle(particles[i], dt, motionScale)) particles.splice(i, 1);
      }
      for (const particle of particles) drawWisp(particle, strength);
    }

    ctx.restore();

    return {
      contract: SMOKE_CONTRACT,
      renderer: 'canvas-2d-particle-wisps',
      strength,
      particleCount: particles.length,
      maxParticles: MAX_PARTICLES,
      state: projected.state,
      pointerEvents: 'none',
    };
  }

  resize();
  return { canvas, render, contract: SMOKE_CONTRACT };
}
