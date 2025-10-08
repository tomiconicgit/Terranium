// src/scene.js: Creates the Three.js scene

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000022); // Dark blue night
    return scene;
}