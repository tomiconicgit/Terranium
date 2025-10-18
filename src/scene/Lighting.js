// src/scene/Lighting.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

/**
 * Bright midday lighting:
 * - Sun high overhead, neutral-white
 * - Brighter ambient and hemisphere (blue sky / light ground)
 * - Crisp, well-defined shadows (can adjust map size/frustum if needed)
 */
export function createLighting() {
  // === Sun angles (degrees) ===
  const SUN_AZIMUTH_DEG   = 45; // rotate where the sun is around the scene
  const SUN_ELEVATION_DEG = 65; // high in the sky for midday

  const az = THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG);
  const el = THREE.MathUtils.degToRad(SUN_ELEVATION_DEG);
  const R  = 600;

  const sunPos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * R,
    Math.sin(el) * R,
    Math.cos(az) * Math.cos(el) * R
  );

  // Bright, neutral ambient fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

  // Neutral-white sun (slight warmth removed for midday)
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;

  // Shadows: crisp, wide enough for your scene
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far  = 900;
  sunLight.shadow.camera.left   = -220;
  sunLight.shadow.camera.right  =  220;
  sunLight.shadow.camera.top    =  220;
  sunLight.shadow.camera.bottom = -220;
  // Small bias helps avoid acne with bright overhead light
  sunLight.shadow.bias = -0.0002;

  // Hemisphere light: bright blue sky above, light ground bounce below
  const hemiLight = new THREE.HemisphereLight(0x8ecaff, 0xf0f3f6, 0.55);
  // Parent to sun so Main.js adding { ambientLight, sunLight } still includes it
  sunLight.add(hemiLight);

  // Return the two lights Main.js expects
  return { ambientLight, sunLight };
}