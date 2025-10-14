// src/assets/Catalog.js
import * as THREE from "three";

// A procedural material for a metallic floor panel
const matMetalFloor = new THREE.MeshStandardMaterial({
  color: 0xc0c5c9,
  metalness: 0.9,
  roughness: 0.7,
});

// Reusing the same material for the metal beam for consistency
const matMetalBeam = matMetalFloor; 

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat",
      material: () => matMetalFloor, size: {x:4, y:0.2, z:4}, preview:"#c0c5c9" },
    // ✨ NEW: Metal Beam item
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical",
      material: () => matMetalBeam, size: {x:1, y:4, z:1}, preview:"#c0c5c9" },
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
