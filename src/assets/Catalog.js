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
  const { tessellation = 1, pattern = 'flat' } = options;
  
  const material = new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  let partObject;
  if (def.id === "metal_floor") {
    // ✅ FIX: Increased base segments for better pattern resolution
    const segments = Math.max(16, 12 * tessellation);
    let geometry;

    if (pattern === 'grating') {
        const shape = new THREE.Shape();
        const w = def.size.x, h = def.size.z;
        const hw = w/2, hh = h/2;
        shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh);
        shape.lineTo(hw, hh); shape.lineTo(-hw, hh);
        shape.lineTo(-hw, -hh);

        const holeSize = 0.2;
        const barSize = 0.05;
        const step = holeSize + barSize;
        const numX = Math.floor(w / step);
        const numZ = Math.floor(h / step);

        for (let i = -numX/2; i < numX/2; i++) {
            for (let j = -numZ/2; j < numZ/2; j++) {
                const hole = new THREE.Path();
                const x = (i * step) + (step / 2 - barSize);
                const z = (j * step) + (step / 2 - barSize);
                hole.moveTo(x - holeSize/2, z - holeSize/2);
                hole.lineTo(x + holeSize/2, z - holeSize/2);
                hole.lineTo(x + holeSize/2, z + holeSize/2);
                hole.lineTo(x - holeSize/2, z + holeSize/2);
                shape.holes.push(hole);
            }
        }
        const extrudeSettings = { depth: def.size.y, bevelEnabled: false };
        geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center().rotateX(-Math.PI / 2);
    } else { // Handle flat, tiles, bricks, hexagons with vertex displacement
        geometry = new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z, segments, 1, segments);
        if (pattern !== 'flat') {
            const pos = geometry.attributes.position;
            const halfThick = def.size.y / 2;
            // ✅ FIX: Increased pattern height to be much more visible
            const patternHeight = def.size.y * 0.75; 

            for (let i = 0; i < pos.count; i++) {
                if (pos.getY(i) > halfThick * 0.99) { // Is vertex on top face?
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    let displacement = 0;

                    if (pattern === 'tiles') {
                        const grout = 0.05;
                        const tileSize = 1.0;
                        const tileX = Math.abs((x + tileSize/2) % tileSize);
                        const tileZ = Math.abs((z + tileSize/2) % tileSize);
                        if (tileX < grout || tileX > tileSize-grout || tileZ < grout || tileZ > tileSize-grout) {
                            displacement = -patternHeight;
                        }
                    } else if (pattern === 'bricks') {
                        const grout = 0.05;
                        const brickW = 1.0, brickH = 0.5;
                        const rowZ = Math.floor((z + 100.0) / brickH);
                        const offsetX = (rowZ % 2 === 0) ? 0 : brickW / 2;
                        const tileX = Math.abs((x + offsetX + brickW/2) % brickW);
                        const tileZ = Math.abs((z + brickH/2) % brickH);
                        if (tileX < grout || tileX > brickW-grout || tileZ < grout || tileZ > brickH-grout) {
                            displacement = -patternHeight;
                        }
                    } else if (pattern === 'hexagons') {
                        const size = 0.5; 
                        const grout = 0.1;
                        const a = 2.0 * Math.PI / (3.0 * size);
                        const b = a / Math.sqrt(3.0);
                        const val = Math.cos(a * x) + Math.cos(b * (x + Math.sqrt(3.0) * z)) + Math.cos(b * (x - Math.sqrt(3.0) * z));
                        if (val < 1.5 - grout) { 
                            displacement = -patternHeight;
                        }
                    }
                    pos.setY(i, halfThick + displacement);
                }
            }
            geometry.computeVertexNormals();
        }
    }
    partObject = new THREE.Mesh(geometry, material);

  } else if (def.id === "guard_rail") {
    const w = def.size.x, h = def.size.y;
    const hw = w/2, hh = h/2;
    const postWidth = 0.1, railHeight = 0.1;
    const numSlats = 7;

    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);

    const railAndPostArea = new THREE.Path();
    railAndPostArea.moveTo(-hw, -hh); railAndPostArea.lineTo(hw, -hh);
    railAndPostArea.lineTo(hw, -hh + railHeight); railAndPostArea.lineTo(-hw, -hh + railHeight);
    railAndPostArea.lineTo(-hw, -hh);
    shape.holes.push(railAndPostArea);

    const topRailArea = new THREE.Path();
    topRailArea.moveTo(-hw, hh); topRailArea.lineTo(hw, hh);
    topRailArea.lineTo(hw, hh - railHeight); topRailArea.lineTo(-hw, hh - railHeight);
    topRailArea.lineTo(-hw, hh);
    shape.holes.push(topRailArea);
    
    const innerWidth = w - postWidth * 2;
    const slatTotalWidth = innerWidth * 0.5;
    const spaceTotalWidth = innerWidth - slatTotalWidth;
    const slatWidth = slatTotalWidth / numSlats;
    const spaceWidth = spaceTotalWidth / (numSlats -1);

    for(let i=0; i < numSlats - 1; i++){
        const hole = new THREE.Path();
        const x = -hw + postWidth + (i * (slatWidth + spaceWidth)) + slatWidth;
        hole.moveTo(x, -hh + railHeight); hole.lineTo(x + spaceWidth, -hh + railHeight);
        hole.lineTo(x + spaceWidth, hh - railHeight); hole.lineTo(x, hh - railHeight);
        hole.lineTo(x, -hh + railHeight);
        shape.holes.push(hole);
    }
    
    const extrudeSettings = { depth: def.size.z, steps: 1, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    partObject = new THREE.Group().add(new THREE.Mesh(geometry, material));

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

  } else { // Default for metal_wall
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
