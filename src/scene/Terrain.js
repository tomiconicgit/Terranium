// Simple excavation pass that works with a “mesh-per-tile” setup.
// If your terrain uses an InstancedMesh, see the notes at the bottom.

import * as THREE from 'three';

export function applySimpleExcavation({
  scene,                 // THREE.Scene (optional, only needed if you want separate wall meshes added to scene)
  terrainRoot,           // THREE.Group that contains your tile meshes (children named like "tile_i_j" or has userData.i/j)
  selection,             // { tileSize: number, tiles: [{i, j}] }
  depth = -15,           // how deep to dig
  ring = 1               // how many tiles around the pit to flatten to 0 with concrete
}) {
  const tileSize = selection.tileSize ?? 1;

  // Materials (tweak to your liking)
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x7f8a94,
    metalness: 0.95,
    roughness: 0.25
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x9b9b9b,
    metalness: 0.0,
    roughness: 0.9
  });

  // --- Build fast lookup sets
  const key = (i, j) => `${i}:${j}`;
  const pick = new Set(selection.tiles.map(t => key(t.i, t.j)));

  // Collect all neighbors (ring area)
  const ringKeys = new Set();
  for (const t of selection.tiles) {
    const nbs = [
      [t.i + 1, t.j],
      [t.i - 1, t.j],
      [t.i, t.j + 1],
      [t.i, t.j - 1]
    ];
    for (const [ni, nj] of nbs) {
      if (!pick.has(key(ni, nj))) ringKeys.add(key(ni, nj));
    }
  }
  if (ring > 1) {
    // expand ring if requested
    for (let r = 2; r <= ring; r++) {
      const next = new Set(ringKeys);
      for (const k of next) {
        const [i, j] = k.split(':').map(Number);
        const nbs = [
          [i + 1, j],
          [i - 1, j],
          [i, j + 1],
          [i, j - 1]
        ];
        for (const [ni, nj] of nbs) {
          const nk = key(ni, nj);
          if (!pick.has(nk)) ringKeys.add(nk);
        }
      }
    }
  }

  // --- Helper: find a tile mesh by i/j
  const findTile = (i, j) => {
    // 1) By name convention
    let child = terrainRoot.getObjectByName(`tile_${i}_${j}`);
    if (child) return child;

    // 2) By userData
    for (const c of terrainRoot.children) {
      if (c.userData && c.userData.i === i && c.userData.j === j) return c;
    }
    return null;
  };

  // --- Move selected tiles down and set metal
  for (const t of selection.tiles) {
    const m = findTile(t.i, t.j);
    if (!m) continue;
    // Put the top surface at y = depth. If your tiles are centered, adjust by half thickness.
    m.position.y = depth;
    setMaterialRecursive(m, metalMat);
  }

  // --- Flatten ring tiles at y=0 and make concrete
  for (const k of ringKeys) {
    const [i, j] = k.split(':').map(Number);
    const m = findTile(i, j);
    if (!m) continue;
    m.position.y = 0;
    setMaterialRecursive(m, concreteMat);
  }

  // --- Build perimeter walls (thin boxes on edges where neighbor isn’t selected)
  // We create one wall segment per boundary edge. Simple & robust.
  const wallGroup = new THREE.Group();
  wallGroup.name = 'excavation_walls';
  const wallHeight = 0 - depth;           // from depth up to 0
  const wallThick = Math.min(0.12, tileSize * 0.12);
  const half = tileSize / 2;

  const wallGeomX = new THREE.BoxGeometry(tileSize, wallHeight, wallThick); // x-aligned edges
  const wallGeomZ = new THREE.BoxGeometry(wallThick, wallHeight, tileSize); // z-aligned edges

  for (const t of selection.tiles) {
    const i = t.i, j = t.j;

    // For each of the 4 sides, if neighbor isn't in selection, spawn a wall segment.
    // WORLD SPACE placement assumes tiles are positioned at (i * tileSize, y, j * tileSize)
    const cx = i * tileSize;
    const cz = j * tileSize;

    const sideDefs = [
      { // +X edge (east)
        hasNeighbor: pick.has(key(i + 1, j)),
        geom: wallGeomZ,
        pos: new THREE.Vector3(cx + half, depth + wallHeight / 2, cz),
        rotY: 0
      },
      { // -X edge (west)
        hasNeighbor: pick.has(key(i - 1, j)),
        geom: wallGeomZ,
        pos: new THREE.Vector3(cx - half, depth + wallHeight / 2, cz),
        rotY: 0
      },
      { // +Z edge (north)
        hasNeighbor: pick.has(key(i, j + 1)),
        geom: wallGeomX,
        pos: new THREE.Vector3(cx, depth + wallHeight / 2, cz + half),
        rotY: 0
      },
      { // -Z edge (south)
        hasNeighbor: pick.has(key(i, j - 1)),
        geom: wallGeomX,
        pos: new THREE.Vector3(cx, depth + wallHeight / 2, cz - half),
        rotY: 0
      }
    ];

    for (const s of sideDefs) {
      if (s.hasNeighbor) continue;
      const wall = new THREE.Mesh(s.geom, metalMat);
      wall.position.copy(s.pos);
      if (s.rotY) wall.rotation.y = s.rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      wallGroup.add(wall);
    }
  }

  // --- Build a metal floor at the bottom (one plane per tile for simplicity)
  const floorGroup = new THREE.Group();
  floorGroup.name = 'excavation_floor';
  const floorGeo = new THREE.PlaneGeometry(tileSize, tileSize);
  floorGeo.rotateX(-Math.PI / 2);

  for (const t of selection.tiles) {
    const floor = new THREE.Mesh(floorGeo, metalMat);
    floor.position.set(t.i * tileSize, depth, t.j * tileSize);
    floor.receiveShadow = true;
    floorGroup.add(floor);
  }

  if (scene) {
    // Add walls/floor as standalone meshes (keeps your terrain meshes untouched).
    scene.add(wallGroup);
    scene.add(floorGroup);
  } else {
    // Or parent them to the terrain
    terrainRoot.add(wallGroup);
    terrainRoot.add(floorGroup);
  }
}

// Recursively swap materials (covers groups)
function setMaterialRecursive(obj, mat) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.material = mat;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}