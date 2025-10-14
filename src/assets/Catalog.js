// src/assets/Catalog.js
import * as THREE from "three";

// A simple, reusable green material
const matGrass = new THREE.MeshStandardMaterial({
  color: 0x6ab85d,
  roughness: 0.8,
  metalness: 0.1,
});

/* ---------- Simplified Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "grass_block", name: "Grass Block", baseType: "block",
      material: () => matGrass, size: {x:1, y:1, z:1}, preview:"#6ab85d" },
  ];
}

/* ---------- Simplified Mesh builder ---------- */
export function buildPart(def) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z),
    def.material()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // The mesh itself is the root object now
  return mesh;
}
