import { createOrbitalSystem, drawMoon, drawRock, TAU } from './procedural-cosmos.js';
import { createAsteroidTraffic } from './asteroid-traffic.js';

export const destinations = {
  briefTitle: { name: 'Orbital reception', place: 'The arrival terminal', kind: 'base', sky: ['#0b2027', '#496962'], accent: '#e4c18a', tint: '#93b0a5', seed: 117 },
  engineering: { name: 'Mars / Engineering outpost', place: 'Built for real constraints', kind: 'mars', sky: ['#291b24', '#b5704f'], accent: '#ffc48b', tint: '#bb7955', seed: 229 },
  automation: { name: 'Lunar archive', place: 'Every revision has a place', kind: 'archive', sky: ['#0f1c2a', '#526b7a'], accent: '#b8dce0', tint: '#88aba6', seed: 331 },
  contextport: { name: 'Saturn / Context exchange', place: 'Carry the work between worlds', kind: 'saturn', sky: ['#211c34', '#655269'], accent: '#edc8aa', tint: '#d2b38a', seed: 443 },
  ipasim: { name: 'The transfer dock', place: 'Across the runtime boundary', kind: 'dock', sky: ['#101b22', '#3b575b'], accent: '#a0e0d5', tint: '#7ca0ac', seed: 557 },
  clarity: { name: 'Europa / Observatory', place: 'A clear view of the system', kind: 'observatory', sky: ['#13293b', '#769499'], accent: '#dbe8d9', tint: '#c4d1bf', seed: 661 },
};

