// Seeded geometry shared by the orbital billboards and the Canvas 2D world.
// Everything here is generated from numbers; no stock assets or runtime downloads.
export const TAU = Math.PI * 2;
export function seededRandom(seed) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createOrbitalSystem(seed) {
  const random = seededRandom(seed);
  return {
    seed,
    phase: random() * TAU,
    tilt: (random() - .5) * .9,
    rocks: Array.from({ length: 84 }, () => ({
      angle: random() * TAU, band: random(), radius: 1.2 + random() ** 3 * 6,
      spin: random() * TAU, shape: Array.from({ length: 9 }, () => .7 + random() * .3),
    })),
    moons: Array.from({ length: 2 + seed % 3 }, (_, i) => ({
      angle: random() * TAU, radius: 12 + random() * 14,
      orbit: 1.1 + i * .08, seed: Math.floor(random() * 100000),
    })),
    craters: Array.from({ length: 32 }, () => ({
      x: (random() - .5) * 1.65, y: (random() - .5) * 1.65, r: .025 + random() * .10,
    })),
  };
}

// A smooth, asymmetric superellipse. A protected rectangular reading area
// fits inside this contour, while its silhouette has no straight edges.
export function contourPoint(angle, halfW, halfH, phase, expansion = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const wave = 1 + .025 * Math.sin(angle * 3 + phase) + .015 * Math.cos(angle * 5 - phase);
  return {
    x: Math.sign(c) * Math.abs(c) ** .40 * (halfW + expansion) * wave,
    y: Math.sign(s) * Math.abs(s) ** .40 * (halfH + expansion) * wave,
  };
}

