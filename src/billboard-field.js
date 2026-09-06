import { createOrbitalSystem, contourPoint, drawOrbitalDisplay, TAU } from './procedural-cosmos.js';
import { createFlameAtlas, drawTurbulentFlame } from './flame-texture.js';

export function createBillboardFieldRenderer({ hud, billboard, reducedMotion }) {
  function makeCanvas(className, zIndex) {
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.zIndex = String(zIndex);
    hud.append(canvas);
    return canvas;
  }
  const rearCanvas = makeCanvas('billboard-field-canvas billboard-field-canvas-rear', 1);
  const frontCanvas = makeCanvas('billboard-field-canvas billboard-field-canvas-front', 3);
  const layers = [rearCanvas, frontCanvas].map(canvas => [canvas, canvas.getContext('2d')]);
  const atlas = createFlameAtlas();
  let system, lastSeed, lastSize = '', phaseTime = 0, lastTime = performance.now();
  let cardW = billboard.offsetWidth, cardH = billboard.offsetHeight;
  const observer = new ResizeObserver(() => {
    cardW = billboard.offsetWidth; cardH = billboard.offsetHeight;
  });
  observer.observe(billboard);

  function render({ screen, projected, timeFieldStrength, interactionHold, seed }) {
    const now = performance.now();
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    // Reduce Motion controls the large scene/camera motion, not this local
    // instrument animation. Keep asteroids drifting, scan arcs sweeping, and
    // flames flickering so the billboard still feels alive on mobile.
    phaseTime += dt * (interactionHold ? .3 : 1 - timeFieldStrength * .55);
    if (lastSeed !== seed) {
      system = createOrbitalSystem(seed); lastSeed = seed;
      // Read the newly committed story layout in this frame, before drawing.
      cardW = billboard.offsetWidth; cardH = billboard.offsetHeight;
    }
    const compact = innerWidth <= 900;
    // Keep the desktop flame envelope on compact screens so the full-length
    // turbulent vents are not clipped by the field canvas on mobile.
    const pad = 190;
    const w = cardW + pad * 2, h = cardH + pad * 2;
    const dpr = Math.min(devicePixelRatio || 1, 1.35);
    const key = `${w}:${h}:${dpr}`;
    if (lastSize !== key) {
      lastSize = key;
      for (const [canvas] of layers) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      }
    }
    // Mobile uses the same projected pose as the card itself. Compact mode still
    // draws fewer orbital objects, but flame vents now use the default desktop
    // count, dimensions, turbulence atlas, and animation on every screen size.
    const perspective = compact ? 680 : 900;
    const transform = `translate3d(${screen.x}px,${screen.y}px,0) translate(-50%,-50%) perspective(${perspective}px) rotateY(${screen.yaw}deg) rotateZ(${screen.roll}deg) skewY(${screen.skew}deg) scale(${screen.scale})`;
    const strength = Math.min(1, ({ distant: 0, approaching: .2, arming: .58, active: .96, passing: .44 }[projected.state] || 0)
      + (projected.state === 'active' ? timeFieldStrength * .04 : 0));
    const counts = [];
    layers.forEach(([canvas, ctx], layer) => {
      canvas.style.transform = transform;
      canvas.style.opacity = String(projected.alpha);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      const front = layer === 1;
      drawOrbitalDisplay(ctx, system, cardW, cardH, phaseTime, strength, front, compact);
      let count = 0;
      // Translucent turbulent flows follow the curved shell, leaving text clear.
      const vents = front ? 12 : 20;
      if (strength > .02) for (let i = 0; i < vents; i++) {
        const a = system.phase + i / vents * TAU + (front ? .12 : 0);
        const p = contourPoint(a, cardW / 2 + 6, cardH / 2 + 7, system.phase, front ? 9 : 5);
        const angle = Math.atan2(Math.sin(a), Math.cos(a));
        const flicker = .85 + Math.sin(phaseTime * 7 + i * 2.7) * .15;
        drawTurbulentFlame(ctx, atlas, p.x, p.y, angle,
          (front ? 62 : 90) * (.65 + strength * .35),
          (front ? 66 : 118) * (.5 + strength * .5) * flicker,
          phaseTime + i * .23, strength * (front ? .85 : 1));
        count++;
      }
      counts.push(count);
    });
    return {
      contract: 'procedural-orbital-instrument-v1', renderer: 'dual-canvas-turbulent-orbital-field',
      strength, seed, moonCount: system.moons.length, asteroidCount: compact ? 24 : system.rocks.length,
      particleCount: counts[0] + counts[1], rearParticleCount: counts[0], frontParticleCount: counts[1],
      maxParticles: 32, rearLayer: true, frontLayer: true, pointerEvents: 'none',
    };
  }
  return { render };
}
