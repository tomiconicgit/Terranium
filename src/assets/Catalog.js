import * as THREE from 'three';

// This function defines all the buildable items in the game.
export function makeCatalog() {
  return [
    { id:'metal_flat', name:'Metal Flat', baseType:'flat', kind:'flat', material: matMetal,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:'#b8c2cc' },
    { id:'metal_wall', name:'Metal Wall', baseType:'wall', kind:'wall', material: matWall,
      size:{x:3, y:3, z:0.2}, thickness:0.2, preview:'#dfe6ee' },
    { id:'concrete_flat', name:'Concrete Flat', baseType:'flat', kind:'flat', material: matConcrete,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:'#9a9a9a' },
    { id:'concrete_wall', name:'Concrete Wall', baseType:'wall', kind:'wall', material: matConcrete,
      size:{x:3, y:3, z:0.2}, thickness:0.2, preview:'#c0c0c0' },
  ];
}

/**
 * Creates the actual 3D mesh for a given building part definition.
 * The origin of the returned group is the object's geometric center.
 */
export function buildPart(def) {
  const g = new THREE.Group();
  let mesh;
  const material = def.material(); // Call the material function

  if (def.baseType === 'wall'){
    mesh = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), material);
  } else if (def.baseType === 'flat'){
    mesh = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), material);
  }

  if (mesh) g.add(mesh);
  return g;
}

// --- Materials ---

function matMetal(){ return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matWall(){  return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

// Procedural Concrete Material (CORRECTED)
function matConcrete() {
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0b0b0,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Attach custom shader logic
  concreteMaterial.onBeforeCompile = (shader) => {
    // Pass the object's world position from the vertex shader to the fragment shader
    shader.vertexShader = 'varying vec3 vWorldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPosition = worldPosition.xyz;
      `
    );

    // Add our procedural noise functions and modify the final color
    shader.fragmentShader = 'varying vec3 vWorldPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>

      // 2D pseudo-random function
      float rand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }

      // 2D value noise function
      float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u); // Smoothstep

        float res = mix(
          mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
          mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
        return res*res;
      }
      `
    );

    // Inject our color modification logic at the end of the shader
    shader.fragmentShader = shader.fragmentShader.replace(
      /$/, // This regex matches the end of the string
      `
      // Apply procedural noise after main() runs
      void main() {
        super_main(); // Run the original main function

        // Use world position for seamless noise across objects
        vec2 uv1 = vWorldPosition.xz * 1.1; // Larger blobs
        vec2 uv2 = vWorldPosition.xz * 4.0; // Finer grain

        float n = (noise(uv1) * 0.6) + (noise(uv2) * 0.4);

        // Darken the color in spots to create a concrete look
        float darkness = smoothstep(0.4, 0.8, n) * 0.15;
        gl_FragColor.rgb -= darkness;
      }
      `
    );
    // We need to rename the original main function so we can call it
    shader.fragmentShader = shader.fragmentShader.replace('void main()', 'void super_main()');
  };

  // Add a custom property to identify our special material
  concreteMaterial.isProcedural = true;

  return concreteMaterial;
}