export function createDestinationScene(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0, started = 0, last = 0, config, system, texture, traffic;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.4);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ground(w, h, t) {
    const horizon = h * .69;
    // Each surface has a different generated geological profile.
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 16; x += 16) {
        const ridge = Math.sin(x * .006 + config.seed + layer) * 24
          + Math.sin(x * .017 + layer * 3) * 8;
        ctx.lineTo(x, horizon + layer * h * .105 + ridge * (config.kind === 'mars' ? 2 : .55));
      }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = config.kind === 'mars' ? ['#804735','#60392f','#362a2b'][layer]
        : config.kind === 'observatory' ? ['#9baea9','#607d80','#2f4c57'][layer]
        : ['#435661','#263c48','#142632'][layer];
      ctx.fill();
    }
    const bx = w * .72, by = h * .76, unit = Math.min(w, h) * .085;
    ctx.save(); ctx.translate(bx, by);
    if (config.kind === 'mars') {
      // Pressurized colony domes connected by low service tunnels.
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * unit * 1.12;
        ctx.fillStyle = '#37444a'; ctx.fillRect(x, -unit * .2, unit * 1.2, unit * .2);
        ctx.beginPath(); ctx.ellipse(x, 0, unit * .62, unit * .65, 0, Math.PI, TAU);
        const glass = ctx.createLinearGradient(x, -unit, x, 0);
        glass.addColorStop(0, '#c7d6c2'); glass.addColorStop(1, '#456369');
        ctx.fillStyle = glass; ctx.fill(); ctx.strokeStyle = '#e1b394'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, 0, unit * .25, unit * .65, 0, Math.PI, TAU); ctx.stroke();
      }
    } else if (config.kind === 'archive') {
      // A vertical automated storage complex embedded into the lunar ridge.
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * unit * .75, height = unit * (1.5 + (i % 3) * .5);
        ctx.fillStyle = '#263e4e'; ctx.fillRect(x, -height, unit * .58, height);
        for (let row = 0; row < 8; row++) {
          ctx.fillStyle = (row + i) % 3 ? '#7bafa9' : '#d9c79a';
          ctx.fillRect(x + 6, -height + 10 + row * height / 9, unit * .4, 2);
        }
      }
      const crane = reduced ? 0 : Math.sin(t * .4) * unit;
      ctx.strokeStyle = '#b9c6b9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-unit * 2.3, 0); ctx.lineTo(-unit * 2.3, -unit * 3);
      ctx.lineTo(unit * 2.3, -unit * 3); ctx.lineTo(unit * 2.3, 0); ctx.stroke();
      ctx.fillStyle = '#dcd0a6'; ctx.fillRect(crane, -unit * 3, unit * .4, unit * .22);
    } else {
      // Ice observatory: a parabolic dish, pedestal, and optical field arcs.
      ctx.fillStyle = '#314b58'; ctx.fillRect(-unit * .18, -unit, unit * .36, unit);
      ctx.save(); ctx.translate(0, -unit * 1.4); ctx.rotate(-.45);
      ctx.beginPath(); ctx.moveTo(-unit * 1.5, -unit * .45);
      ctx.quadraticCurveTo(0, unit * 1.2, unit * 1.5, -unit * .45);
      ctx.quadraticCurveTo(0, unit * .05, -unit * 1.5, -unit * .45);
      ctx.fillStyle = '#c4d0c2'; ctx.fill();
      ctx.strokeStyle = '#638487'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, unit * .35); ctx.lineTo(0, -unit); ctx.stroke(); ctx.restore();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.ellipse(0, -unit * 1.3, unit * (2 + i * .4), unit * (1.5 + i * .4), -.4, 3.6, 5.8);
        ctx.strokeStyle = `rgba(211,239,224,${.22 - i * .035})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.restore();
  }
  function station(w, h, t) {
    const x = w * .73, y = h * .6, r = Math.min(w, h) * .2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(config.kind === 'dock' ? -.2 : -.55);
    if (config.kind === 'dock') {
      for (let i = 5; i >= 0; i--) {
        const s = 1 - i * .11;
        ctx.beginPath(); ctx.ellipse(i * r * .32, -i * r * .08, r * s, r * .8 * s, 0, .22, TAU - .22);
        ctx.strokeStyle = i % 2 ? '#95c7bf' : '#3d7378'; ctx.lineWidth = r * .085 * s; ctx.stroke();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + i * .12), r * (.35 + i * .065), 0, 0, TAU);
        ctx.strokeStyle = i === 1 ? '#bdc5ae' : '#5d807e'; ctx.lineWidth = i === 1 ? 12 : 3; ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + (reduced ? 0 : t * .035);
        const px = Math.cos(a) * r, py = Math.sin(a) * r * .35;
        ctx.fillStyle = '#e2be85'; ctx.beginPath(); ctx.ellipse(px, py, 9, 4, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#b4c5b6'; ctx.beginPath(); ctx.ellipse(0, 0, r * .15, r * .6, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function render(now) {
    const w = innerWidth, h = innerHeight, dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = reduced ? 0 : (now - started) / 1000;
    const arrival = reduced ? 1 : 1 - Math.exp(-t * 1.4);
    const sky = ctx.createLinearGradient(0, 0, w * .3, h);
    sky.addColorStop(0, config.sky[0]); sky.addColorStop(1, config.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (const rock of system.rocks) {
      ctx.globalAlpha = .25 + rock.band * .55; ctx.fillStyle = '#ede2c6';
      ctx.beginPath(); ctx.arc(rock.angle / TAU * w, rock.band * h * .8, .6 + rock.radius * .12, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const radius = Math.min(w, h) * (config.kind === 'saturn' ? .29 : .19) * (.7 + arrival * .3);
    const px = w * .76, py = h * .3;
    const rings = front => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(-.38);
      for (let i = 0; i < 22; i++) {
        ctx.beginPath(); ctx.ellipse(0, 0, radius * (1.32 + i * .027), radius * (.38 + i * .007), 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
        ctx.strokeStyle = i % 4 ? 'rgba(217,190,146,.48)' : 'rgba(113,94,95,.55)'; ctx.lineWidth = radius * .022; ctx.stroke();
      }
      ctx.restore();
    };
    if (config.kind === 'saturn') rings(false);
    ctx.drawImage(texture, px - radius * 1.25, py - radius * 1.25, radius * 2.5, radius * 2.5);
    if (config.kind === 'saturn') rings(true);
    ctx.save(); ctx.translate(w * .5, h); ctx.scale(.86 + arrival * .14, .86 + arrival * .14); ctx.translate(-w * .5, -h);
    if (['mars', 'archive', 'observatory'].includes(config.kind)) ground(w, h, t);
    else station(w, h, t);
    ctx.restore();
    traffic.render(ctx, w, h, dt, .12, reduced, innerWidth < 700);
    frame = requestAnimationFrame(render);
  }
  return {
    start(destination) {
      cancelAnimationFrame(frame); config = destination; system = createOrbitalSystem(config.seed);
      texture = document.createElement('canvas'); texture.width = texture.height = 512;
      drawMoon(texture.getContext('2d'), system, 256, 256, 205, config.tint);
      traffic = createAsteroidTraffic(config.seed); started = last = performance.now();
      resize(); addEventListener('resize', resize); frame = requestAnimationFrame(render);
    },
    stop() { cancelAnimationFrame(frame); removeEventListener('resize', resize); },
  };
}
