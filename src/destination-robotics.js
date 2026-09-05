// Procedural set dressing for each destination: jointed service manipulators,
// assembly pads and curved instrument tracks. Motion is decorative, not telemetry.
export function drawDestinationRobotics(ctx, w, h, time, config) {
  const unit = Math.min(w * .12, h * .22);
  const baseY = h * .83;
  const color = config.accent;
  const kinds = { base: 0, mars: 1, archive: 2, saturn: 3, dock: 4, observatory: 5 };
  const variant = kinds[config.kind];
  ctx.save();
  // A projected assembly floor ties the mechanical scenery to a shared plane.
  ctx.strokeStyle = 'rgba(143,191,195,.16)'; ctx.lineWidth = .7;
  for (let i = 0; i < 10; i++) {
    const y = baseY + (i / 9) ** 1.7 * h * .17;
    ctx.beginPath(); ctx.moveTo(w * .08, y); ctx.lineTo(w * .92, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * .5, h * .6);
    ctx.lineTo(w * (i / 9), h); ctx.stroke();
  }
  const centerX = w * .31;
  ctx.beginPath(); ctx.ellipse(centerX, baseY, unit * 1.6, unit * .35, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#152831'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.stroke();
  const armCount = config.kind === 'archive' ? 3 : 2;
  for (let i = 0; i < armCount; i++) {
    const sign = i % 2 ? 1 : -1;
    const x = centerX + (i - (armCount - 1) / 2) * unit * 1.8;
    const phase = time * .45 + variant * .8 + i * 2;
    const shoulder = -Math.PI / 2 + sign * (.45 + Math.sin(phase) * .17);
    const elbow = -Math.PI / 2 - sign * (.65 + Math.cos(phase * .8) * .18);
    const root = { x, y: baseY - unit * .12 };
    const joint = { x: x + Math.cos(shoulder) * unit * .85, y: root.y + Math.sin(shoulder) * unit * .85 };
    const tip = { x: joint.x + Math.cos(elbow) * unit * .85, y: joint.y + Math.sin(elbow) * unit * .85 };
    ctx.fillStyle = '#4c676d'; ctx.fillRect(x - unit * .2, baseY - unit * .2, unit * .4, unit * .2);
    for (const [a, b] of [[root, joint], [joint, tip]]) {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1a2c35'; ctx.lineWidth = unit * .2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#9eafb0'; ctx.lineWidth = unit * .105; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x + 3, a.y); ctx.lineTo(b.x + 3, b.y); ctx.stroke();
    }
    for (const p of [root, joint, tip]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, unit * .11, 0, Math.PI * 2);
      ctx.fillStyle = '#182932'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, unit * .035, 0, Math.PI * 2); ctx.fillStyle = '#d0e5dc'; ctx.fill();
    }
    // Opposed finger grippers open and close smoothly around the work area.
    const grip = .10 + (Math.sin(phase) * .5 + .5) * .10;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + side * unit * grip, tip.y - unit * .14);
      ctx.lineTo(tip.x + side * unit * grip * .65, tip.y - unit * .29);
      ctx.strokeStyle = '#c0d2cb'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  // Six destinations have different assembly workpieces and instrument orbits.
  ctx.save(); ctx.translate(centerX, baseY - unit * .65);
  ctx.rotate(Math.sin(time * .2) * .1);
  for (let i = 0; i < 2 + variant % 3; i++) {
    ctx.beginPath(); ctx.ellipse(0, 0, unit * (.3 + i * .1), unit * (.14 + i * .09), variant * .38, .2 + time * .08, 5.8 + time * .08);
    ctx.strokeStyle = color; ctx.globalAlpha = .55 - i * .08; ctx.lineWidth = 1.3; ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  // Curved targeting brackets frame the facility without covering the scene.
  ctx.strokeStyle = color; ctx.lineWidth = .8; ctx.globalAlpha = .38;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.ellipse(w * .74, h * .5, w * .2, h * .35, 0, i * Math.PI / 2 + .18, i * Math.PI / 2 + .7); ctx.stroke();
  }
  ctx.restore();
}
