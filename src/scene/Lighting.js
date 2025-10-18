// src/scene/Lighting.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

/**
 * Dusk lighting tuned to your reference:
 * - low warm sun near horizon (long shadows)
 * - cool ambient/sky fill
 * - subtle hemisphere & cool fill, parented to the sun so Main.js still adds them
 *
 * You can tweak the two angles below to rotate where sunset is coming from.
 */
export function createLighting() {
  // === Sun angles (degrees) ===
  const SUN_AZIMUTH_DEG   = 80; // 0 = +Z, 90 = +X (move this to rotate around)
  const SUN_ELEVATION_DEG = 6;  // near horizon

  const az  = THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG);
  const el  = THREE.MathUtils.degToRad(SUN_ELEVATION_DEG);
  const R   = 600; // distance of the directional light

  const sunPos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * R, // +X to the right
    Math.sin(el) * R,                // height
    Math.cos(az) * Math.cos(el) * R  // +Z forward
  );

  // Cool ambient to keep shadows readable but moody
  const ambientLight = new THREE.AmbientLight(0x243760, 0.28);

  // Warm low sun with strong color like your photo
  const sunLight = new THREE.DirectionalLight(0xffb07a, 0.95);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;

  // Shadows (wider frustum for big scene)
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far  = 900;
  sunLight.shadow.camera.left   = -220;
  sunLight.shadow.camera.right  =  220;
  sunLight.shadow.camera.top    =  220;
  sunLight.shadow.camera.bottom = -220;

  // Subtle hemisphere for sky/ground color separation
  const hemiLight = new THREE.HemisphereLight(0x2a3f70, 0x3c2f22, 0.30);
  // Very gentle cool fill so the back side isn't pitch black
  const fillLight = new THREE.DirectionalLight(0x364a80, 0.12);
  fillLight.position.set(-sunPos.x * 0.4, sunPos.y * 0.5 + 40, -sunPos.z * 0.4);

  // Parent helpers to the sun so Main.js (which only adds ambient & sun) still includes them
  sunLight.add(hemiLight);
  sunLight.add(fillLight);

  return { ambientLight, sunLight };
}