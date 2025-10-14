// src/assets/Catalog.js
import * as THREE from "three";

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
export function buildPart(def, options = {}, dynamicEnvMap) {
  const { tessellation = 1 } = options;
  
  const material = new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  // ✨ FIX: Replaced the rust shader with a procedural bump/normal mapping shader.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.u_bumpLevel = { value: 0.0 };
    
    shader.vertexShader = 'varying vec3 v_worldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       v_worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
    );

    shader.fragmentShader = `
      uniform float u_bumpLevel;
      varying vec3 v_worldPosition;

      // Simple procedural noise function
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
    ` + shader.fragmentShader;

    // Inject the normal modification logic
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      
      // Calculate derivatives for noise-based normals
      float noise_x = noise(v_worldPosition.yz * 20.0);
      float noise_y = noise(v_worldPosition.xz * 20.0);
      float noise_z = noise(v_worldPosition.xy * 20.0);
      
      vec3 newNormal = normal + u_bumpLevel * vec3(noise_x, noise_y, noise_z);
      normal = normalize(newNormal);`
    );
    
    material.userData.shader = shader;
  };

  let partObject;
  if (def.id === "metal_beam") {
    const shape = new THREE.Shape();
    const w = def.size.x, r = 0.1, hw = w / 2;
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
    partObject = new THREE.Group().add(mesh);

  } else if (def.id === "steel_beam" || def.id === "steel_beam_h") {
    const shape = new THREE.Shape();
    const isVertical = def.id === "steel_beam";
    const width = isVertical ? def.size.x : def.size.z;
    const height = isVertical ? def.size.z : def.size.y;
    const depth = isVertical ? def.size.y : def.size.x;
    const flangeThickness = height * 0.15, webThickness = width * 0.15;
    const hw = width / 2, hh = height / 2, hw_web = webThickness / 2, hh_flange_inner = hh - flangeThickness;
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
