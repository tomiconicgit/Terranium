// src/scene/SkyDome.js

import * as THREE from 'three';

export function createSkyDome() {
  const topColor = new THREE.Color(0x81B2EB); // A nice sky blue
  const bottomColor = new THREE.Color(0xF0F8FF); // A very light, almost white horizon

  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  
  const gradient = context.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, topColor.getStyle());
  gradient.addColorStop(1, bottomColor.getStyle());
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 128);
  
  const gradientTexture = new THREE.CanvasTexture(canvas);
  
  const geom = new THREE.SphereGeometry(1500, 32, 16);
  const mat = new THREE.MeshBasicMaterial({
    map: gradientTexture,
    side: THREE.BackSide,
    fog: false // The sky itself should not be affected by fog
  });
  
  const sky = new THREE.Mesh(geom, mat);
  sky.name = 'skydome';
  return sky;
}
