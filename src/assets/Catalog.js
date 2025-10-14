// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Metal Floor", baseType: "flat", size: {x:4, y:0.2, z:4}, preview:"#e0e5e9" },
    { id: "metal_wall", name: "Sci-Fi Wall", baseType: "wall", size: {x:4, y:4, z:0.2}, preview:"#c0c5c9" },
    { id: "guard_rail", name: "Guard Rail", baseType: "railing", size: {x:4, y:2, z:0.2}, preview:"#d0d5d9" },
    { id: "sci_fi_ramp", name: "Ramp", baseType: "ramp", size: {x:4, y:2, z:6}, preview: "#b0b5b9"},
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
  if (def.id === "metal_wall") {
    const w = def.size.x, h = def.size.y;
    const hw = w/2, hh = h/2;
    const inset = 0.1, panelHeight = h * 0.4;

    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh); shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);
    
    // Create two inset panels as holes
    const topPanel = new THREE.Path();
    topPanel.moveTo(-hw + inset, hh - inset);
    topPanel.lineTo(hw - inset, hh - inset);
    topPanel.lineTo(hw - inset, hh - inset - panelHeight);
    topPanel.lineTo(-hw + inset, hh - inset - panelHeight);
    shape.holes.push(topPanel);

    const bottomPanel = new THREE.Path();
    bottomPanel.moveTo(-hw + inset, -hh + inset);
    bottomPanel.lineTo(hw - inset, -hh + inset);
    bottomPanel.lineTo(hw - inset, -hh + inset + panelHeight);
    bottomPanel.lineTo(-hw + inset, -hh + inset + panelHeight);
    shape.holes.push(bottomPanel);
    
    const extrudeSettings = { depth: def.size.z * 0.5, steps: 1, bevelEnabled: false };
    const mainGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    const backGeo = new THREE.PlaneGeometry(w, h);
    backGeo.translate(0, 0, -def.size.z * 0.25);
    
    const mainMesh = new THREE.Mesh(mainGeo, material);
    const backMesh = new THREE.Mesh(backGeo, material);
    
    partObject = new THREE.Group().add(mainMesh, backMesh);
    partObject.rotation.y = Math.PI; // Orient correctly
    partObject.position.z += def.size.z / 2;
    
  } else if (def.id === "guard_rail") {
    const w = def.size.x, h = def.size.y;
    const hw = w/2, hh = h/2;
    const postRadius = 0.1, topRailRadius = 0.08;

    const shape = new THREE.Shape();
    // Left post
    shape.absarc(-hw + postRadius, -hh + postRadius, postRadius, Math.PI, Math.PI * 1.5);
    shape.absarc(-hw + postRadius, hh - postRadius, postRadius, Math.PI * 1.5, Math.PI * 2);
    // Top rail
    shape.absarc(hw - topRailRadius, hh - topRailRadius, topRailRadius, Math.PI * 2, Math.PI * 2.5);
    // Right post
    shape.absarc(hw - postRadius, hh - postRadius, postRadius, 0, Math.PI * 0.5);
    shape.absarc(hw - postRadius, -hh + postRadius, postRadius, Math.PI * 0.5, Math.PI);
    // Bottom line
    shape.lineTo(-hw + postRadius, -hh);

    // Inner chain-link style holes
    const diamondW = 0.2, diamondH = 0.3;
    const numX = Math.floor((w - postRadius*2) / diamondW);
    const numY = Math.floor((h - topRailRadius - postRadius) / diamondH);
    for (let i = 0; i < numX; i++) {
        for (let j = 0; j < numY; j++) {
            const cx = -hw + postRadius + (i + 0.5) * diamondW;
            const cy = -hh + postRadius + (j + 0.5) * diamondH;
            const hole = new THREE.Path();
            hole.moveTo(cx, cy - diamondH/2);
            hole.lineTo(cx + diamondW/2, cy);
            hole.lineTo(cx, cy + diamondH/2);
            hole.lineTo(cx - diamondW/2, cy);
            shape.holes.push(hole);
        }
    }
    
    const extrudeSettings = { depth: def.size.z, steps: 1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    partObject = new THREE.Group().add(new THREE.Mesh(geometry, material));

  } else if (def.id === "sci_fi_ramp") {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const hw = w/2, hh = h/2, hd = d/2;

    const shape = new THREE.Shape();
    // Sloped top surface
    shape.moveTo(-hw, hh);
    shape.lineTo(hw, hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(-hw, -hh);

    const extrudeSettings = {
        steps: 2,
        depth: d,
        bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.translate(0, 0, -hd);
    
    // Make it a ramp by moving vertices
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < -0.1) { // If vertex is at the far end of the ramp
            pos.setY(i, pos.getY(i) - h);
        }
    }
    geometry.computeVertexNormals();

    partObject = new THREE.Mesh(geometry, material);

  } else if (def.id === "metal_beam") {
    const width = def.size.x, height = def.size.z, depth = def.size.y;
    const hw = width/2, hh = height/2, radius = 0.1;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + radius, -hh); shape.lineTo(hw - radius, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + radius); shape.lineTo(hw, hh - radius);
    shape.quadraticCurveTo(hw, hh, hw - radius, hh); shape.lineTo(-hw + radius, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - radius); shape.lineTo(-hw, -hh + radius);
    shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);
    
    const extrudeSettings = { depth: depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const isVertical = def.id === "steel_beam";
    const width = isVertical ? def.size.x : def.size.z; const height = isVertical ? def.size.z : def.size.y;
    const depth = isVertical ? def.size.y : def.size.x;
    
    const flangeThickness = height * 0.15, webThickness = width * 0.15;
    const hw = width / 2, hh = height / 2, hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;
    const radius = 0.05;

    const shape = new THREE.Shape();
    shape.moveTo(hw - radius, hh); shape.quadraticCurveTo(hw, hh, hw, hh - radius);
    shape.lineTo(hw, hh_flange_inner + radius); shape.quadraticCurveTo(hw, hh_flange_inner, hw - radius, hh_flange_inner);
    shape.lineTo(hw_web + radius, hh_flange_inner); shape.quadraticCurveTo(hw_web, hh_flange_inner, hw_web, hh_flange_inner - radius);
    shape.lineTo(hw_web, -hh_flange_inner + radius); shape.quadraticCurveTo(hw_web, -hh_flange_inner, hw_web + radius, -hh_flange_inner);
    shape.lineTo(hw - radius, -hh_flange_inner); shape.quadraticCurveTo(hw, -hh_flange_inner, hw, -hh_flange_inner - radius);
    shape.lineTo(hw, -hh + radius); shape.quadraticCurveTo(hw, -hh, hw - radius, -hh);
    shape.lineTo(-hw + radius, -hh); shape.quadraticCurveTo(-hw, -hh, -hw, -hh + radius);
    shape.lineTo(-hw, -hh_flange_inner - radius); shape.quadraticCurveTo(-hw, -hh_flange_inner, -hw + radius, -hh_flange_inner);
    shape.lineTo(-hw_web - radius, -hh_flange_inner); shape.quadraticCurveTo(-hw_web, -hh_flange_inner, -hw_web, -hh_flange_inner + radius);
    shape.lineTo(-hw_web, hh_flange_inner - radius); shape.quadraticCurveTo(-hw_web, hh_flange_inner, -hw_web - radius, hh_flange_inner);
    shape.lineTo(-hw + radius, hh_flange_inner); shape.quadraticCurveTo(-hw, hh_flange_inner, -hw, hh_flange_inner + radius);
    shape.lineTo(-hw, hh - radius); shape.quadraticCurveTo(-hw, hh, -hw + radius, hh);
    shape.lineTo(hw - radius, hh);

    const extrudeSettings = { depth, steps: tessellation, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    if (isVertical) mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.y = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else { // Default for metal_floor
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
