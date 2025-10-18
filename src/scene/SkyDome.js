// src/scene/SkyDome.js
import * as THREE from 'three';

export function createSkyDome() {
  const geometry = new THREE.SphereGeometry(10000, 80, 40);

  const vertexShader = `
    varying vec3 vWorldPosition;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;

    void main(){
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
      float t = clamp(pow(max(h, 0.0), exponent), 0.0, 1.0);
      vec3 col = mix(bottomColor, topColor, t);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    topColor:    { value: new THREE.Color(0x4fa8ff) },
    bottomColor: { value: new THREE.Color(0xdfeaff) },
    offset:      { value: 30.0 },
    exponent:    { value: 0.45 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false
  });

  const skyDome = new THREE.Mesh(geometry, material);
  skyDome.name = 'SkyDome_10km';
  return skyDome;
}