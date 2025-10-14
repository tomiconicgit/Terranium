// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat", size: {x:4, y:0.2, z:4}, preview:"#e0e5e9" },
    { id: "metal_wall", name: "Metal Wall", baseType: "wall", size: {x:4, y:4, z:0.2}, preview:"#c0c5c9" },
    { id: "guard_rail", name: "Guard Rail", baseType: "railing", size: {x:4, y:2, z:0.2}, preview:"#d0d5d9" },
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical", size: {x:1, y:4, z:1}, preview:"#e0e5e9" },
    { id: "steel_beam", name: "Steel Beam", baseType: "vertical", size: {x:0.8, y:4, z:1}, preview:"#c0c5c9" },
    { id: "steel_beam_h", name: "Steel Beam (H)", baseType: "horizontal", size: {x:4, y:1, z:0.8}, preview:"#b5bac0" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const { tessellation = 1 } = options;
  
  const material = new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  let partObject;
  if (def.id === "guard_rail") {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const hw = w/2, hh = h/2;
    const postWidth = 0.1, railHeight = 0.1;

    const group = new THREE.Group();
    const postMat = material.clone();
    
    // Posts
    const postGeometry = new THREE.BoxGeometry(postWidth, h, postWidth);
    let postLeft = new THREE.Mesh(postGeometry, postMat);
    postLeft.position.set(-hw + postWidth/2, 0, 0);
    group.add(postLeft);
    let postRight = new THREE.Mesh(postGeometry, postMat);
    postRight.position.set(hw - postWidth/2, 0, 0);
    group.add(postRight);

    // Rails
    const railGeometry = new THREE.BoxGeometry(w - postWidth, railHeight, d);
    let topRail = new THREE.Mesh(railGeometry, postMat);
    topRail.position.set(0, hh - railHeight/2, 0);
    group.add(topRail);
    let bottomRail = new THREE.Mesh(railGeometry, postMat);
    bottomRail.position.set(0, -hh + railHeight/2, 0);
    group.add(bottomRail);

    // Slats
    const slatWidth = 0.05;
    const numSlats = 7;
    const slatSpacing = (w - postWidth * 2) / (numSlats + 1);
    const slatGeometry = new THREE.BoxGeometry(slatWidth, h - railHeight * 2, d);
    for (let i = 0; i < numSlats; i++) {
        let slat = new THREE.Mesh(slatGeometry, postMat);
        slat.position.x = (-hw + postWidth + slatSpacing) + (i * (slatWidth + slatSpacing));
        group.add(slat);
    }
    partObject = group;

  } else if (def.id === "metal_beam") {
    const width = def.size.x, height = def.size.z, depth = def.size.y;
    const hw = width/2, hh = height/2, radius = 0.1;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + radius, -hh);
    shape.lineTo(hw - radius, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + radius);
    shape.lineTo(hw, hh - radius);
    shape.quadraticCurveTo(hw, hh, hw - radius, hh);
    shape.lineTo(-hw + radius, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - radius);
    shape.lineTo(-hw, -hh + radius);
    shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);
    
    const extrudeSettings = { depth: depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const isVertical = def.id === "steel_beam";
    const width = isVertical ? def.size.x : def.size.z;
    const height = isVertical ? def.size.z : def.size.y;
    const depth = isVertical ? def.size.y : def.size.x;
    
    const flangeThickness = height * 0.15, webThickness = width * 0.15;
    const hw = width / 2, hh = height / 2, hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;
    const radius = 0.05;

    const shape = new THREE.Shape();
    shape.moveTo(hw - radius, hh);
    shape.quadraticCurveTo(hw, hh, hw, hh - radius);
    
    // ✅ FIX: Corrected variable name from hh_flflange_inner to hh_flange_inner
    shape.lineTo(hw, hh_flange_inner + radius);
    shape.quadraticCurveTo(hw, hh_flange_inner, hw - radius, hh_flange_inner);
    
    shape.lineTo(hw_web + radius, hh_flange_inner);
    shape.quadraticCurveTo(hw_web, hh_flange_inner, hw_web, hh_flange_inner - radius);
    shape.lineTo(hw_web, -hh_flange_inner + radius);
    shape.quadraticCurveTo(hw_web, -hh_flange_inner, hw_web + radius, -hh_flange_inner);
    shape.lineTo(hw - radius, -hh_flange_inner);
    shape.quadraticCurveTo(hw, -hh_flange_inner, hw, -hh_flange_inner - radius);
    shape.lineTo(hw, -hh + radius);
    shape.quadraticCurveTo(hw, -hh, hw - radius, -hh);
    shape.lineTo(-hw + radius, -hh);
    shape.quadraticCurveTo(-hw, -hh, -hw, -hh + radius);
    shape.lineTo(-hw, -hh_flange_inner - radius); // This line had a typo in some versions, but seems correct here.
    shape.quadraticCurveTo(-hw, -hh_flange_inner, -hw + radius, -hh_flange_inner);
    shape.lineTo(-hw_web - radius, -hh_flange_inner);
    shape.quadraticCurveTo(-hw_web, -hh_flange_inner, -hw_web, -hh_flange_inner + radius);
    shape.lineTo(-hw_web, hh_flange_inner - radius);
    shape.quadraticCurveTo(-hw_web, hh_flange_inner, -hw_web - radius, hh_flange_inner);
    shape.lineTo(-hw + radius, hh_flange_inner);
    shape.quadraticCurveTo(-hw, hh_flange_inner, -hw, hh_flange_inner + radius);
    shape.lineTo(-hw, hh - radius);
    shape.quadraticCurveTo(-hw, hh, -hw + radius, hh);
    shape.lineTo(hw - radius, hh);

    const extrudeSettings = { depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    if (isVertical) mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.y = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else { // Default for metal_floor and metal_wall
    const geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z, tessellation, 1, tessellation);
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
