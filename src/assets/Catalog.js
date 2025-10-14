// src/assets/Catalog.js
import * as THREE from "three";

// A procedural material for a metallic floor panel
const matMetalFloor = new THREE.MeshStandardMaterial({
  // ✨ FIX: Changed color to a lighter, more iron-like grey
  color: 0xc0c5c9,
  metalness: 0.9,
  // ✨ FIX: Increased roughness for a less perfect, more diffuse reflection
  roughness: 0.7,
});

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat",
      material: () => matMetalFloor, size: {x:4, y:0.2, z:4}, preview:"#c0c5c9" },
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
