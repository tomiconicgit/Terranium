import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene /*, renderer (unused for lighting) */) {
  // Pure visual sky dome (no lighting side-effects)
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  // Uniform handles from the official example
  const U = sky.material.uniforms;

  // Defaults — you can change them from your UI if you like
  U.turbidity.value = 2.0;
  U.rayleigh.value = 1.2;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.8;

  // Sun position purely for the sky shader
  const sun = new THREE.Vector3();
  let elevation = 6.0;   // degrees
  let azimuth   = 180.0; // degrees

  function updateSun() {
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sun);
  }
  updateSun();

  // No stars added here (keeping this file strictly the example-style sky)

  return {
    // no tick needed for this simple sky
    update() {},

    // Example controls parity (so your existing UI can wire in if desired)
    setTurbidity(v)       { U.turbidity.value = v; },
    setRayleigh(v)        { U.rayleigh.value = v; },
    setMieCoefficient(v)  { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg)     { elevation = deg; updateSun(); },
    setAzimuth(deg)       { azimuth = deg; updateSun(); },

    // Snapshot helper (optional)
    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth
    })
  };
}