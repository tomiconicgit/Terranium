// src/scene/Lighting.js

import * as THREE from 'three';

export function createLighting(scene) {
  // Ambient light
  scene.add(new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75));

  // Directional sun light with shadows
  const sunLight = new THREE.DirectionalLight(0xfff9e8, 1.5);
  sunLight.position.set(100, 100, 100);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  
  scene.add(sunLight);
}
