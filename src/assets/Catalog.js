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


// --- FINAL, WORKING 100% PROCEDURAL CONCRETE MATERIAL ---

// We create the procedural textures only once and reuse them.
let concreteColorMap = null;

/**
 * Generates a DataTexture with a noise pattern in a specific grayscale range.
 */
function createNoiseTexture(width, height, baseGray, range) {
  const size = width * height;
  const data = new Uint8Array(3 * size); // 3 for R, G, B channels

  for (let i = 0; i < size; i++) {
    const stride = i * 3;
    const gray = Math.floor(baseGray + Math.random() * range);
    data[stride] = gray;
    data[stride + 1] = gray;
    data[stride + 2] = gray;
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  // THIS IS THE FIX: We explicitly tell Three.js that the texture's
  // data represents colors in sRGB space. The renderer will then
  // correctly convert it to linear space for lighting calculations.
  texture.colorSpace = THREE.SRGBColorSpace;
  
  texture.needsUpdate = true;
  return texture;
}

function matConcrete() {
  if (!concreteColorMap) {
    // Create a light grey noise texture.
    concreteColorMap = createNoiseTexture(64, 64, 160, 80);
  }

  const mat = new THREE.MeshStandardMaterial({
    // Set the base color to pure white. This allows the map
    // to show its true colors without being darkened.
    color: 0xffffff,
    map: concreteColorMap,

    metalness: 0.0,   // Not metallic
    roughness: 0.9,   // Very rough, not shiny
  });

  // Scale the texture to look good on the 3x3 surfaces
  mat.map.repeat.set(3, 3);

  return mat;
}
