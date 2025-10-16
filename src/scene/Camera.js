import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createCamera() {
    const fov = 60; // Field of View
    const aspect = window.innerWidth / window.innerHeight; // Aspect Ratio
    const near = 0.1; // Near clipping plane
    const far = 2000; // Far clipping plane

    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    
    // Initial position of the player/camera
    camera.position.set(0, 2, 5); // Stand on the ground, slightly back
    camera.lookAt(0, 1, 0); // Look forward

    return camera;
}
