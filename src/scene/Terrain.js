// src/scene/Terrain.js

import * as THREE from 'three';

// Helper to create a procedural noise texture on a canvas
function createNoiseTexture(width, height, color1, color2) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  
  const imageData = context.createImageData(width, height);
  const data = imageData.data;
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.random() * 0.2 + 0.8; // subtle variation
    const baseColor = Math.random() < 0.5 ? c1 : c2;
    data[i] = baseColor.r * 255 * value;
    data[i + 1] = baseColor.g * 255 * value;
    data[i + 2] = baseColor.b * 255 * value;
    data[i + 3] = 255;
  }
  
  context.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createConcreteMaterial() {
  const texture = createNoiseTexture(128, 128, 0x7d7d7d, 0x6a6a6a);
  texture.repeat.set(25, 25);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.1
  });
}

function createGrassMaterial() {
  const texture = createNoiseTexture(128, 128, 0x5a7a4f, 0x4e6b46);
  texture.repeat.set(125, 125);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0
  });
}

export function createTerrain() {
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';

  const plateauSize = 50;
  const slopeWidth = 100;
  const worldSize = plateauSize + 2 * slopeWidth; // Total size is 250
  const slopeHeight = 20;

  // 1. Create the central concrete plateau
  const concreteGeo = new THREE.PlaneGeometry(plateauSize, plateauSize);
  const concretePlateau = new THREE.Mesh(concreteGeo, createConcreteMaterial());
  concretePlateau.rotation.x = -Math.PI / 2;
  concretePlateau.receiveShadow = true;
  terrainGroup.add(concretePlateau);

  // 2. Create the outer grass slopes using a Shape with a hole
  const outerBoundary = new THREE.Path();
  outerBoundary.moveTo(-worldSize / 2, -worldSize / 2);
  outerBoundary.lineTo(worldSize / 2, -worldSize / 2);
  outerBoundary.lineTo(worldSize / 2, worldSize / 2);
  outerBoundary.lineTo(-worldSize / 2, worldSize / 2);
  outerBoundary.closePath();

  const innerHole = new THREE.Path();
  innerHole.moveTo(-plateauSize / 2, -plateauSize / 2);
  innerHole.lineTo(plateauSize / 2, -plateauSize / 2);
  innerHole.lineTo(plateauSize / 2, plateauSize / 2);
  innerHole.lineTo(-plateauSize / 2, plateauSize / 2);
  innerHole.closePath();
  outerBoundary.holes.push(innerHole);

  const grassShapeGeo = new THREE.ShapeGeometry(outerBoundary, 50);
  const grassPos = grassShapeGeo.getAttribute('position');
  
  // Manipulate vertices to create the slope
  for (let i = 0; i < grassPos.count; i++) {
      const x = grassPos.getX(i);
      const y = grassPos.getY(i);

      const dx = Math.max(0, Math.abs(x) - plateauSize / 2);
      const dy = Math.max(0, Math.abs(y) - plateauSize / 2);
      const dist = Math.hypot(dx, dy);

      const progress = Math.min(dist / slopeWidth, 1.0);
      let t = progress * progress * (3 - 2 * progress); // smoothstep curve
      
      grassPos.setZ(i, -t * slopeHeight);
  }
  grassShapeGeo.computeVertexNormals();
  
  const grassSlopes = new THREE.Mesh(grassShapeGeo, createGrassMaterial());
  grassSlopes.rotation.x = -Math.PI / 2;
  grassSlopes.receiveShadow = true;
  terrainGroup.add(grassSlopes);

  return terrainGroup;
}
