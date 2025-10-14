// src/assets/Catalog.js
import * as THREE from "three";
// Note: We are no longer using RoundedBoxGeometry

const matMetalFloor = new THREE.MeshStandardMaterial({
  // ✨ FIX: Brighter, more metallic base color
  color: 0xf0f5fa,
  // ✨ FIX: Adjusted metalness and roughness to react better to enhanced lighting
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
  const group = new THREE.Group();
  let mesh;

  if (def.id === "metal_beam") {
    // ✨ FIX: Use ExtrudeGeometry for beams with rounded vertical edges and flat tops/bottoms.
    const shape = new THREE.Shape();
    const w = def.size.x, r = 0.1; // Width and corner radius
    const hw = w / 2; // half-width
    shape.moveTo( -hw + r, -hw );
    shape.lineTo(  hw - r, -hw );
    shape.quadraticCurveTo( hw, -hw, hw, -hw + r );
    shape.lineTo(  hw,  hw - r );
    shape.quadraticCurveTo( hw, hw, hw - r, hw );
    shape.lineTo( -hw + r, hw );
    shape.quadraticCurveTo( -hw, hw, -hw, hw - r );
    shape.lineTo( -hw, -hw + r );
    shape.quadraticCurveTo( -hw, -hw, -hw + r, -hw );
    
    const extrudeSettings = { depth: def.size.y, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    mesh = new THREE.Mesh(geometry, def.material());
    // The geometry is extruded along Z, so we rotate it to stand up along Y.
    mesh.rotation.x = -Math.PI / 2;
    // We also offset it so its base is at the group's origin.
    mesh.position.z = -def.size.y / 2;

  } else {
    // Default to BoxGeometry for other parts like the floor
    const geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z);
    mesh = new THREE.Mesh(geometry, def.material());
  }
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add userData for the builder to identify parts
  mesh.userData.part = def;
  
  group.add(mesh);
  // We return the group, which the builder will place.
  // The mesh inside is already transformed correctly.
  return group;
}
