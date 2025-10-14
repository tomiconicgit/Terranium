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
    const hw = w/2, hh = h/2, hd = d/2;
    const postWidth = 0.1, railHeight = 0.1;
    const inset = 0.05; // Inset for the inner rails

    const group = new THREE.Group();

    // Posts (4 corners)
    const postGeometry = new THREE.BoxGeometry(postWidth, h, postWidth);
    const postMat = material.clone(); // Use a clone to potentially vary color/properties later
    
    // Front-left post
    let post = new THREE.Mesh(postGeometry, postMat);
    post.position.set(-hw + postWidth/2, 0, hd - postWidth/2);
    group.add(post);
    // Front-right post
    post = new THREE.Mesh(postGeometry, postMat);
    post.position.set(hw - postWidth/2, 0, hd - postWidth/2);
    group.add(post);
    // Back-left post (assuming it's a thin wall, so depth is small)
    // For a thin wall, only front posts make sense, unless it's a double-sided rail.
    // Let's assume a single plane of posts/rails for a 'thin' railing.
    // If you need back posts, adjust their Z position based on -hd + postWidth/2

    // Top Rail
    const topRailGeometry = new THREE.BoxGeometry(w - postWidth, railHeight, d);
    let topRail = new THREE.Mesh(topRailGeometry, postMat);
    topRail.position.set(0, hh - railHeight/2, 0);
    group.add(topRail);

    // Bottom Rail
    const bottomRailGeometry = new THREE.BoxGeometry(w - postWidth, railHeight, d);
    let bottomRail = new THREE.Mesh(bottomRailGeometry, postMat);
    bottomRail.position.set(0, -hh + railHeight/2, 0);
    group.add(bottomRail);

    // Vertical slats (inner)
    const slatWidth = 0.05;
    const numSlats = 7; // Adjust as needed for density
    const slatSpacing = (w - postWidth * 2 - slatWidth * numSlats) / (numSlats + 1);

    const slatGeometry = new THREE.BoxGeometry(slatWidth, h - railHeight * 2, d);
    for (let i = 0; i < numSlats; i++) {
        let slat = new THREE.Mesh(slatGeometry, postMat);
        slat.position.x = (-hw + postWidth + slatSpacing) + (slatWidth + slatSpacing) * i;
        slat.position.y = 0; // Center vertically between top/bottom rails
        slat.position.z = 0;
        group.add(slat);
    }
    
    partObject = group;

  } else if (def.id === "metal_beam") {
    const width = def.size.x;
    const height = def.size.z; // This is the depth in XY plane for vertical beam
    const depth = def.size.y;   // This is the extrusion depth (height of beam)
    
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const radius = 0.1; // Minor curve radius

    const shape = new THREE.Shape();
    // Start at bottom-left corner
    shape.moveTo(-halfWidth + radius, -halfHeight);
    
    // Bottom edge with rounding
    shape.lineTo(halfWidth - radius, -halfHeight);
    shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
    
    // Right edge
    shape.lineTo(halfWidth, halfHeight - radius);
    
    // Top edge with rounding
    shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
    shape.lineTo(-halfWidth + radius, halfHeight);
    
    // Left edge
    shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
    shape.lineTo(-halfWidth, -halfHeight + radius);
    
    // Close shape
    shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
    
    const extrudeSettings = { depth: depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; // Keep vertical orientation
    partObject = new THREE.Group().add(mesh);

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const isVertical = def.id === "steel_beam";
    const width = isVertical ? def.size.x : def.size.z; // Cross-section width
    const height = isVertical ? def.size.z : def.size.y; // Cross-section height
    const depth = isVertical ? def.size.y : def.size.x; // Extrusion depth (length of beam)
    
    const flangeThickness = height * 0.15, webThickness = width * 0.15;
    const hw = width / 2, hh = height / 2, hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;
    const radius = 0.05; // Small radius for inner and outer corners

    const shape = new THREE.Shape();

    // Start drawing a rounded I-beam shape
    // Top-right corner
    shape.moveTo(hw - radius, hh);
    shape.quadraticCurveTo(hw, hh, hw, hh - radius);
    
    // Right flange inner corner
    shape.lineTo(hw, hh_flflange_inner + radius);
    shape.quadraticCurveTo(hw, hh_flange_inner, hw - radius, hh_flange_inner);
    
    // Right side of top web
    shape.lineTo(hw_web + radius, hh_flange_inner);
    shape.quadraticCurveTo(hw_web, hh_flange_inner, hw_web, hh_flange_inner - radius);
    
    // Right side of web
    shape.lineTo(hw_web, -hh_flange_inner + radius);
    shape.quadraticCurveTo(hw_web, -hh_flange_inner, hw_web + radius, -hh_flange_inner);
    
    // Right flange inner corner (bottom)
    shape.lineTo(hw - radius, -hh_flange_inner);
    shape.quadraticCurveTo(hw, -hh_flange_inner, hw, -hh_flange_inner - radius);
    
    // Bottom-right corner
    shape.lineTo(hw, -hh + radius);
    shape.quadraticCurveTo(hw, -hh, hw - radius, -hh);
    
    // Bottom-left corner
    shape.lineTo(-hw + radius, -hh);
    shape.quadraticCurveTo(-hw, -hh, -hw, -hh + radius);
    
    // Left flange inner corner (bottom)
    shape.lineTo(-hw, -hh_flange_inner - radius);
    shape.quadraticCurveTo(-hw, -hh_flange_inner, -hw + radius, -hh_flange_inner);
    
    // Left side of bottom web
    shape.lineTo(-hw_web - radius, -hh_flange_inner);
    shape.quadraticCurveTo(-hw_web, -hh_flange_inner, -hw_web, -hh_flange_inner + radius);
    
    // Left side of web
    shape.lineTo(-hw_web, hh_flange_inner - radius);
    shape.quadraticCurveTo(-hw_web, hh_flange_inner, -hw_web - radius, hh_flange_inner);
    
    // Left flange inner corner (top)
    shape.lineTo(-hw + radius, hh_flange_inner);
    shape.quadraticCurveTo(-hw, hh_flange_inner, -hw, hh_flange_inner + radius);
    
    // Top-left corner
    shape.lineTo(-hw, hh - radius);
    shape.quadraticCurveTo(-hw, hh, -hw + radius, hh);
    
    // Close shape
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
