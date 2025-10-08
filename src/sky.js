import * as THREE from 'three';

export function createSky(scene) {
    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(100, 200, 100);
    scene.add(sunLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(10000 * 3);
    for (let i = 0; i < 10000 * 3; i += 3) {
        starsPositions[i] = (Math.random() - 0.5) * 2000;
        starsPositions[i + 1] = (Math.random() - 0.5) * 2000 + 500; // Above horizon
        starsPositions[i + 2] = (Math.random() - 0.5) * 2000;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, sizeAttenuation: true });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Set scene background to black for space
    scene.background = new THREE.Color(0x000000);
}