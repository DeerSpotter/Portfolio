import * as THREE from 'three';

// Crossed volumetric-looking exhaust slices, rooted at local Z=0. Geometry
// stays attached to the nozzle at every thrust level. This is a visual shader,
// not a combustion simulation or a substitute for the documented ship model.
export function createEnginePlume(phase) {
  const plume = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: { time: { value: phase }, power: { value: .2 } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      uniform float power;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),
          mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);
      }
      void main() {
        float z = vUv.y;
        vec2 flow = vec2(vUv.x * 7.0, z * 11.0 - time * 8.0);
        float n = noise(flow)*.58 + noise(flow*2.03)*.28 + noise(flow*4.01)*.14;
        float sway = (n-.5)*.23*z + sin(z*23.0-time*12.0)*.035*z;
        float radial = abs(vUv.x-.5+sway)*2.0;
        float width = (.48 + .4*smoothstep(0.0,.18,z))*pow(1.0-z,.42) + .08*sin(z*34.0-time*2.0)*z;
        float body = 1.0-smoothstep(width*.22, width, radial+(n-.5)*.18*z);
        float tail = (1.0-smoothstep(.52,1.0,z))*(.76+.24*n);
        float core = pow(max(0.0,1.0-radial*5.0),3.0)*(1.0-z);
        float shock = pow(.5+.5*cos(z*48.0),12.0)*(1.0-z)*body;
        vec3 cool = mix(vec3(.10,.48,.92),vec3(.65,.90,1.0),core);
        vec3 hot = mix(vec3(.91,.23,.055),vec3(1.0,.72,.28),body);
        vec3 color = mix(cool,hot,smoothstep(.16,.8,z));
        color = mix(color,vec3(1.0,.97,.82),clamp(core+shock*.65,0.0,1.0));
        gl_FragColor = vec4(color, body*tail*(.66+power*.3));
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1.2, 4.8, 1, 1);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, 2.4);
  for (let i = 0; i < 3; i++) {
    const slice = new THREE.Mesh(geometry, material);
    slice.rotation.z = i * Math.PI / 3;
    plume.add(slice);
  }
  plume.userData.phase = phase;
  plume.userData.material = material;
  return plume;
}
