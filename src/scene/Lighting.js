import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createLighting() {
    // Ambient light to softly illuminate the entire scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

    // Directional light to simulate the sun
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(100, 300, 100); // Position high up, like a sun
    sunLight.castShadow = true; // This light will cast shadows

    // Configure shadow properties for better quality
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    
    // Set the target for the light (where it's pointing)
    sunLight.target.position.set(0, 0, 0);

    return { ambientLight, sunLight };
}
