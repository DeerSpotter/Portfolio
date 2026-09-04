import * as THREE from 'three';

/**
 * TEMPORARY SHIP STUB
 * -------------------
 * This procedural exploration cruiser exists only to validate camera, scroll,
 * path, banking, pitch, warp, and fly-by behavior before the final GLB ship is
 * commissioned. It is deliberately isolated behind createShipStub() so the
 * finished asset can replace this module without rewriting flight logic.
 */
export function createShipStub() {
  const ship = new THREE.Group();
  ship.name = 'portfolio-ship-stub';

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x8b96a8,
    metalness: 0.58,
    roughness: 0.34,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1f2633,
    metalness: 0.72,
    roughness: 0.25,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2a435f,
    emissive: 0x10243d,
    emissiveIntensity: 0.8,
    metalness: 0.45,
    roughness: 0.16,
  });
  const engineMat = new THREE.MeshStandardMaterial({
    color: 0x8ad8ff,
    emissive: 0x42a9ff,
    emissiveIntensity: 2.8,
    metalness: 0.2,
    roughness: 0.15,
  });

  const saucer = new THREE.Mesh(new THREE.SphereGeometry(1.25, 48, 24), hullMat);
  saucer.scale.set(1.65, 0.28, 1.05);
  saucer.position.z = -0.15;
  ship.add(saucer);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 16), glassMat);
  canopy.scale.set(1.1, 0.25, 0.78);
  canopy.position.set(0, 0.16, -0.82);
  ship.add(canopy);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 2.75), hullMat);
  spine.position.set(0, -0.08, 1.02);
  ship.add(spine);

  const rear = new THREE.Mesh(new THREE.ConeGeometry(0.74, 1.7, 5), darkMat);
  rear.rotation.x = Math.PI / 2;
  rear.rotation.z = Math.PI;
  rear.position.set(0, -0.08, 2.22);
  rear.scale.y = 0.55;
  ship.add(rear);

  const nacelles = [];
  const engineCores = [];
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 1.4), hullMat);
    pylon.position.set(side * 1.18, -0.02, 1.05);
    pylon.rotation.z = side * 0.16;
    ship.add(pylon);

    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 2.65), darkMat);
    nacelle.position.set(side * 1.48, 0.02, 1.35);
    nacelle.rotation.x = -0.02;
    ship.add(nacelle);
    nacelles.push(nacelle);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 2.2), engineMat);
    core.position.set(side * 1.48, 0.11, 1.28);
    ship.add(core);
    engineCores.push(core);

    const exhaust = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), engineMat);
    exhaust.position.set(side * 1.48, 0.02, 2.69);
    exhaust.rotation.y = Math.PI;
    ship.add(exhaust);
  }

  ship.userData.engineMaterial = engineMat;
  ship.userData.engineCores = engineCores;
  ship.userData.nacelles = nacelles;
  ship.scale.setScalar(0.88);
  return ship;
}

export function setShipWarp(ship, amount) {
  const warp = THREE.MathUtils.clamp(amount, 0, 1);
  const material = ship.userData.engineMaterial;
  if (material) material.emissiveIntensity = 2.8 + warp * 8.5;

  for (const core of ship.userData.engineCores || []) {
    core.scale.z = 1 + warp * 0.22;
  }
}
