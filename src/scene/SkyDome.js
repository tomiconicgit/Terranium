// src/scene/SkyDome.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createSkyDome() {
  const geometry = new THREE.SphereGeometry(1400, 40, 20);

  // Simple gradient sky (midday): bright top-blue, pale horizon
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
      // height factor
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y; // [-1..1]
      // slightly steeper falloff for punchy noon gradient
      float t = clamp(pow(max(h, 0.0), exponent), 0.0, 1.0);
      vec3 col = mix(bottomColor, topColor, t);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // Midday palette
  const uniforms = {
    // Top sky: saturated blue (not too dark)
    topColor:    { value: new THREE.Color(0x4fa8ff) }, // #4FA8FF
    // Horizon: pale blue/white
    bottomColor: { value: new THREE.Color(0xdfeaff) }, // #DFEAFF
    // Higher offset lifts the bright band
    offset:      { value: 20.0 },
    // Lower exponent = stronger blend to top color for midday
    exponent:    { value: 0.45 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.BackSide
  });

  const skyDome = new THREE.Mesh(geometry, material);
  skyDome.name = 'SkyDome_Midday';
  return skyDome;
}