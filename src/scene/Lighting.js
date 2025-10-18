// src/scene/Lighting.js
import * as THREE from 'three';

/**
 * Bright midday lighting:
 * - Sun high overhead, neutral-white
 * - Brighter ambient and hemisphere
 */
export function createLighting() {
  const SUN_AZIMUTH_DEG   = 45;
  const SUN_ELEVATION_DEG = 65;

  const az = THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG);
  const el = THREE.MathUtils.degToRad(SUN_ELEVATION_DEG);
  const R  = 600;

  const sunPos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * R,
    Math.sin(el) * R,
    Math.cos(az) * Math.cos(el) * R
  );

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far  = 900;
  sunLight.shadow.camera.left   = -220;
  sunLight.shadow.camera.right  =  220;
  sunLight.shadow.camera.top    =  220;
  sunLight.shadow.camera.bottom = -220;
  sunLight.shadow.bias = -0.0002;

  const hemiLight = new THREE.HemisphereLight(0x8ecaff, 0xf0f3f6, 0.55);
  sunLight.add(hemiLight);

  return { ambientLight, sunLight };
}