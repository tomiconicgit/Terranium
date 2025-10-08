// src/camera.js: Creates the camera

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0); // Position on/above terrain for first-person
    return camera;
}