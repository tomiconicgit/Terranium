// src/scene/Lighting.js

import * as THREE from 'three';

export function createLighting(scene) {
  // Ambient light
  scene.add(new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75));

  // Directional sun light with shadows
  const sunLight = new THREE.DirectionalLight(0xfff9e8, 1.5);
  sunLight.position.set(100, 200, 100); // Higher position for better angle
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 4096; // Increased resolution for large area
  sunLight.shadow.mapSize.height = 4096;
  sunLight.shadow.bias = -0.0001; // Mitigates shadow acne

  // Define the shadow camera frustum to encompass the rocket and terrain
  const frustumSize = 150; // Covers a 300x300 area
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 600; // Increased to ensure rocket is included
  sunLight.shadow.camera.left = -frustumSize;
  sunLight.shadow.camera.right = frustumSize;
  sunLight.shadow.camera.top = frustumSize + 100; // Extra height for the rocket
  sunLight.shadow.camera.bottom = -frustumSize;
  
  scene.add(sunLight);
}
