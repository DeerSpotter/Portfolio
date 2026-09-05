import * as THREE from 'three';

/**
 * TEMPORARY SHIP STUB
 * -------------------
 * This procedural exploration cruiser exists only to validate camera, scroll,
 * path, banking, pitch, warp, and fly-by behavior before the final GLB ship is
 * commissioned. It is deliberately isolated behind createShipStub() so the
 * finished asset can replace this module without rewriting flight logic.
 *
 * Coordinate contract:
 * - nose points toward local -Z
 * - engines/exhaust point toward local +Z
 * - +Y is ship-up
 *
 * quality may be "low", "medium", or "high". Geometry density and local
 * point lights are reduced on slower devices; the silhouette and dimensions
 * remain the same so the flight/camera contract is unchanged.
 */
export function createShipStub({ quality = 'high' } = {}) {
  const ship = new THREE.Group();
  ship.name = 'portfolio-ship-stub-v2';

  const low = quality === 'low';
  const medium = quality === 'medium';
  const sphereSegments = low ? 18 : medium ? 28 : 40;
  const sphereRows = low ? 10 : medium ? 14 : 20;
  const cylinderSegments = low ? 12 : medium ? 18 : 24;
  const circleSegments = low ? 14 : medium ? 20 : 28;
  const plumeSegments = low ? 8 : medium ? 12 : 16;

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x8997aa,
    metalness: 0.72,
    roughness: 0.28,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x334156,
    metalness: 0.68,
    roughness: 0.34,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x101722,
    metalness: 0.82,
    roughness: 0.22,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x173758,
    emissive: 0x0d2947,
    emissiveIntensity: 1.15,
    metalness: 0.3,
    roughness: 0.08,
  });
  const engineMat = new THREE.MeshStandardMaterial({
    color: 0xa5e8ff,
    emissive: 0x43b8ff,
    emissiveIntensity: 3.4,
    metalness: 0.15,
    roughness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2f78b7,
    emissive: 0x0b3357,
    emissiveIntensity: 0.75,
    metalness: 0.58,
    roughness: 0.24,
  });
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x73d9ff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  function addMesh(geometry, material, position, rotation, scale) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    if (scale) mesh.scale.set(...scale);
    ship.add(mesh);
    return mesh;
  }

  function makeWing(side) {
    const sx = side;
    const top = [
      [0.42 * sx, 0.04, -0.55],
      [2.18 * sx, -0.01, 0.12],
      [1.82 * sx, -0.01, 1.48],
      [0.56 * sx, 0.03, 0.82],
    ];
    const bottom = top.map(([x, y, z]) => [x, y - 0.15, z]);
    const vertices = [...top, ...bottom];
    const faces = [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1,
      1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3,
      3, 7, 4, 3, 4, 0,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices.flat()), 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    const wing = new THREE.Mesh(geometry, hullMat);
    ship.add(wing);

    if (!low) {
      const inset = wing.clone();
      inset.material = accentMat;
      inset.scale.set(0.72, 1.04, 0.72);
      inset.position.set(0.18 * sx, 0.055, 0.12);
      ship.add(inset);
    }
  }

  addMesh(new THREE.SphereGeometry(0.95, sphereSegments, sphereRows), hullMat, [0, 0.02, -0.12], null, [0.82, 0.34, 1.62]);
  addMesh(new THREE.ConeGeometry(0.58, 1.34, cylinderSegments), hullMat, [0, -0.01, -1.72], [-Math.PI / 2, 0, 0], [1.05, 1, 0.78]);
  addMesh(new THREE.SphereGeometry(0.58, Math.max(14, sphereSegments - 4), Math.max(8, sphereRows - 4)), glassMat, [0, 0.27, -0.67], null, [0.88, 0.26, 0.92]);
  addMesh(new THREE.BoxGeometry(0.52, 0.18, 2.2), panelMat, [0, -0.18, 0.82]);
  addMesh(new THREE.BoxGeometry(0.16, 0.11, 2.65), accentMat, [0, 0.2, 0.53]);

  makeWing(-1);
  makeWing(1);

  const engineCores = [];
  const enginePlumes = [];
  for (const side of [-1, 1]) {
    addMesh(
      new THREE.BoxGeometry(1.25, 0.12, 0.38),
      panelMat,
      [side * 0.98, -0.07, 0.57],
      [0, side * 0.18, side * 0.035]
    );

    const nacelle = addMesh(
      new THREE.CylinderGeometry(0.23, 0.27, 2.45, cylinderSegments, 1, false),
      darkMat,
      [side * 1.58, -0.01, 0.88],
      [Math.PI / 2, 0, 0],
      [1.0, 1.0, 0.95]
    );
    nacelle.name = `nacelle-${side < 0 ? 'left' : 'right'}`;

    addMesh(new THREE.CylinderGeometry(0.265, 0.265, 0.28, cylinderSegments), panelMat, [side * 1.58, -0.01, -0.34], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.24, cylinderSegments), panelMat, [side * 1.58, -0.01, 2.10], [Math.PI / 2, 0, 0]);

    const core = addMesh(new THREE.BoxGeometry(0.11, 0.10, 1.74), engineMat, [side * 1.58, 0.17, 0.87]);
    core.userData.phase = side < 0 ? 0.15 : 1.85;
    engineCores.push(core);

    const exhaust = addMesh(new THREE.CircleGeometry(0.17, circleSegments), engineMat, [side * 1.58, -0.01, 2.23]);
    exhaust.name = `exhaust-${side < 0 ? 'left' : 'right'}`;

    const plume = addMesh(
      new THREE.CylinderGeometry(0.025, 0.16, 2.45, plumeSegments, 1, true),
      plumeMat.clone(),
      [side * 1.58, -0.01, 3.48],
      [Math.PI / 2, 0, 0]
    );
    plume.material.opacity = 0.16;
    plume.userData.phase = side < 0 ? 0.25 : 2.15;
    enginePlumes.push(plume);

    if (quality === 'high') {
      const engineLight = new THREE.PointLight(0x55c7ff, 2.2, 6.5, 2);
      engineLight.position.set(side * 1.58, 0, 2.35);
      ship.add(engineLight);
    }
  }

  addMesh(new THREE.BoxGeometry(0.34, 0.16, 0.58), darkMat, [0, 0.25, 0.45]);
  if (!low) {
    addMesh(new THREE.BoxGeometry(0.08, 0.38, 0.42), panelMat, [0, 0.34, 1.22], [-0.15, 0, 0]);
    for (const side of [-1, 1]) {
      addMesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), accentMat, [side * 0.63, 0.12, 0.44]);
      addMesh(new THREE.BoxGeometry(0.16, 0.08, 0.32), darkMat, [side * 0.54, 0.18, -0.22]);
    }
  }

  ship.userData.engineMaterial = engineMat;
  ship.userData.engineCores = engineCores;
  ship.userData.enginePlumes = enginePlumes;
  ship.userData.plumeBaseOpacity = 0.16;
  ship.userData.quality = quality;
  ship.scale.setScalar(0.72);
  return ship;
}

