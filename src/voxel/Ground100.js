// 100×100 instanced 1×1×1 cubes, color = sand. Also returns an invisible
// unit grid plane we can raycast against for placement.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createGround100({ size=100, color=0xe4d3a5 } = {}){
  const geom = new THREE.BoxGeometry(1,1,1);
  const mat  = new THREE.MeshStandardMaterial({ color, roughness:0.95, metalness:0.02 });
  const count = size*size;
  const inst = new THREE.InstancedMesh(geom, mat, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  let i=0, half=size/2;

  for (let x=0; x<size; x++){
    for (let z=0; z<size; z++){
      dummy.position.set(x - half + 0.5, 0.5, z - half + 0.5);
      dummy.updateMatrix(); inst.setMatrixAt(i++, dummy.matrix);
    }
  }
  inst.receiveShadow = true;

  // big thin collider at y=0 (for rays when no block is there yet)
  const raySurface = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ visible:false })
  );
  raySurface.rotation.x = -Math.PI/2;
  return { mesh: inst, raySurface };
}