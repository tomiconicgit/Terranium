import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

/**
 * Sandy ground:
 * - Flat near pad (small core), then clear dunes
 * - Cosine rim lift toward the 140×140 boundary
 * - Strong horizon color blend so it feels endless
 */
export function createGroundTiles({ size = 140, segments = 140, uniformsRef } = {}) {
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  const half = size / 2;
  const perlin = new PerlinNoise();
  const pos = geom.attributes.position;

  // --- Tunables (more pronounced than before) ---
  const coreR   = 10;    // very flat radius around pad (smaller than before)
  const duneAmp = 0.60;  // dunes height ~0.6m
  const rimAmp  = 1.80;  // rim lift up to ~1.8m at outer edge

  const p1 = 0.035, p2 = 0.09;   // perlin frequencies
  const cfx = 0.22, cfz = 0.18;  // long cosine dunes frequency

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // distance to square edge (0 center -> 1 border)
    const edgeDist = Math.max(Math.abs(x), Math.abs(z)) / half;

    // keep very flat near pad
    const flatCoreBlend = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), coreR, coreR + 6);

    // dunes = long cosine undulations + two-scale perlin
    const longCos = (Math.cos(x * cfx) * Math.cos(z * cfz)) * 0.22; // broad “waves”
    const n  = perlin.noise(x * p1, z * p1) * 0.6 + perlin.noise(x * p2, z * p2) * 0.4;
    const dunesHeight = (longCos + n) * duneAmp * flatCoreBlend;

    // rim lift using cosine (starts around 60% toward the edge)
    const rimT = THREE.MathUtils.clamp((edgeDist - 0.6) / 0.4, 0, 1);  // 0 at 60%, 1 at edge
    const rimHeight = (1 - Math.cos(rimT * Math.PI)) * 0.5 * rimAmp;

    pos.setY(i, dunesHeight + rimHeight);
  }

  geom.computeVertexNormals();

  // --- Material with strong horizon blend ---
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.02,
    color: 0xe2d6b8
  });

  const uniforms = {
    time: uniformsRef?.time ?? { value: 0 },
    uSize: { value: size },
    sandDeep:   { value: new THREE.Color(0xd5c29b) },
    sandLight:  { value: new THREE.Color(0xefe2c3) },
    horizonCol: { value: new THREE.Color(0xdde7f3) } // obvious haze
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = `
      varying vec3 vWorld;
    ` + shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n vWorld = worldPosition.xyz;'
    );

    shader.fragmentShader = `
      varying vec3 vWorld;
      uniform float uSize;
      uniform vec3 sandDeep, sandLight, horizonCol;

      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
        float grain = vnoise(vWorld.xz * 3.0) * 0.08 + vnoise(vWorld.xz * 0.35) * 0.06;
        vec3 sand = mix(sandDeep, sandLight, 0.58 + grain - slope*0.15);

        float halfSize = uSize * 0.5;
        float edge = max(abs(vWorld.x), abs(vWorld.z));
        // start fading earlier and go fully to horizon at the last 10%
        float t = smoothstep(halfSize * 0.70, halfSize * 0.98, edge);
        vec3 finalCol = mix(sand, horizonCol, t);

        diffuseColor.rgb = finalCol;
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        float rVar = vnoise(vWorld.xz * 3.0) * 0.06 + vnoise(vWorld.xz * 0.4) * 0.04;
        roughnessFactor = clamp(roughnessFactor + rVar, 0.0, 1.0);
        `
      );
  };

  const ground = new THREE.Mesh(geom, mat);
  return ground;
}