// src/scene/Camera.js
import * as THREE from 'three';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    20000 // 20 km far plane
  );
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 1, 0);
  return camera;
}