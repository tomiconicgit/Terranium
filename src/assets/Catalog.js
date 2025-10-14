// src/assets/Catalog.js
import * as THREE from "three";
// ✨ FIX: Re-import RoundedBoxGeometry for smoother edges
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';


// A procedural material for a metallic floor panel
const matMetalFloor = new THREE.MeshStandardMaterial({
  // Adjusted material properties slightly for the new lighting
  color: 0xe0e5e9, 
  metalness: 0.9,
  roughness: 0.45,
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
    // ✨ FIX: Use RoundedBoxGeometry for the beam with 0 segments for flat top/bottom
    // The arguments are (width, height, depth, segments, radius)
    // segments: 1 makes top/bottom flat, radius: 0.1 for side curves
    geometry = new RoundedBoxGeometry(def.size.x, def.size.y, def.size.z, 1, 0.1); 
  } else {
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
