// src/scene/Terrain.js
// 1×1 sand tile grid + hole digger with procedural metal walls & floor.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain() {
  const terrainGroup = new THREE.Group();

  // ===== 1) Central Concrete Platform (unchanged) =====
  const platformSize = 100;
  const platformGeo = new THREE.PlaneGeometry(platformSize, platformSize);
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.7, metalness: 0.0 });
  const platformMesh = new THREE.Mesh(platformGeo, platformMat);
  platformMesh.rotation.x = -Math.PI / 2;
  platformMesh.receiveShadow = true;
  platformMesh.name = 'concrete_platform';
  terrainGroup.add(platformMesh);

  // ===== 2) Sand tile grid (1×1 meter tiles) =====
  const tileSize = 1.0;

  // Coverage chosen to fully include your coordinates (safe margins)
  const GRID_I_MIN = -5,  GRID_I_MAX = 40;  // inclusive i in [-5..40]
  const GRID_J_MIN = -20, GRID_J_MAX = 20;  // inclusive j in [-20..20]

  const sandTileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
  const sandTileMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.85, metalness: 0.0 });
  const sandTiles = new Map(); // key "i,j" -> mesh (so we can hide/remove when digging)

  for (let j = GRID_J_MIN; j <= GRID_J_MAX; j++) {
    for (let i = GRID_I_MIN; i <= GRID_I_MAX; i++) {
      const m = new THREE.Mesh(sandTileGeo, sandTileMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.set((i + 0.5) * tileSize, 0.0, (j + 0.5) * tileSize);
      m.receiveShadow = true;
      m.name = 'sand_tile'; // your raycast filter matches PlaneGeometry anyway
      terrainGroup.add(m);
      sandTiles.set(`${i},${j}`, m);
    }
  }

  // ===== 3) Procedural metal ShaderMaterial (walls + floor) =====
  // Simple brushed/striped pattern via trig—no textures needed.
  const metalShader = new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uColor:     { value: new THREE.Color(0x9aa1a7) },
      uMetalness: { value: 1.0 },
      uRoughness: { value: 0.35 },
      uRepeat:    { value: new THREE.Vector2(3.0, 3.0) }, // tiling
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform vec3  uColor;
      uniform vec2  uRepeat;
      // Faux "brushed metal" with repeating bands + small noise.
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec2 uv = vUv * uRepeat;
        // stripes in U with slight jitter in V for a brushed look
        float band = 0.5 + 0.5 * sin(uv.x * 6.283 * 6.0 + (hash(floor(uv)) * 0.7));
        float shade = mix(0.75, 1.05, band);
        vec3 col = uColor * shade;
        // slight darkening at edges
        float vign = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)
                   * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        col *= mix(1.0, 0.85, vign);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  // Helper to make a metal clone (so we can tweak repeats per part if needed)
  const makeMetalMat = (repU = 3.0, repV = 3.0) => {
    const m = metalShader.clone();
    m.uniforms = THREE.UniformsUtils.clone(metalShader.uniforms);
    m.uniforms.uRepeat.value = new THREE.Vector2(repU, repV);
    return m;
  };

  // ===== 4) Hole builder =====
  const holeGroup = new THREE.Group();
  holeGroup.name = 'terrain_holes';
  terrainGroup.add(holeGroup);

  function buildShaftAt(i, j, depthTiles) {
    const depth = depthTiles * tileSize;      // meters
    const cx = (i + 0.5) * tileSize;
    const cz = (j + 0.5) * tileSize;
    const topY = 0.0;
    const botY = topY - depth;

    // Hide sand tile (if present)
    const key = `${i},${j}`;
    const t = sandTiles.get(key);
    if (t) t.visible = false;

    // Bottom (metal)
    const floorGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const floorMat = makeMetalMat(3.0, 3.0);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, botY, cz);
    floor.receiveShadow = true;
    floor.castShadow = false;
    floor.name = `hole_floor_${i}_${j}`;
    holeGroup.add(floor);

    // Walls (4 sides) — each is a vertical plane of size (tileSize × depth)
    const wallGeo = new THREE.PlaneGeometry(tileSize, depth);
    const wallMatU = makeMetalMat(3.0, 6.0); // more repeats vertically
    const wallMatV = makeMetalMat(3.0, 6.0);

    // +Z (north) wall
    const wN = new THREE.Mesh(wallGeo, wallMatU);
    wN.position.set(cx, botY + depth * 0.5, cz + tileSize * 0.5);
    wN.rotation.y = Math.PI; // face inward
    wN.castShadow = true; wN.receiveShadow = true;
    holeGroup.add(wN);

    // -Z (south) wall
    const wS = new THREE.Mesh(wallGeo, wallMatU.clone());
    wS.position.set(cx, botY + depth * 0.5, cz - tileSize * 0.5);
    // facing inward already
    wS.castShadow = true; wS.receiveShadow = true;
    holeGroup.add(wS);

    // +X (east) wall (rotate plane to be vertical along X)
    const wallGeoX = new THREE.PlaneGeometry(tileSize, depth);
    const wE = new THREE.Mesh(wallGeoX, wallMatV);
    wE.position.set(cx + tileSize * 0.5, botY + depth * 0.5, cz);
    wE.rotation.y = -Math.PI / 2;
    wE.castShadow = true; wE.receiveShadow = true;
    holeGroup.add(wE);

    // -X (west) wall
    const wW = new THREE.Mesh(wallGeoX, wallMatV.clone());
    wW.position.set(cx - tileSize * 0.5, botY + depth * 0.5, cz);
    wW.rotation.y = Math.PI / 2;
    wW.castShadow = true; wW.receiveShadow = true;
    holeGroup.add(wW);
  }

  /**
   * Public API: call with your tiles array and depth in tiles.
   * Example: terrain.applyHolesFromTiles(tiles, 15)
   */
  terrainGroup.applyHolesFromTiles = (tiles, depthTiles = 15) => {
    if (!Array.isArray(tiles)) return;
    const seen = new Set();
    let count = 0;
    for (const t of tiles) {
      const i = (t?.i)|0, j = (t?.j)|0;
      const key = `${i},${j}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Only process tiles inside the built grid
      if (i < GRID_I_MIN || i > GRID_I_MAX || j < GRID_J_MIN || j > GRID_J_MAX) continue;
      buildShaftAt(i, j, depthTiles);
      count++;
    }
    // optional: console feedback
    console.log(`[Terrain] Dug ${count} tiles to depth ${depthTiles}.`);
  };

  return terrainGroup;
}