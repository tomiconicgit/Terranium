// src/scene/SkyDome.js
// Renamed from src/objects/SkyDome.js

import * as THREE from 'three';

export function createSkyDome() {
  const geom = new THREE.SphereGeometry(1000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x94c0ff) },
      bottomColor: { value: new THREE.Color(0xcfe8ff) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.8), 0.0)), 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(geom, mat);
  sky.name = 'skydome';
  return sky;
}
