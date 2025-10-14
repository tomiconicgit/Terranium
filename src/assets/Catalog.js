// src/assets/Catalog.js
import * as THREE from "three";

// A procedural material for a metallic floor panel
const matMetalFloor = new THREE.MeshStandardMaterial({
  color: 0x8a9299,
  metalness: 0.9,
  roughness: 0.4,
});

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat",
      material: () => matMetalFloor, size: {x:4, y:0.2, z:4}, preview:"#8a9299" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z),
    def.material()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add userData for the builder to identify parts
  mesh.userData.part = def;
  return mesh;
}
