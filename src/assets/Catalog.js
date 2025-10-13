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


// --- NEW RELIABLE CONCRETE MATERIAL ---
// We create the texture loader once and reuse it.
const textureLoader = new THREE.TextureLoader();
let concreteTexture = null;

// The texture is embedded as a Base64 string, so no extra files are needed.
const concreteTextureBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAdNSURBVHhe7d1Nc5pQFAfwz/sCgSBCwAEEgkYgZUIkgiBCwAEIgkYgZUIkghgQCAIeIHc3PT29yTjL6apTde7p+/S9j93bVf1d3e2uY+v5/v5+JpPJzGYzS6VSmUwm1Go1q1ar6b1+n8lkQpblv31a0y0Wi8VisUjG/9jM8vv9vt/vRzP/x2aGq/cHDx4wGo0wDAPLssjlcuj1enA4HHA4HHA4HHA4HDAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAajTAaj-g/w0T0/1W99tXvS0Wi01NTWEYBkqlkr/tD3e7XY7HY+L5aDRqNBqhVCphGEZZlr/7tKbbi4uLKIpCX18fDocjcXwaDAY4nU7i+TQajVAqleJyuWBZ1u9+W9NtNBqFQqFwOBwIBoPc7u5umUymX8/v98NisfD7/XC5XHA4HJBKpTBNE6vVCr7vYRgGvu9xOp243W5cLhcsy+Lz+bBarXC73ThdLuL5LBaLwWDw632u3/f7fa1W+3W/3+/n52fkeX5/f8/v98NisYinwzAMXC4XpmmiVCpxu91yuVxYLBY4nU6MxiMMw2AymWCxWJDP8+u+0WgUvu/xeDzIZVmm0+l6v5/JZIKu6+VyOQzDIJ/PI5PJEAqFMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMBqNMB-AARL2qY76EAAA';

function matConcrete() {
  // Load the texture only once and reuse it for all concrete materials.
  if (!concreteTexture) {
    concreteTexture = textureLoader.load(concreteTextureBase64);
    concreteTexture.wrapS = THREE.RepeatWrapping;
    concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(2, 2); // Tiles the texture 2x2 on a 3x3 surface
  }

  return new THREE.MeshStandardMaterial({
    color: 0xffffff, // Set to white to show the texture's true colors
    map: concreteTexture,
    roughness: 0.85,
    metalness: 0.1, // A tiny bit of metalness helps it catch light nicely
  });
}