export function traceContour(ctx, halfW, halfH, phase, expansion = 0, start = 0, end = TAU) {
  ctx.beginPath();
  const points = [];
  const count = Math.ceil((end - start) / TAU * 140);
  for (let i = 0; i <= count + 1; i++) {
    points.push(contourPoint(start + Math.min(i, count) / count * (end - start), halfW, halfH, phase, expansion));
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    ctx.quadraticCurveTo(points[i].x, points[i].y,
      (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2);
  }
  if (end - start >= TAU) ctx.closePath();
}

export function drawRock(ctx, rock, x, y, scale = 1, lit = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rock.spin);
  const r = rock.radius * scale;
  ctx.beginPath();
  rock.shape.forEach((v, i) => {
    const a = i / rock.shape.length * TAU;
    const px = Math.cos(a) * r * v, py = Math.sin(a) * r * v * .78;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, lit ? '#e9ca8c' : '#c1a67e');
  g.addColorStop(.36, lit ? '#9c8b69' : '#85745d');
  g.addColorStop(1, '#303b38');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

export function drawMoon(ctx, system, x, y, r, tint = '#a9b9ae') {
  ctx.save();
  ctx.translate(x, y);
  const atmosphere = ctx.createRadialGradient(0, 0, r * .9, 0, 0, r * 1.24);
  atmosphere.addColorStop(0, 'rgba(214,233,200,.27)');
  atmosphere.addColorStop(1, 'rgba(214,233,200,0)');
  ctx.fillStyle = atmosphere;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.24, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  const light = ctx.createRadialGradient(-r * .42, -r * .48, 0, r * .3, r * .1, r * 1.25);
  light.addColorStop(0, '#efe2bc'); light.addColorStop(.43, tint); light.addColorStop(1, '#273634');
  ctx.fillStyle = light; ctx.fillRect(-r, -r, r * 2, r * 2);
  for (const crater of system.craters) {
    const cx = crater.x * r, cy = crater.y * r, cr = crater.r * r;
    ctx.beginPath(); ctx.ellipse(cx, cy, cr, cr * .8, -.4, 0, TAU);
    ctx.fillStyle = 'rgba(24,35,30,.18)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + cr * .14, cr, cr * .8, -.4, .1, 2.8);
    ctx.strokeStyle = 'rgba(248,226,178,.38)'; ctx.lineWidth = Math.max(.6, r * .004); ctx.stroke();
  }
  const shade = ctx.createLinearGradient(-r, 0, r, r * .3);
  shade.addColorStop(0, 'rgba(14,26,26,0)'); shade.addColorStop(.46, 'rgba(14,26,26,.02)');
  shade.addColorStop(.8, 'rgba(14,26,26,.65)'); shade.addColorStop(1, 'rgba(14,26,26,.9)');
  ctx.fillStyle = shade; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

export function drawOrbitalDisplay(ctx, system, w, h, time, strength, front = false, compact = false) {
  const halfW = w / 2 + 6, halfH = h / 2 + 7;
  const reach = compact ? 10 : 40;
  const phase = system.phase;
  if (!front) {
    traceContour(ctx, halfW, halfH, phase, 4);
    const surface = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    surface.addColorStop(0, '#354a46'); surface.addColorStop(.45, '#202e2c'); surface.addColorStop(1, '#394039');
    ctx.fillStyle = surface;
    ctx.shadowColor = 'rgba(35,47,36,.28)'; ctx.shadowBlur = 24;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(212,189,136,.8)'; ctx.lineWidth = 1.1; ctx.stroke();

    for (let ring = 0; ring < 5; ring++) {
      const start = phase + ring * 1.7;
      traceContour(ctx, halfW, halfH, phase, 10 + ring * reach / 5, start, start + 1.8 + ring * .24);
      ctx.strokeStyle = ring % 2 ? 'rgba(61,105,100,.55)' : 'rgba(169,115,59,.6)';
      ctx.lineWidth = ring === 2 ? 2.6 : .8; ctx.stroke();
    }
    // Swept curved scan segments, never a rectangular scan bar.
    for (let i = 0; i < 3; i++) {
      const a = time * .16 + phase + i * TAU / 3;
      traceContour(ctx, halfW, halfH, phase, 14, a, a + .26);
      ctx.strokeStyle = `rgba(243,191,100,${.35 + strength * .5})`;
      ctx.lineWidth = 2; ctx.stroke();
    }
    for (let i = 0; i < 52; i++) {
      const a = i / 52 * TAU;
      traceContour(ctx, halfW, halfH, phase, 21, a, a + .007);
      ctx.strokeStyle = i % 4 ? 'rgba(132,156,140,.55)' : 'rgba(235,189,112,.8)';
      ctx.lineWidth = i % 4 ? 2 : 4; ctx.stroke();
    }
  }

  // Depth sorting puts fragments and moons on both sides of the instrument.
  const rockLimit = compact ? 24 : system.rocks.length;
  for (let i = 0; i < rockLimit; i++) {
    const rock = system.rocks[i];
    const a = rock.angle + time * .022;
    if ((Math.sin(a + phase) > .35) !== front) continue;
    const p = contourPoint(a, halfW, halfH, phase, reach * (.7 + rock.band * 1.45));
    drawRock(ctx, rock, p.x, p.y, compact ? .5 : 1, true);
  }
  if (!compact) for (const moon of system.moons) {
    const a = moon.angle + time * .035 / moon.orbit;
    if ((Math.sin(a + phase) > .35) !== front) continue;
    const p = contourPoint(a, halfW, halfH, phase, 64 * moon.orbit);
    drawMoon(ctx, system, p.x, p.y, moon.radius);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, moon.radius * 1.5, moon.radius * .5, -.45 + phase, .2, 5.7);
    ctx.strokeStyle = 'rgba(97,123,105,.7)'; ctx.lineWidth = .8; ctx.stroke();
  }
}

// Cache texture-rich bodies once. The world frame only composites these bodies
// and a bounded belt; travel remains periodic across the forward/reverse loop.
export function createDeepSpaceRenderer(makeCanvas = () => document.createElement('canvas')) {
  const systems = [3107, 8219, 14249].map(createOrbitalSystem);
  const textures = systems.map((system, index) => {
    const c = makeCanvas(); c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    drawMoon(ctx, system, 256, 256, 205, ['#b89465', '#7c9790', '#9a897d'][index]);
    return c;
  });
  function render(ctx, w, h, progress, degraded = false) {
    const placements = [
      { x: .83, y: .28, r: .145, tilt: -.36 },
      { x: .12, y: .66, r: .095, tilt: .43 },
      { x: .57, y: .39, r: .039, tilt: -.6 },
    ];
    placements.forEach((place, i) => {
      const system = systems[i];
      const a = progress * TAU + i * 1.7;
      const r = Math.min(w, h) * place.r * (1 + .09 * Math.sin(a));
      const x = w * (place.x + Math.sin(a) * .045), y = h * (place.y + Math.cos(a) * .035);
      ctx.save(); ctx.translate(x, y); ctx.rotate(place.tilt);
      const belt = front => {
        // Dust arc remains broad enough to read as a belt at a distance.
        for (let band = 0; band < 7; band++) {
          ctx.beginPath(); ctx.ellipse(0, 0, r * (1.43 + band * .075), r * (.40 + band * .026), 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.strokeStyle = `rgba(86,75,52,${.05 + (3 - Math.abs(3 - band)) * .017})`;
          ctx.lineWidth = r * .025; ctx.stroke();
        }
        const count = degraded ? 42 : 84;
        for (let j = 0; j < count; j++) {
          const rock = system.rocks[j];
          const angle = rock.angle + progress * TAU;
          if ((Math.sin(angle) >= 0) !== front) continue;
          const distance = 1.4 + rock.band * .6;
          drawRock(ctx, rock, Math.cos(angle) * r * distance, Math.sin(angle) * r * distance * .28, r / 125);
        }
      };
      belt(false);
      ctx.drawImage(textures[i], -r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
      belt(true);
      const mx = Math.cos(a * 2) * r * 2.6, my = Math.sin(a * 2) * r * .8;
      ctx.drawImage(textures[(i + 1) % 3], mx - r * .2, my - r * .2, r * .4, r * .4);
      ctx.restore();
    });
    return { contract: 'seeded-orbital-background-v1', systems: systems.length, beltRocks: degraded ? 126 : 252 };
  }
  return { render };
}
