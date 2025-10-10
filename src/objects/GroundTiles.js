import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

/**
 * Clean AAA-style grass with broad sand patches. Much stronger grass bias.
 */
export function createGroundTiles({ size = 100, segments = 100, grassRatio = 0.96, uniformsRef } = {}) {
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  // gentle undulation
  const perlin = new PerlinNoise();
  const pos = geom.attributes.position;
  const amp = 0.10;     // subtle
  const freq = 0.02;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, perlin.noise(x * freq, z * freq) * amp);
  }
  geom.computeVertexNormals();

  // base grass vertex colors (strong green)
  const baseGrass = new THREE.Color(0x79b15f);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { colors[i*3]=baseGrass.r; colors[i*3+1]=baseGrass.g; colors[i*3+2]=baseGrass.b; }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 });

  const uniforms = {
    time: uniformsRef?.time ?? { value: 0 },
    grassLight: { value: new THREE.Color(0x8fd06f) },
    grassDeep:  { value: new THREE.Color(0x5f9448) },
    sandLight:  { value: new THREE.Color(0xeadfb7) },
    sandDeep:   { value: new THREE.Color(0xd1c193) },
    grassRatio: { value: grassRatio },
    patchScale: { value: 0.0015 } // broader patches than before
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = `
      varying vec3 vWorld;
    ` + shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vWorld = worldPosition.xyz;
    `);

    shader.fragmentShader = `
      varying vec3 vWorld;
      uniform vec3 grassLight, grassDeep, sandLight, sandDeep;
      uniform float grassRatio, patchScale;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
      float field = vnoise(vWorld.xz * patchScale);

      // Heavily prefer grass. Only introduce sand on visible slopes, weakened by grassRatio.
      float sandMask = smoothstep(0.22, 0.48, slope);
      sandMask = mix(sandMask * 0.4, sandMask, field); // soften with noise
      sandMask *= (1.0 - grassRatio);                  // keep mostly grass

      vec3 g = mix(grassDeep, grassLight, 0.55);
      vec3 s = mix(sandDeep,  sandLight,  0.55);
      vec3 ground = mix(g, s, sandMask);

      diffuseColor.rgb = mix(diffuseColor.rgb, ground, 0.98);
      `
    );
  };

  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = false;

  // super subtle grid (kept for tile reference)
  ground.add(makeThinGrid(size, segments, 0.04));
  return ground;
}

function makeThinGrid(size, segments, opacity) {
  const step = size / segments, half = size / 2;
  const verts = [];
  for (let i = 0; i <= segments; i++) { const x = -half + i * step; verts.push(x,0.003,-half, x,0.003,half); }
  for (let j = 0; j <= segments; j++) { const z = -half + j * step; verts.push(-half,0.003,z, half,0.003,z); }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity });
  return new THREE.LineSegments(geom, mat);
}