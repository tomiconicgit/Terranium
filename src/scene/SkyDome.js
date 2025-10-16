import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createSkyDome() {
    const geometry = new THREE.SphereGeometry(1000, 32, 16);
    
    // Simple gradient shader for a procedural sky
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `;
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize( vWorldPosition + offset ).y;
        gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
      }
    `;

    const uniforms = {
        topColor: { value: new THREE.Color(0x0077ff) }, // Blue sky
        bottomColor: { value: new THREE.Color(0xffffff) }, // White horizon
        offset: { value: 33 },
        exponent: { value: 0.6 }
    };
    
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: uniforms,
        side: THREE.BackSide // Render on the inside of the sphere
    });

    const skyDome = new THREE.Mesh(geometry, material);
    return skyDome;
}
