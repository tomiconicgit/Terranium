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
  
  // Create a single, powerful material that can be customized.
  const material = new THREE.MeshStandardMaterial({
    envMap: dynamicEnvMap,
    side: THREE.DoubleSide
  });

  // Use onBeforeCompile to inject custom rust shader logic
  material.onBeforeCompile = (shader) => {
    // Pass custom data (uniforms) to the shader
    shader.uniforms.u_rust = { value: 0.0 };
    shader.uniforms.u_rustColor = { value: new THREE.Color(0x5c2a11) };
    shader.uniforms.u_rustRoughness = { value: 0.85 };

    // Add a varying to pass world position to the fragment shader
    shader.vertexShader = 'varying vec3 v_worldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       v_worldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    // Inject the rust logic into the fragment shader
    shader.fragmentShader = `
      uniform float u_rust;
      uniform vec3 u_rustColor;
      uniform float u_rustRoughness;
      varying vec3 v_worldPosition;

      // Simple procedural noise function
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5;
        for (int i=0; i<3; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
    ` + shader.fragmentShader;

    // At the end of the shader, mix in the rust
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float rustFactor = fbm(v_worldPosition * 0.3);
      if (rustFactor < u_rust) {
        // Mix final color, roughness, and metalness
        gl_FragColor.rgb = mix(gl_FragColor.rgb, u_rustColor, 0.8);
        #ifdef USE_ROUGHNESSMAP
          // This line is complex, it finds where roughness is set and modifies it
          float finalRoughness = mix(roughness, u_rustRoughness, 1.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, u_rustColor, 0.8);
        #endif
        // Make rusty parts non-metallic
        gl_FragColor = vec4(gl_FragColor.rgb * (1.0 - metalnessFactor * 0.9), gl_FragColor.a);
      }`
    );
    
    // Store the uniforms on the material so we can access them later
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
