import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

export function createGroundTiles({ size = 140, segments = 140 } = {}) {
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  const half = size * 0.5;
  const pos = geom.attributes.position;
  const perlin = new PerlinNoise();

  // --- dune shaping ---
  const CORE_R = 12, CORE_W = 8;
  const DUNE_AMP = 0.6, RIM_AMP = 1.6;
  const P1 = 0.035, P2 = 0.09, COSX = 0.22, COSZ = 0.18;

  // --- carve-out so terrain never appears inside/under the trench ---
  // must match LaunchPadComplex constants (pitClearW/L) with a small margin
  const CUT_W = 16; // pitClearW (14) + margin
  const CUT_L = 32; // pitClearL (30) + margin
  const CUT_DEPTH = -50; // push way below trench

  // vertex colors for horizon fade
  const sandDeep   = new THREE.Color(0xd5c29b);
  const sandLight  = new THREE.Color(0xefe2c3);
  const horizonCol = new THREE.Color(0xdde7f3);
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);

    // hard carve: if within trench rectangle, force far-below zero
    if (Math.abs(x) < CUT_W * 0.5 && Math.abs(z) < CUT_L * 0.5) {
      pos.setY(i, CUT_DEPTH);
    } else {
      // dunes + rim
      const maxAbs = Math.max(Math.abs(x), Math.abs(z));
      const edge = maxAbs / half;
      const flat = smoothstep(CORE_R, CORE_R + CORE_W, maxAbs);
      const longCos = Math.cos(x * COSX) * Math.cos(z * COSZ) * 0.22;
      const n = perlin.noise(x * P1, z * P1) * 0.6 + perlin.noise(x * P2, z * P2) * 0.4;
      const dunes = (longCos + n) * DUNE_AMP * flat;
      const rimT = clamp((edge - 0.6) / 0.4, 0, 1);
      const rim = (1 - Math.cos(rimT * Math.PI)) * 0.5 * RIM_AMP;
      pos.setY(i, dunes + rim);
    }

    // vertex color = sand with horizon fade
    const tone = 0.55 + (perlin.noise(x * 0.3, z * 0.3) * 0.08);
    const sand = sandDeep.clone().lerp(sandLight, clamp(tone, 0, 1));
    const fade = smoothstep(half * 0.7, half * 0.98, Math.max(Math.abs(x), Math.abs(z)));
    sand.lerp(horizonCol, fade);

    colors[i*3+0] = sand.r; colors[i*3+1] = sand.g; colors[i*3+2] = sand.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0.02
  }));
}

function clamp(x,a,b){ return Math.min(b, Math.max(a,x)); }
function smoothstep(a,b,x){ const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }