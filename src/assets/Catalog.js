// src/assets/Catalog.js
import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- Procedural Building Catalog ---------- */
export function makeCatalog() {
  return [
    { id: "metal_floor", name: "Sci-Fi Floor", baseType: "flat", size: {x:4, y:0.2, z:4}, preview:"#707C8D" },
    { id: "metal_wall", name: "Sci-Fi Wall", baseType: "wall", size: {x:4, y:4, z:0.2}, preview:"#434B57" },
    { id: "guard_rail", name: "Guard Rail", baseType: "railing", size: {x:4, y:2, z:0.2}, preview:"#d0d5d9" },
    { id: "sci_fi_ramp", name: "Ramp", baseType: "ramp", size: {x:4, y:2, z:6}, preview: "#b0b5b9"},
    { id: "metal_beam", name: "Metal Beam", baseType: "vertical", size: {x:1, y:4, z:1}, preview:"#e0e5e9" },
    { id: "steel_beam", name: "Steel Beam", baseType: "vertical", size: {x:0.8, y:4, z:1}, preview:"#c0c5c9" },
    { id: "steel_beam_h", name: "Steel Beam (H)", baseType: "horizontal", size: {x:4, y:1, z:0.8}, preview:"#b5bac0" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def, options = {}, dynamicEnvMap) {
  const { tessellation = 1, primaryColor, floorColors, wallColors } = options;
  
  const createMaterial = (color) => new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide,
    color: color,
    roughness: options.roughness,
    metalness: options.metalness,
  });

  let partObject;
  if (def.id === "metal_wall") {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const materials = wallColors.map(c => createMaterial(c));
    const group = new THREE.Group();

    // Frame (Material 0)
    const frameGeo = new RoundedBoxGeometry(w, h, d, 2, 0.05);
    const frame = new THREE.Mesh(frameGeo, materials[0]);
    group.add(frame);
    
    // Main Panels (Material 1)
    const panelGeo = new THREE.BoxGeometry(w * 0.9, h * 0.9, d * 1.1);
    const panels = new THREE.Mesh(panelGeo, materials[1]);
    group.add(panels);
    
    // Inner Detail (Material 2)
    const innerGeo = new THREE.BoxGeometry(w * 0.92, h * 0.4, d * 1.2);
    const inner = new THREE.Mesh(innerGeo, materials[2]);
    group.add(inner);
    
    // Accent Lights (Material 3)
    const lightGeo = new THREE.BoxGeometry(w * 0.95, 0.1, d * 1.3);
    const light1 = new THREE.Mesh(lightGeo, materials[3]);
    light1.position.y = h * 0.25;
    const light2 = new THREE.Mesh(lightGeo, materials[3]);
    light2.position.y = -h * 0.25;
    group.add(light1, light2);

    partObject = group;

  } else if (def.id === "metal_floor") {
    const w = def.size.x, d = def.size.z, h = def.size.y;
    const materials = floorColors.map(c => createMaterial(c));
    const group = new THREE.Group();

    // Base (Material 0)
    const baseGeo = new THREE.BoxGeometry(w, h, d);
    const base = new THREE.Mesh(baseGeo, materials[0]);
    group.add(base);

    // Top Panel (Material 1)
    const panelGeo = new THREE.BoxGeometry(w * 0.9, h * 0.5, d * 0.9);
    const panel = new THREE.Mesh(panelGeo, materials[1]);
    panel.position.y = h * 0.5;
    group.add(panel);

    // Grooves (Material 2)
    const grooveGeo = new THREE.BoxGeometry(w * 1.01, h * 0.2, 0.1);
    const groove1 = new THREE.Mesh(grooveGeo, materials[2]);
    groove1.position.y = h * 0.5;
    groove1.position.z = d * 0.3;
    const groove2 = new THREE.Mesh(grooveGeo, materials[2]);
    groove2.position.y = h * 0.5;
    groove2.position.z = -d * 0.3;
    group.add(groove1, groove2);

    // Lights (Material 3 with emissive)
    materials[3].emissive = new THREE.Color(floorColors[3]);
    materials[3].emissiveIntensity = 2;
    const lightGeo = new THREE.CylinderGeometry(0.1, 0.1, h * 2, 8);
    lightGeo.rotateX(Math.PI / 2);
    const light1 = new THREE.Mesh(lightGeo, materials[3]);
    light1.position.set(w * 0.4, h * 0.5, d * 0.4);
    const light2 = new THREE.Mesh(lightGeo, materials[3]);
    light2.position.set(-w * 0.4, h * 0.5, d * 0.4);
    const light3 = new THREE.Mesh(lightGeo, materials[3]);
    light3.position.set(w * 0.4, h * 0.5, -d * 0.4);
    const light4 = new THREE.Mesh(lightGeo, materials[3]);
    light4.position.set(-w * 0.4, h * 0.5, -d * 0.4);
    group.add(light1, light2, light3, light4);

    partObject = group;

  } else if (def.id === "guard_rail") {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const hw = w/2, hh = h/2;
    const material = createMaterial(primaryColor);
    const group = new THREE.Group();
    
    // Posts
    const postGeo = new RoundedBoxGeometry(d * 1.5, h, d * 1.5, 4, d * 0.7);
    const post1 = new THREE.Mesh(postGeo, material);
    post1.position.x = -hw + (d*0.75);
    const post2 = new THREE.Mesh(postGeo, material);
    post2.position.x = hw - (d*0.75);
    group.add(post1, post2);

    // Top Rail
    const railGeo = new RoundedBoxGeometry(w - (d*1.5), d * 2, d * 2, 4, d);
    const rail = new THREE.Mesh(railGeo, material);
    rail.position.y = hh - d;
    group.add(rail);

    // Bars
    const numBars = 7;
    const barGeo = new THREE.CylinderGeometry(d*0.5, d*0.5, h - (d*2), 8);
    for (let i = 0; i < numBars; i++) {
        const bar = new THREE.Mesh(barGeo, material);
        bar.position.x = (-hw * 0.7) + i * (hw * 1.4 / (numBars - 1));
        bar.position.y = -d;
        group.add(bar);
    }
    partObject = group;

  } else if (def.id === "sci_fi_ramp") {
    const w = def.size.x, h = def.size.y, d = def.size.z;
    const hw = w/2, hh = h/2, hd = d/2;
    const material = createMaterial(primaryColor);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, hh); shape.lineTo(hw, hh);
    shape.lineTo(hw, -hh); shape.lineTo(-hw, -hh);

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geometry.translate(0, 0, -hd);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < -0.1) { pos.setY(i, pos.getY(i) - h); }
    }
    geometry.computeVertexNormals();
    partObject = new THREE.Mesh(geometry, material);

  } else if (def.id === "metal_beam") {
    const material = createMaterial(primaryColor);
    const width = def.size.x, height = def.size.z, depth = def.size.y;
    const hw = width/2, hh = height/2, radius = 0.1;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + radius, -hh); shape.lineTo(hw - radius, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + radius); shape.lineTo(hw, hh - radius);
    shape.quadraticCurveTo(hw, hh, hw - radius, hh); shape.lineTo(-hw + radius, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - radius); shape.lineTo(-hw, -hh + radius);
    shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth, steps: tessellation, bevelEnabled: false });
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const material = createMaterial(primaryColor);
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
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: tessellation, bevelEnabled: false });
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    if (isVertical) mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.y = Math.PI / 2;
    partObject = new THREE.Group().add(mesh);

  } else { // Default for basic metal_floor
    const material = createMaterial(primaryColor);
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