/**
 * Engine animation state. This replaces the old static warp-only plume logic:
 * at speed the engines stretch, while a time-pocket coast keeps a shorter,
 * breathing flame alive so the ship never looks frozen.
 */
export function setShipEngineState(ship, { thrust = 0, coast = 0, time = 0 } = {}) {
  const warp = THREE.MathUtils.clamp(thrust, 0, 1);
  const coastAmount = THREE.MathUtils.clamp(coast, 0, 1);
  const idlePulse = 0.5 + 0.5 * Math.sin(time * 4.2);
  const material = ship.userData.engineMaterial;
  if (material) {
    material.emissiveIntensity = 3.4 + warp * 9.5 + coastAmount * (1.1 + idlePulse * 1.5);
  }

  for (const core of ship.userData.engineCores || []) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 5.1 + (core.userData.phase || 0));
    core.scale.z = 1 + warp * 0.34 + coastAmount * (0.025 + pulse * 0.035);
  }

  for (const plume of ship.userData.enginePlumes || []) {
    const phase = plume.userData.phase || 0;
    const slowPulse = 0.5 + 0.5 * Math.sin(time * 4.6 + phase);
    const fastFlicker = 0.5 + 0.5 * Math.sin(time * 13.4 + phase * 2.0);
    const livingIdle = coastAmount * (0.22 + slowPulse * 0.20);
    plume.scale.y = 1 + warp * 2.6 + livingIdle;
    const breathe = 1 + coastAmount * (slowPulse - 0.5) * 0.10 + warp * (fastFlicker - 0.5) * 0.07;
    plume.scale.x = breathe;
    plume.scale.z = breathe;
    plume.material.opacity = (ship.userData.plumeBaseOpacity || 0.16)
      + warp * (0.34 + fastFlicker * 0.06)
      + coastAmount * (0.07 + slowPulse * 0.08);
  }
}
