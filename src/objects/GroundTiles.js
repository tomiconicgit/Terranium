import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

/**
 * Sandy ground:
 * - Flat near pad
 * - Gentle cosine “dune rim” towards edges (not mountains)
 * - Horizon blend to a far-haze color so it looks endless
 */
export function createGroundTiles({ size = 140, segments = 140, uniformsRef } = {}) {
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  const half = size / 2;
  const perlin = new PerlinNoise();
  const pos = geom.attributes.position;

  // Height profile: flat core -> gentle dunes -> rim lift via cosine
  const duneAmp = 0.25;     // ~25cm dunes
  const duneFreq = 0.05;
  const rimAmp  = 0.6;      // up to ~60cm at the outer rim (subtle)
  const coreR   = 18;       // very flat near the launch pad

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Manhattan-to-edge distance normalized [0..1] using a square mask
    const edgeDist = Math.max(Math.abs(x), Math.abs(z)) / half; // 0 center -> 1 at border

    // Dunes (soft noise, damped near the core)
    const dunes =
      perlin.noise(x * duneFreq * 0.5, z * duneFreq * 0.5) * duneAmp * 0.6 +
      perlin.noise(x * duneFreq,       z * duneFreq      ) * duneAmp * 0.4;

    const flatCoreBlend = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), coreR, coreR + 6);
    const dunesHeight = dunes * flatCoreBlend;

    // Cosine rim lift (not mountain, just a gentle perimeter rise)
    const rimT = THREE.MathUtils.clamp(edgeDist, 0, 1);
    const rimHeight = (1 - Math.cos(rimT * Math.PI)) * 0.5 * rimAmp; // 0 at center, 1 at edge

    pos.setY(i, dunesHeight + rimHeight * 0.8); // keep it subtle
  }

  geom.computeVertexNormals();

  // Material: sandy palette + distance-based horizon blend
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.02,
    color: 0xe2d6b8,     // base sand
    vertexColors: false
  });

  const uniforms = {
    time: uniformsRef?.time ?? { value: 0 },
    uSize: { value: size },
    sandDeep:   { value: new THREE.Color(0xd7c7a3) },
    sandLight:  { value: new THREE.Color(0xefe6cf) },
    horizonCol: { value: new THREE.Color(0xdfe7ef) }, // hazy far color
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader =
      `
      varying vec3 vWorld;
      ` + shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vWorld = worldPosition.xyz;'
      );

    shader.fragmentShader =
      `
      varying vec3 vWorld;
      uniform float uSize;
      uniform vec3 sandDeep, sandLight, horizonCol;

      // tiny grainy variation to avoid flat shading
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        // blend light/deep sand with a little slope-based shading
        float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
        float grain = vnoise(vWorld.xz * 2.5) * 0.07 + vnoise(vWorld.xz * 0.25) * 0.05;
        vec3 sand = mix(sandDeep, sandLight, 0.55 + grain - slope*0.12);

        // horizon fade near the 140x140 border (square distance)
        float halfSize = uSize * 0.5;
        float edge = max(abs(vWorld.x), abs(vWorld.z));
        float t = smoothstep(halfSize * 0.82, halfSize * 0.98, edge); // start fading before the edge
        vec3 finalCol = mix(sand, horizonCol, t);

        diffuseColor.rgb = mix(diffuseColor.rgb, finalCol, 0.98);
        `
      ).replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        // micro-roughness variation for sand grains
        float rVar = vnoise(vWorld.xz * 3.0) * 0.05 + vnoise(vWorld.xz * 0.3) * 0.03;
        roughnessFactor = clamp(roughnessFactor + rVar, 0.0, 1.0);
        `
      );
  };

  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = false; // we don't use shadows; keep perf

  // No grid, no vegetation.
  return ground;
}