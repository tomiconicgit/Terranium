// src/objects/terrain.js: Creates lunar surface

export function createTerrain() {
    const geometry = new THREE.PlaneGeometry(100, 100, 50, 50);
    const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, wireframe: true }); // Placeholder; add texture if confirmed
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    return terrain;
}