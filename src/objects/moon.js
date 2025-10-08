// src/objects/moon.js: Creates large moon in sky

export function createMoon() {
    const geometry = new THREE.SphereGeometry(10, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const moon = new THREE.Mesh(geometry, material);
    moon.position.set(0, 20, -50);
    return moon;
}