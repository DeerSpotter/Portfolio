import * as THREE from 'three';

export const LOADING_PROLOGUE_CONTRACT = 'three-launch-loading-v2';
export const LOADING_PROLOGUE_DURATION_MS = 9200;

const COLORS = {
  ink: '#e8e2d4',
  muted: '#a69f92',
  line: 'rgba(232,226,212,.24)',
  gold: '#c49a55',
  orange: '#cf6f2f',
  olive: '#82906c',
  dark: '#050807',
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stageFor(phase) {
  if (phase < 0.10) return 'ignition';
  if (phase < 0.47) return 'ascent';
  if (phase < 0.70) return 'upper-atmosphere';
  if (phase < 0.89) return 'payload-separation';
  return 'flight-handoff';
}

export function describeLoadingPrologue(phase, appReady = true) {
  const p = clamp(phase);
  return {
    contract: LOADING_PROLOGUE_CONTRACT,
    phase: p,
    stage: stageFor(p),
    softwareFocused: false,
    commandIssued: false,
    payloadReleased: p >= 0.80,
    appReady,
    complete: p >= 1 && appReady,
    loadingProgress: appReady ? p : Math.min(0.965, p),
  };
}

function makeMaterial(color, metalness = 0.45, roughness = 0.48) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function createRocket() {
  const rocket = new THREE.Group();
  const white = makeMaterial(0xd9d8d1, 0.55, 0.38);
  const dark = makeMaterial(0x262b29, 0.68, 0.31);
  const accent = makeMaterial(0x936445, 0.50, 0.42);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 6.2, 24), white);
  core.position.y = 1.35;
  rocket.add(core);

  const interstage = new THREE.Mesh(new THREE.CylinderGeometry(0.73, 0.73, 0.82, 24), dark);
  interstage.position.y = -2.15;
  rocket.add(interstage);

  const lowerStage = new THREE.Group();
  const lowerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.82, 3.9, 24), white);
  lowerBody.position.y = -4.48;
  lowerStage.add(lowerBody);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 0.72), accent);
    const angle = i * Math.PI / 2;
    fin.position.set(Math.cos(angle) * 0.86, -5.58, Math.sin(angle) * 0.86);
    fin.rotation.y = angle;
    lowerStage.add(fin);
  }
  rocket.add(lowerStage);

  const payload = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.50, 1.05, 16), dark);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 16), dark);
  nose.position.y = 0.93;
  payload.add(bus, nose);
  payload.position.y = 5.05;
  rocket.add(payload);

  const fairingLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.55, 2.35, 16, 1, false, 0, Math.PI), white);
  const fairingRight = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.55, 2.35, 16, 1, false, Math.PI, Math.PI), white);
  fairingLeft.position.y = fairingRight.position.y = 5.05;
  fairingLeft.rotation.z = fairingRight.rotation.z = Math.PI;
  rocket.add(fairingLeft, fairingRight);

  const engineGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.54, 3.2, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xe58b43, transparent: true, opacity: 0.74, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  engineGlow.position.y = -7.65;
  engineGlow.rotation.x = Math.PI;
  rocket.add(engineGlow);

  return { rocket, lowerStage, payload, fairingLeft, fairingRight, engineGlow };
}

function createStars() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  let seed = 0x9e3779b9;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };
  for (let i = 0; i < count; i++) {
    const r = 45 + random() * 90;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xd7d5cb, size: 0.09, transparent: true, opacity: 0.72, sizeAttenuation: true }),
  );
}

function createLaunchWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7f9bac);
  scene.fog = new THREE.FogExp2(0x7893a3, 0.015);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  camera.position.set(11, 4.5, 18);

  const ambient = new THREE.HemisphereLight(0xdbe4e7, 0x44372c, 2.2);
  const sun = new THREE.DirectionalLight(0xfff2d6, 4.2);
  sun.position.set(10, 18, 12);
  scene.add(ambient, sun);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x56604f, roughness: 0.95, metalness: 0.02 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6.52;
  scene.add(ground);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.4, 0.8, 32), makeMaterial(0x363b37, 0.42, 0.72));
  pad.position.y = -6.10;
  scene.add(pad);

  const tower = new THREE.Group();
  const towerMat = makeMaterial(0x3d4642, 0.55, 0.62);
  for (const x of [-1.8, 1.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 13, 0.18), towerMat);
    leg.position.set(x, 0.2, -2.4);
    tower.add(leg);
  }
  for (let i = -5; i <= 5; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.12), towerMat);
    beam.position.set(0, i * 1.1, -2.4);
    tower.add(beam);
  }
  scene.add(tower);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(52, 64, 32),
    new THREE.MeshStandardMaterial({ color: 0x496b73, roughness: 0.86, metalness: 0.01 }),
  );
  earth.position.set(0, -57, -21);
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(52.9, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x86b6ca, transparent: true, opacity: 0.19, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
  );
  atmosphere.position.copy(earth.position);
  scene.add(atmosphere);

  const stars = createStars();
  stars.visible = false;
  scene.add(stars);

  const rocketParts = createRocket();
  scene.add(rocketParts.rocket);

  return { scene, camera, ground, pad, tower, earth, atmosphere, stars, ...rocketParts };
}

