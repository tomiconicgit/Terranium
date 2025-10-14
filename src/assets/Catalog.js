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
  const { tessellation = 1, noise = 0 } = options;
  
  const material = new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  // ✅ NEW: Add procedural noise via shader injection
  if (noise > 0) {
    material.onBeforeCompile = shader => {
      shader.uniforms.u_noise = { value: noise };
      shader.vertexShader = 'varying vec3 vPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvPosition = position;'
      );
      shader.fragmentShader = 'uniform float u_noise;\nvarying vec3 vPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `
        vec4 diffuseColor = vec4( diffuse, opacity );
        
        // Simple hash-based random function
        float rand(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        // Use world position to generate noise
        float noise = rand(vPosition.xz * 20.0) + rand(vPosition.xy * 20.0);

        // Apply noise by darkening the diffuse color
        diffuseColor.rgb *= (1.0 - u_noise * noise * 0.5);
        `
      );
      // Make uniforms available for later updates if needed
      material.userData.shader = shader;
    };
  }

  let partObject;
  if (def.id === "guard_rail") {
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
