import { seededRandom, TAU } from './procedural-cosmos.js';

// Abstract mechanical drawings, generated per destination. Shared pitch spacing
// connects the gear outlines; this artwork is not a manufacturing drawing.
export function createDestinationBlueprint(seed) {
  const random = seededRandom(seed);
  const phase = random() * TAU;
  const variants = { base: 0, mars: 1, archive: 2, saturn: 3, dock: 4, observatory: 5 };
  const routes = Array.from({ length: 9 }, () => ({ y: random(), bend: .2 + random() * .6, sweep: random() * .3 }));

  function circle(ctx, x, y, r, start = 0, end = TAU) {
    ctx.beginPath(); ctx.arc(x, y, r, start, end); ctx.stroke();
  }
  function gear(ctx, x, y, pitch, teeth, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    const module = 2 * pitch / teeth, root = pitch - module * 1.2;
    const outer = pitch + module, base = pitch * Math.cos(Math.PI / 9);
    const involute = r => r <= base ? 0 : Math.sqrt((r / base) ** 2 - 1) - Math.acos(base / r);
    const half = r => Math.PI / (2 * teeth) + involute(pitch) - involute(r);
    ctx.beginPath();
    for (let tooth = 0; tooth < teeth; tooth++) {
      const center = tooth / teeth * TAU;
      for (let flank = 0; flank < 2; flank++) for (let step = 0; step <= 6; step++) {
        const r = root + (outer - root) * (flank ? 1 - step / 6 : step / 6);
        const a = center + (flank ? 1 : -1) * half(Math.max(base, r));
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (tooth === 0 && flank === 0 && step === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth *= .65;
    circle(ctx, 0, 0, root * .87); circle(ctx, 0, 0, pitch * .33); circle(ctx, 0, 0, pitch * .21);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      circle(ctx, Math.cos(a) * pitch * .62, Math.sin(a) * pitch * .62, module * 1.2);
    }
    ctx.setLineDash([8, 5, 2, 5]); ctx.globalAlpha *= .55;
    circle(ctx, 0, 0, pitch);
    ctx.beginPath(); ctx.moveTo(-outer * 1.3, 0); ctx.lineTo(outer * 1.3, 0);
    ctx.moveTo(0, -outer * 1.3); ctx.lineTo(0, outer * 1.3); ctx.stroke();
    ctx.restore();
  }
  function bearing(ctx, x, y, r, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    for (const scale of [1, .94, .75, .62]) circle(ctx, 0, 0, r * scale);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU;
      circle(ctx, Math.cos(a) * r * .845, Math.sin(a) * r * .845, r * .065);
    }
    // Section hatch occupies the annulus only, leaving its central bore open.
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU);
    ctx.arc(0, 0, r * .48, 0, TAU, true); ctx.clip('evenodd');
    ctx.lineWidth = .6;
    for (let i = -r * 2; i < r * 2; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, -r); ctx.lineTo(i + r * 2, r); ctx.stroke();
    }
    ctx.restore(); circle(ctx, 0, 0, r * .48); ctx.restore();
  }
  function dimension(ctx, x, y, r, label) {
    const top = y - r * 1.3;
    ctx.save(); ctx.globalAlpha *= .8; ctx.lineWidth = .75;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r, top - 9);
    ctx.moveTo(x + r, y); ctx.lineTo(x + r, top - 9);
    ctx.moveTo(x - r, top); ctx.lineTo(x + r, top); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + side * r, top);
      ctx.lineTo(x + side * (r - 8), top - 3);
      ctx.moveTo(x + side * r, top); ctx.lineTo(x + side * (r - 8), top + 3); ctx.stroke();
    }
    ctx.font = '12px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, x, top - 9); ctx.restore();
  }
  return {
    render(ctx, w, h, time, config) {
      const kind = variants[config.kind];
      const unit = Math.min(w, h);
      const r = unit * (.155 + (kind % 2) * .018);
      const cx = w * .76, cy = h * .39;
      const spin = time * .025 + phase;
      ctx.save(); ctx.strokeStyle = config.accent; ctx.fillStyle = config.accent;
      ctx.lineWidth = 1; ctx.globalAlpha = .10;
      // Light construction grid spans the entire arrival, independent of copy.
      const spacing = Math.max(36, unit * .06);
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.globalAlpha = .27;
      for (const route of routes) {
        const y = route.y * h;
        ctx.beginPath(); ctx.moveTo(-20, y);
        ctx.bezierCurveTo(w * route.bend, y, w * .52, y + h * route.sweep, w + 20, y + h * route.sweep);
        ctx.stroke();
        circle(ctx, w * .92, y + h * route.sweep, 3);
      }
      ctx.globalAlpha = .68; ctx.lineWidth = 1.3;
      if (kind === 3) {
        // Planetary gear set: ring, sun and three orbiting planet gears.
        gear(ctx, cx, cy, r * .54, 24, spin);
        bearing(ctx, cx, cy, r * 1.7, 0);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * TAU + phase;
          gear(ctx, cx + Math.cos(a) * r * .99, cy + Math.sin(a) * r * .99, r * .45, 20, -spin * 1.2 + a);
        }
        dimension(ctx, cx, cy, r * 1.7, 'PLANETARY / PITCH ENVELOPE');
      } else if (kind === 2 || kind === 4) {
        // Exploded coaxial sections connected by shared construction axes.
        for (let i = 0; i < 3; i++) {
          const x = cx + (i - 1) * r * .67, y = cy + (i - 1) * r * .43;
          ctx.globalAlpha = .32 + i * .17;
          if (i === 1) gear(ctx, x, y, r * .85, 32, spin);
          else bearing(ctx, x, y, r, i * .12);
        }
        ctx.setLineDash([9, 5]); ctx.beginPath(); ctx.moveTo(cx - r * 2, cy - r * 1.3);
        ctx.lineTo(cx + r * 2, cy + r * 1.3); ctx.stroke(); ctx.setLineDash([]);
        dimension(ctx, cx, cy, r * 1.45, 'A–A / EXPLODED SECTION');
      } else if (kind === 5) {
        bearing(ctx, cx, cy, r * 1.5, spin * .5);
        for (let i = 0; i < 4; i++) circle(ctx, cx, cy, r * (1.7 + i * .1), phase + i, phase + i + 1.8);
        gear(ctx, cx, cy, r * .42, 20, -spin);
        dimension(ctx, cx, cy, r * 1.5, 'RADIAL / SECTION B–B');
      } else {
        gear(ctx, cx, cy, r, 36, spin);
        const a = -.65 + kind * .9;
        const sx = cx + Math.cos(a) * r * 1.667, sy = cy + Math.sin(a) * r * 1.667;
        gear(ctx, sx, sy, r * 2 / 3, 24, -spin * 1.5 + a * 2.5 + Math.PI / 24);
        dimension(ctx, cx, cy, r, 'Z36 / PITCH CIRCLE');
        dimension(ctx, sx, sy, r * 2 / 3, 'Z24');
      }
      // Secondary detail in the opposite corner gives the page spatial depth.
      ctx.globalAlpha = .26;
      bearing(ctx, w * .09, h * .76, unit * .21, -spin * .4);
      dimension(ctx, w * .09, h * .76, unit * .21, 'DETAIL / RADIAL SECTION');
      ctx.restore();
    },
  };
}