function drawLoadingOverlay(ctx, width, height, state) {
  const compact = width <= 720;
  const margin = compact ? 22 : Math.max(36, width * 0.06);
  const barW = compact ? width - margin * 2 : Math.min(680, width * 0.52);
  const barH = 3;
  const x = compact ? margin : width * 0.5 - barW / 2;
  const y = height - (compact ? 62 : 78);
  const progress = clamp(state.loadingProgress);

  ctx.save();
  const shade = ctx.createLinearGradient(0, height * 0.55, 0, height);
  shade.addColorStop(0, 'rgba(5,8,7,0)');
  shade.addColorStop(1, 'rgba(5,8,7,.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, height * 0.48, width, height * 0.52);

  ctx.fillStyle = 'rgba(232,226,212,.22)';
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x, y, barW * progress, barH);

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${compact ? 9 : 10}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText('INITIALIZING FLIGHT', x, y - 12);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(progress * 100)}%`, x + barW, y - 12);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 ${compact ? 8 : 9}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(state.stage.replaceAll('-', ' ').toUpperCase(), x, y + 11);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.olive;
  ctx.fillText('PROCEDURAL THREE.JS', x + barW, y + 11);
  ctx.restore();
}

export function createLoadingPrologueRenderer(insertBeforeNode = document.getElementById('engineeringMissionThread')) {
  const webglCanvas = document.createElement('canvas');
  webglCanvas.id = 'engineeringLaunch3d';
  webglCanvas.setAttribute('aria-hidden', 'true');
  Object.assign(webglCanvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: '19',
  });
  document.body.insertBefore(webglCanvas, insertBeforeNode || document.body.firstChild);

  const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const world = createLaunchWorld();
  const payloadWorld = new THREE.Vector3();
  const targetWorld = new THREE.Vector3();
  const targetNdc = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  let currentWidth = 1;
  let currentHeight = 1;

  function resize(width, height) {
    if (width === currentWidth && height === currentHeight) return;
    currentWidth = width;
    currentHeight = height;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
    renderer.setSize(width, height, false);
    world.camera.aspect = width / Math.max(1, height);
    world.camera.updateProjectionMatrix();
  }

  function render3d(width, height, phase, shipScreen) {
    resize(width, height);
    webglCanvas.style.display = 'block';

    const ascent = smoothstep(0.08, 0.66, phase);
    const atmosphereExit = smoothstep(0.36, 0.70, phase);
    const separate = smoothstep(0.67, 0.86, phase);
    const handoff = smoothstep(0.88, 1.0, phase);

    const rocketY = lerp(-0.1, 45, ascent);
    world.rocket.position.set(0, rocketY, lerp(0, -3.8, atmosphereExit));
    world.rocket.rotation.z = lerp(0, -0.055, ascent);

    world.engineGlow.scale.setScalar(0.78 + Math.sin(phase * 190) * 0.08 + ascent * 0.24);
    world.engineGlow.material.opacity = 0.48 + ascent * 0.34;

    world.lowerStage.position.y = -separate * 9;
    world.lowerStage.rotation.z = separate * 0.16;
    world.lowerStage.rotation.x = separate * 0.08;

    world.fairingLeft.position.x = -separate * 3.6;
    world.fairingRight.position.x = separate * 3.6;
    world.fairingLeft.rotation.z = Math.PI + separate * 0.78;
    world.fairingRight.rotation.z = Math.PI - separate * 0.78;
    world.fairingLeft.material.opacity = 1 - handoff;
    world.fairingRight.material.opacity = 1 - handoff;
    world.fairingLeft.material.transparent = true;
    world.fairingRight.material.transparent = true;

    world.ground.visible = atmosphereExit < 0.74;
    world.pad.visible = atmosphereExit < 0.74;
    world.tower.visible = atmosphereExit < 0.68;
    world.stars.visible = atmosphereExit > 0.18;
    world.stars.material.opacity = 0.72 * atmosphereExit;
    world.scene.fog.density = lerp(0.015, 0.0003, atmosphereExit);
    world.scene.background.setRGB(
      lerp(0.50, 0.012, atmosphereExit),
      lerp(0.61, 0.018, atmosphereExit),
      lerp(0.68, 0.026, atmosphereExit),
    );

    const camY = lerp(4.5, rocketY + 1.5, smoothstep(0.12, 0.58, phase));
    const camX = lerp(11, 8.2, atmosphereExit);
    const camZ = lerp(18, 15.5, atmosphereExit);
    world.camera.position.set(camX, camY, camZ);
    world.camera.lookAt(0, rocketY + lerp(0.4, 3.2, atmosphereExit), 0);

    if (handoff > 0.001 && shipScreen && Number.isFinite(shipScreen.x) && Number.isFinite(shipScreen.y)) {
      world.payload.getWorldPosition(payloadWorld);
      targetNdc.set(
        shipScreen.x / width * 2 - 1,
        -(shipScreen.y / height * 2 - 1),
        0.18,
      ).unproject(world.camera);
      cameraDirection.copy(targetNdc).sub(world.camera.position).normalize();
      targetWorld.copy(world.camera.position).addScaledVector(cameraDirection, 9.5);
      world.payload.position.copy(world.rocket.worldToLocal(payloadWorld.clone().lerp(targetWorld, handoff)));
      world.payload.scale.setScalar(1 + handoff * 0.55);
    }

    renderer.render(world.scene, world.camera);
  }

  return {
    render(ctx, width, height, phase, appReady, shipScreen) {
      const state = describeLoadingPrologue(phase, appReady);
      render3d(width, height, state.phase, shipScreen);
      drawLoadingOverlay(ctx, width, height, state);
      return {
        ...state,
        renderer: 'three-launch-background',
        rocketVisible: true,
        starfieldVisible: state.phase >= 0.36,
        fairingSeparated: state.phase >= 0.72,
        transitionTarget: 'live-3d-ship-screen-position',
        webglCanvasId: 'engineeringLaunch3d',
      };
    },
    hide() {
      webglCanvas.style.display = 'none';
    },
    show() {
      webglCanvas.style.display = 'block';
    },
  };
}
