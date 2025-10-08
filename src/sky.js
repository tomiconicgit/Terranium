import * as THREE from 'three';

export function createSky(scene) {
  // Directional light (sun)
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(100, 200, 100);
  sunLight.castShadow = true; // enable shadows from sun
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 800;
  sunLight.shadow.camera.left = -200;
  sunLight.shadow.camera.right = 200;
  sunLight.shadow.camera.top = 200;
  sunLight.shadow.camera.bottom = -200;
  scene.add(sunLight);

  // Subtle ambient to lift dark areas
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambientLight);

  // Stars (simple background points)
  const starsGeometry = new THREE.BufferGeometry();
  const COUNT = 10000;
  const starsPositions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT * 3; i += 3) {
    starsPositions[i + 0] = (Math.random() - 0.5) * 2000;
    starsPositions[i + 1] = (Math.random() - 0.5) * 2000 + 500; // keep mostly above horizon
    starsPositions[i + 2] = (Math.random() - 0.5) * 2000;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, sizeAttenuation: true });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // Space background
  scene.background = new THREE.Color(0x000000);
}