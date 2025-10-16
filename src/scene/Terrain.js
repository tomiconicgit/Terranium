// src/scene/Terrain.js

import * as THREE from 'three';

// Helper to create a procedural noise texture on a canvas
function createNoiseTexture(width, height, color1, color2) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);

  for (let i = 0; i < data.length; i += 4) {
    const pick = Math.random() < 0.5 ? c1 : c2;
    const v = 0.8 + Math.random() * 0.2;
    data[i + 0] = Math.round(pick.r * 255 * v);
    data[i + 1] = Math.round(pick.g * 255 * v);
    data[i + 2] = Math.round(pick.b * 255 * v);
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createConcreteMaterial() {
  const tex = createNoiseTexture(128, 128, 0x7d7d7d, 0x6a6a6a);
  tex.repeat.set(25, 25);
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.1
  });
}

function createGrassMaterial() {
  const tex = createNoiseTexture(128, 128, 0x5a7a4f, 0x4e6b46);
  tex.repeat.set(125, 125);
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    metalness: 0.0
  });
}

export function createTerrain() {
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';

  const plateauSize = 50;     // square inner plateau size
  const slopeWidth  = 100;    // width of sloped ring around plateau
  const worldSize   = plateauSize + 2 * slopeWidth; // 250 total
  const slopeHeight = 20;

  // 1) Central concrete plateau (flat)
  const concreteGeo = new THREE.PlaneGeometry(plateauSize, plateauSize);
  const concrete = new THREE.Mesh(concreteGeo, createConcreteMaterial());
  concrete.rotation.x = -Math.PI / 2;
  concrete.receiveShadow = true;
  terrainGroup.add(concrete);

  // 2) Outer grass area with a hole (so the plateau cuts out)
  //    IMPORTANT: Use THREE.Shape for outer; holes is undefined on Path.
  const outerShape = new THREE.Shape();
  const hs = worldSize / 2;

  outerShape.moveTo(-hs, -hs);
  outerShape.lineTo( hs, -hs);
  outerShape.lineTo( hs,  hs);
  outerShape.lineTo(-hs,  hs);
  outerShape.closePath();

  // Inner rectangular hole matching the plateau footprint
  const hole = new THREE.Path();
  const hp = plateauSize / 2;
  hole.moveTo(-hp, -hp);
  hole.lineTo( hp, -hp);
  hole.lineTo( hp,  hp);
  hole.lineTo(-hp,  hp);
  hole.closePath();

  outerShape.holes.push(hole);

  // Build geometry from the shape (lies in XY plane)
  const grassShapeGeo = new THREE.ShapeGeometry(outerShape, 50);

  // Sculpt the slope by pushing vertices down on Z based on distance from plateau edge
  const pos = grassShapeGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // Distance outside the plateau in X/Y (shape is in XY before rotation)
    const dx = Math.max(0, Math.abs(x) - hp);
    const dy = Math.max(0, Math.abs(y) - hp);
    const dist = Math.hypot(dx, dy);

    const progress = Math.min(dist / slopeWidth, 1.0);
    // smoothstep
    const t = progress * progress * (3 - 2 * progress);

    // Push down along local Z (will become "Y up" after rotation)
    pos.setZ(i, -t * slopeHeight);
  }
  grassShapeGeo.computeVertexNormals();

  const grass = new THREE.Mesh(grassShapeGeo, createGrassMaterial());
  grass.rotation.x = -Math.PI / 2; // rotate XY -> XZ ground plane
  grass.receiveShadow = true;
  terrainGroup.add(grass);

  return terrainGroup;
}