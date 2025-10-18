// src/scene/SkyDome.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createSkyDome() {
  const geometry = new THREE.SphereGeometry(1400, 40, 20);

  // Gradient sky with a warm horizon band and deep blue top
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
    uniform vec3 midColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;

    void main(){
      // height factor
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y; // [-1..1]
      float t = clamp(pow(max(h, 0.0), exponent), 0.0, 1.0);

      // three-stop gradient: bottom -> mid -> top
      vec3 low  = mix(bottomColor, midColor, smoothstep(0.0, 0.35, t));
      vec3 high = mix(midColor,     topColor, smoothstep(0.35, 1.0, t));
      vec3 col  = mix(low, high, smoothstep(0.15, 0.85, t));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // DUSK palette (tuned to your photo)
  const uniforms = {
    topColor:    { value: new THREE.Color(0x0e203a) }, // deep navy
    midColor:    { value: new THREE.Color(0x314a7a) }, // desaturated blue
    bottomColor: { value: new THREE.Color(0xf2a15a) }, // warm orange horizon
    offset:      { value: 6.0 },                       // brings the glow lower
    exponent:    { value: 0.45 }                       // broader gradient
  };

  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    side: THREE.BackSide
  });

  const skyDome = new THREE.Mesh(geometry, material);
  skyDome.name = 'SkyDome_Dusk';
  return skyDome;
}