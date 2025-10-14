// src/assets/Catalog.js
import * as THREE from "three";
// ✨ NEW: Import RoundedBoxGeometry for smoother edges
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';


// A procedural material for a metallic floor panel
const matMetalFloor = new THREE.MeshStandardMaterial({
  // ✨ FIX: Brighter color for a more reflective look
  color: 0xe0e5e9, 
  // ✨ FIX: High metalness for a clear metallic sheen
  metalness: 0.95,
  // ✨ FIX: Lower roughness for more distinct reflections and shininess
  roughness: 0.35,
});

// Reusing the same material for the metal beam for consistency
const matMetalBeam = matMetalFloor; 

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat",
      material: () => matMetalFloor, size: {x:4, y:0.2, z:4}, preview:"#e0e5e9" },
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical",
      material: () => matMetalBeam, size: {x:1, y:4, z:1}, preview:"#e0e5e9" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  let geometry;
  if (def.id === "metal_beam") {
    // ✨ FIX: Use RoundedBoxGeometry for the beam with a small radius for smooth corners
    // The last argument is the radius of the corner.
    geometry = new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 2, 0.1); 
  } else {
    // Default to BoxGeometry for other parts
    geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z);
  }

  const mesh = new THREE.Mesh(
    geometry,
    def.material()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add userData for the builder to identify parts
  mesh.userData.part = def;
  return mesh;
}
