// SAFE baseline terrain (no fragile shader patches)
// Keeps your displacement + repeat + tint; exposes the same UI API.

import * as THREE from 'three';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);

  const diffuse = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const displacement = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');

  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;

  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Dune shaping
  function noise2(x, z) {
    return (
      Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5 +
      Math.sin(x * 0.013 + z * 0.021) * 0.35 +
      Math.cos(x * 0.002 - z * 0.003) * 0.15
    );
  }
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = Math.max(0, noise2(x, z)) * 6.0 + Math.max(0, noise2(x * 0.5, z * 0.5)) * 3.0;
    pos.setY(i, h);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    displacementMap: displacement,
    displacementScale: 0.5,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: 0xffffff
  });

  let repeat = 48;
  diffuse.repeat.set(repeat, repeat);
  displacement.repeat.set(repeat, repeat);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  return {
    mesh,
    material,
    setDisplacementScale(v){ material.displacementScale = v; },
    setRoughness(v){ material.roughness = v; },
    setRepeat(v){
      const r = Math.max(1, v|0);
      repeat = r;
      diffuse.repeat.set(r, r);
      displacement.repeat.set(r, r);
      diffuse.needsUpdate = true;
      displacement.needsUpdate = true;
    },
    setTintColor(hex){ material.color.set(hex); },

    // UI compatibility placeholders for future blending
    setHeightRange(){},
    setSlopeBias(){},
    setWeights(){},

    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: repeat,
      terrainTint: `#${material.color.getHexString()}`
    })
  };
}