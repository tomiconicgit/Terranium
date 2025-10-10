import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

/**
 * Sandy ground (stable, no shader patches):
 * - Flat core around pad
 * - Cosine + Perlin dunes toward the edges
 * - Vertex-color horizon fade so it feels endless
 */
export function createGroundTiles({ size = 140, segments = 140 } = {}) {
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  const half = size * 0.5;
  const pos = geom.attributes.position;
  const perlin = new PerlinNoise();

  // Tunables
  const CORE_R   = 12;     // perfectly-flat radius around the pad
  const CORE_BLEND_W = 8;  // smooth transition width
  const DUNE_AMP = 0.6;    // dune height (meters)
  const RIM_AMP  = 1.6;    // gentle lift near outer boundary
  const P1 = 0.035, P2 = 0.09;
  const COSX = 0.22, COSZ = 0.18;

  // Colors
  const sandDeep   = new THREE.Color(0xd5c29b);
  const sandLight  = new THREE.Color(0xefe2c3);
  const horizonCol = new THREE.Color(0xdde7f3);

  // Allocate vertex colors
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Distance to square edge (0 center -> 1 border)
    const edgeDist = Math.max(Math.abs(x), Math.abs(z)) / half;

    // Flat core around pad
    const maxAbs = Math.max(Math.abs(x), Math.abs(z));
    const flatCoreBlend = smoothstep(CORE_R, CORE_R + CORE_BLEND_W, maxAbs); // 0 near pad, 1 outside

    // Dunes: long cosine + 2-scale Perlin
    const longCos = Math.cos(x * COSX) * Math.cos(z * COSZ) * 0.22;
    const n = perlin.noise(x * P1, z * P1) * 0.6 + perlin.noise(x * P2, z * P2) * 0.4;
    const dunesHeight = (longCos + n) * DUNE_AMP * flatCoreBlend;

    // Rim lift (start at 60% outward)
    const rimT = clamp((edgeDist - 0.6) / 0.4, 0, 1);
    const rimHeight = (1 - Math.cos(rimT * Math.PI)) * 0.5 * RIM_AMP;

    pos.setY(i, dunesHeight + rimHeight);

    // Vertex color = sand tone with horizon fade
    // local sand tone variance using Perlin (very subtle)
    const tone = 0.55 + (perlin.noise(x * 0.3, z * 0.3) * 0.08);
    const sand = sandDeep.clone().lerp(sandLight, clamp(tone, 0, 1));

    // Fade to horizon color near the outer 30% → 100%
    const fade = smoothstep(half * 0.7, half * 0.98, maxAbs);
    sand.lerp(horizonCol, fade);

    colors[i * 3 + 0] = sand.r;
    colors[i * 3 + 1] = sand.g;
    colors[i * 3 + 2] = sand.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.FrontSide
  });

  const ground = new THREE.Mesh(geom, mat);
  ground.name = 'landscape';
  ground.position.y = 0; // explicit, so it can’t drift
  return ground;
}

/* utils (inline to avoid imports) */
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}