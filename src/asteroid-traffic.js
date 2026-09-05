import { seededRandom, drawRock, TAU } from './procedural-cosmos.js';

// Independent elapsed time keeps the environment travelling while scroll stays
// on a readable waypoint. Pool size is fixed; recycling never adds objects.
export function createAsteroidTraffic(seed = 59381) {
  const random = seededRandom(seed);
  const rocks = Array.from({ length: 42 }, () => ({
    angle: random() * TAU, lane: .35 + random() * .85,
    offset: random(), speed: .055 + random() * .08,
    radius: 1 + random() * 2.7, spin: random() * TAU,
    shape: Array.from({ length: 9 }, () => .6 + random() * .4),
  }));
  let elapsed = 0;
  return {
    render(ctx, w, h, dt, progress, reducedMotion, degraded = false) {
      if (!reducedMotion) elapsed += Math.min(.05, dt);
      const vx = w * (.5 + Math.sin(progress * TAU * 1.1) * .035);
      const vy = h * (.35 + Math.cos(progress * TAU * .75) * .025);
      const count = degraded ? 24 : rocks.length;
      ctx.save();
      for (let i = 0; i < count; i++) {
        const rock = rocks[i];
        const phase = (rock.offset + elapsed * rock.speed) % 1;
        const depth = .1 + (1 - phase) * 3.8;
        const projection = 1 / depth;
        const dx = Math.cos(rock.angle) * w * .2 * rock.lane;
        const dy = Math.sin(rock.angle) * h * .28 * rock.lane;
        const x = vx + dx * projection, y = vy + dy * projection;
        const fade = Math.min(1, phase * 9, (1 - phase) * 14);
        if (x < -100 || x > w + 100 || y < -100 || y > h + 100) continue;
        const tail = 1 / (depth + .12 + phase * .28);
        ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.moveTo(vx + dx * tail, vy + dy * tail); ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(75,80,79,${.12 + phase * .22})`;
        ctx.lineWidth = .6 + phase * 1.2; ctx.stroke();
        drawRock(ctx, rock, x, y, projection * 1.45);
      }
      ctx.restore();
    },
  };
}
