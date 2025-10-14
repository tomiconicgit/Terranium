// src/assets/Catalog.js
import * as THREE from "three";

const matMetalFloor = new THREE.MeshStandardMaterial({
  color: 0xe0e5e9,
  metalness: 0.9,
  roughness: 0.45,
});

const matMetalBeam = matMetalFloor;

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat",
      material: () => matMetalFloor, size: {x:4, y:0.2, z:4}, preview:"#e0e5e9" },
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical",
      material: () => matMetalBeam, size: {x:1, y:4, z:1}, preview:"#e0e5e9" },
    { id: "steel_beam", name: "Steel Beam", baseType: "vertical",
      material: () => matMetalBeam, size: {x:0.8, y:4, z:1}, preview:"#c0c5c9" },
    { id: "steel_beam_h", name: "Steel Beam (H)", baseType: "horizontal",
      material: () => matMetalBeam, size: {x:4, y:1, z:0.8}, preview:"#b5bac0" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  let partObject; // This will be the final object returned (Mesh or Group)

  if (def.id === "metal_beam") {
    // ✨ FIX: Use ExtrudeGeometry for beams with rounded vertical edges and flat tops/bottoms.
    const shape = new THREE.Shape();
    const w = def.size.x;
    const r = 0.1; // corner radius
    const hw = w / 2; // half-width
    shape.moveTo(-hw + r, -hw);
    shape.lineTo(hw - r, -hw);
    shape.quadraticCurveTo(hw, -hw, hw, -hw + r);
    shape.lineTo(hw, hw - r);
    shape.quadraticCurveTo(hw, hw, hw - r, hw);
    shape.lineTo(-hw + r, hw);
    shape.quadraticCurveTo(-hw, hw, -hw, hw - r);
    shape.lineTo(-hw, -hw + r);
    shape.quadraticCurveTo(-hw, -hw, -hw + r, -hw);
    
    const extrudeSettings = { depth: def.size.y, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center(); // Center the geometry on its local origin

    const mesh = new THREE.Mesh(geometry, def.material());
    mesh.rotation.x = Math.PI / 2; // Rotate to stand upright on Y-axis
    
    const group = new THREE.Group();
    group.add(mesh);
    partObject = group;

  } else if (def.id === "steel_beam") {
    // Vertical I-beam geometry generation
    const shape = new THREE.Shape();
    const width = def.size.x;    // Flange width
    const height = def.size.z;   // Profile height
    const flangeThickness = height * 0.15;
    const webThickness = width * 0.15;

    const hw = width / 2, hh = height / 2;
    const hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;

    shape.moveTo(-hw, hh); shape.lineTo(hw, hh); shape.lineTo(hw, hh_flange_inner);
    shape.lineTo(hw_web, hh_flange_inner); shape.lineTo(hw_web, -hh_flange_inner);
    shape.lineTo(hw, -hh_flange_inner); shape.lineTo(hw, -hh); shape.lineTo(-hw, -hh);
    shape.lineTo(-hw, -hh_flange_inner); shape.lineTo(-hw_web, -hh_flange_inner);
    shape.lineTo(-hw_web, hh_flange_inner); shape.lineTo(-hw, hh_flange_inner); shape.lineTo(-hw, hh);

    const extrudeSettings = { depth: def.size.y, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const mesh = new THREE.Mesh(geometry, def.material());
    mesh.rotation.x = Math.PI / 2;
    
    const group = new THREE.Group();
    group.add(mesh);
    partObject = group;
  
  } else if (def.id === "steel_beam_h") {
    // Horizontal I-beam geometry generation
    const shape = new THREE.Shape();
    const width = def.size.z;    // Flange width
    const height = def.size.y;   // Profile height
    const flangeThickness = height * 0.15;
    const webThickness = width * 0.15;

    const hw = width / 2, hh = height / 2;
    const hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;

    shape.moveTo(-hw, hh); shape.lineTo(hw, hh); shape.lineTo(hw, hh_flange_inner);
    shape.lineTo(hw_web, hh_flange_inner); shape.lineTo(hw_web, -hh_flange_inner);
    shape.lineTo(hw, -hh_flange_inner); shape.lineTo(hw, -hh); shape.lineTo(-hw, -hh);
    shape.lineTo(-hw, -hh_flange_inner); shape.lineTo(-hw_web, -hh_flange_inner);
    shape.lineTo(-hw_web, hh_flange_inner); shape.lineTo(-hw, hh_flange_inner); shape.lineTo(-hw, hh);
    
    const extrudeSettings = { depth: def.size.x, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    const mesh = new THREE.Mesh(geometry, def.material());
    mesh.rotation.y = Math.PI / 2; // Rotate to lie along the X-axis
    
    const group = new THREE.Group();
    group.add(mesh);
    partObject = group;

  } else {
    // Default to BoxGeometry for other parts like the floor
    const geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z);
    partObject = new THREE.Mesh(geometry, def.material());
  }
  
  partObject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // Add userData to the root object for the builder to identify it
  partObject.userData.part = def;
  return partObject;
}
