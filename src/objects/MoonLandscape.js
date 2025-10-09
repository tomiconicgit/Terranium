import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createMoonLandscape() {
    const geometry = new THREE.PlaneGeometry(100, 100, 32, 32);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}