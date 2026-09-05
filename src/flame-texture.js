// A small reusable, periodic turbulence atlas. Hot cores taper into broken
// translucent wisps; there are no outlined flame polygons or detached leaves.
const FRAMES = 24, WIDTH = 64, HEIGHT = 112;
function hash(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function createFlameAtlas(makeCanvas = () => document.createElement('canvas')) {
  const atlas = makeCanvas(); atlas.width = WIDTH * FRAMES; atlas.height = HEIGHT;
  const ctx = atlas.getContext('2d');
  const pixels = ctx.createImageData(atlas.width, HEIGHT);
  for (let frame = 0; frame < FRAMES; frame++) {
    const phase = frame / FRAMES * Math.PI * 2;
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const rise = 1 - y / (HEIGHT - 1), across = x / (WIDTH - 1) * 2 - 1;
      const u = across * 3 + Math.cos(phase) * 1.4;
      const v = rise * 7 + Math.sin(phase) * 1.4;
      const turbulence = noise(u, v) * .57 + noise(u * 2.1, v * 2.1) * .29 + noise(u * 4.3, v * 4.3) * .14;
      const width = .56 * Math.pow(1 - rise, .72);
      const curl = Math.sin(rise * 10 - phase * 2) * rise * .18 + (turbulence - .5) * rise * .6;
      const density = Math.max(0, Math.min(1, (width - Math.abs(across + curl) + (turbulence - .5) * .28) * 5));
      const heat = Math.max(0, Math.min(1, density * (1 - rise * .75)));
      const offset = (y * atlas.width + frame * WIDTH + x) * 4;
      pixels.data[offset] = 255;
      pixels.data[offset + 1] = 60 + Math.round(heat * 193);
      pixels.data[offset + 2] = 12 + Math.round(heat ** 3 * 207);
      pixels.data[offset + 3] = Math.round(density * Math.min(1, (1 - rise) * 5) * 210);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return { canvas: atlas, frames: FRAMES, width: WIDTH, height: HEIGHT };
}

export function drawTurbulentFlame(ctx, atlas, x, y, angle, width, length, time, alpha) {
  const frame = ((time * 18) % atlas.frames + atlas.frames) % atlas.frames;
  const index = Math.floor(frame), blend = frame - index;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
  // Premultiplied source-over blends adjacent frames without an abrupt atlas wrap.
  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = alpha * (i ? blend : 1 - blend);
    ctx.drawImage(atlas.canvas, ((index + i) % atlas.frames) * atlas.width, 0,
      atlas.width, atlas.height, -width / 2, -length, width, length + 2);
  }
  ctx.restore();
}
