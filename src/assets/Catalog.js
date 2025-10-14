// src/assets/Catalog.js
import * as THREE from "three";

// --- Material Library ---
// ✨ FIX: Removed the skybox texture and redefined 'reflective' material.
const MATERIALS = {
  'wireframe': new THREE.MeshBasicMaterial({ wireframe: true, color: 0x4dd2ff }),
  'flat': new THREE.MeshPhongMaterial({ color: 0xc0c5c9, specular: 0x000000, flatShading: true, side: THREE.DoubleSide }),
  'smooth': new THREE.MeshLambertMaterial({ color: 0xc0c5c9, side: THREE.DoubleSide }),
  'glossy': new THREE.MeshStandardMaterial({ color: 0xc0c5c9, metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide }),
  'reflective': new THREE.MeshStandardMaterial({ color: 0xb0b5b9, metalness: 0.95, roughness: 0.0, side: THREE.DoubleSide }),
};

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat", size: {x:4, y:0.2, z:4}, preview:"#e0e5e9" },
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical", size: {x:1, y:4, z:1}, preview:"#e0e5e9" },
    { id: "steel_beam", name: "Steel Beam", baseType: "vertical", size: {x:0.8, y:4, z:1}, preview:"#c0c5c9" },
    { id: "steel_beam_h", name: "Steel Beam (H)", baseType: "horizontal", size: {x:4, y:1, z:0.8}, preview:"#b5bac0" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}) {
  const { shading = 'glossy', tessellation = 1 } = options;
  let partObject;
  const material = MATERIALS[shading] || MATERIALS['glossy'];

  if (def.id === "metal_beam") {
    const shape = new THREE.Shape();
    const w = def.size.x;
    const r = 0.1;
    const hw = w / 2;
    shape.moveTo(-hw + r, -hw); shape.lineTo(hw - r, -hw);
    shape.quadraticCurveTo(hw, -hw, hw, -hw + r); shape.lineTo(hw, hw - r);
    shape.quadraticCurveTo(hw, hw, hw - r, hw); shape.lineTo(-hw + r, hw);
    shape.quadraticCurveTo(-hw, hw, -hw, hw - r); shape.lineTo(-hw, -hw + r);
    shape.quadraticCurveTo(-hw, -hw, -hw + r, -hw);
    
    const extrudeSettings = { depth: def.size.y, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    
    const group = new THREE.Group();
    group.add(mesh);
    partObject = group;

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const shape = new THREE.Shape();
    const isVertical = def.id === "steel_beam";
    const width = isVertical ? def.size.x : def.size.z;
    const height = isVertical ? def.size.z : def.size.y;
    const depth = isVertical ? def.size.y : def.size.x;
    
    const flangeThickness = height * 0.15;
    const webThickness = width * 0.15;
    const hw = width / 2, hh = height / 2;
    const hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;

    shape.moveTo(-hw, hh); shape.lineTo(hw, hh); shape.lineTo(hw, hh_flange_inner);
    shape.lineTo(hw_web, hh_flange_inner); shape.lineTo(hw_web, -hh_flange_inner);
    shape.lineTo(hw, -hh_flange_inner); shape.lineTo(hw, -hh); shape.lineTo(-hw, -hh);
    shape.lineTo(-hw, -hh_flange_inner); shape.lineTo(-hw_web, -hh_flange_inner);
    shape.lineTo(-hw_web, hh_flange_inner); shape.lineTo(-hw, hh_flange_inner); shape.lineTo(-hw, hh);

    const extrudeSettings = { depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const mesh = new THREE.Mesh(geometry, material);
    if (isVertical) mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.y = Math.PI / 2;
    
    const group = new THREE.Group();
    group.add(mesh);
    partObject = group;

  } else { // Default for metal_floor
    const geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z);
    partObject = new THREE.Mesh(geometry, material);
  }
  
  partObject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  partObject.userData.part = def;
  return partObject;
}
