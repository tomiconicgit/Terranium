import * as THREE from 'three';

export function createSkyDome() {
  const geom = new THREE.SphereGeometry(500, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x94c0ff) },
      bottomColor: { value: new THREE.Color(0xcfe8ff) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vWorld).y * 0.5 + 0.5;
        vec3 col = mix(bottomColor, topColor, pow(h, 1.5));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  return new THREE.Mesh(geom, mat);
}