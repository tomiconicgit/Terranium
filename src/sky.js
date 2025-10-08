import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene, renderer) {
  // --- Official three.js Sky (as in webgl_shaders_sky) ---
  const sky = new Sky();
  sky.scale.setScalar(450000); // huge dome
  scene.add(sky);

  // Sky material uniforms (exact names from the example)
  const uniforms = sky.material.uniforms;
  uniforms[ 'turbidity'    ].value = 2;
  uniforms[ 'rayleigh'     ].value = 1.2;
  uniforms[ 'mieCoefficient'].value = 0.005;
  uniforms[ 'mieDirectionalG' ].value = 0.8;

  // Sun position calculated from elevation/azimuth
  const sun = new THREE.Vector3();
  let elevation = 6;   // degrees
  let azimuth   = 180; // degrees

  function updateSun() {
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    uniforms[ 'sunPosition' ].value.copy(sun);
  }
  updateSun();

  // Exposure (glare)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // --- Add a starfield for "sun in space" vibe ---
  const maxStars = 15000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(maxStars * 3);
  const starPhase = new Float32Array(maxStars);
  for (let i = 0; i < maxStars; i++) {
    const r = 2000 + Math.random() * 1500;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    starPos[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.cos(phi);
    starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    starPhase[i]   = Math.random() * Math.PI * 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setDrawRange(0, 10000); // default visible count

  const starUniforms = {
    uTime:  { value: 0 },
    uSize:  { value: 1.5 },
    uSpeed: { value: 0.8 }
  };
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: starUniforms,
    vertexShader: `
      attribute float phase;
      uniform float uTime;
      uniform float uSize;
      uniform float uSpeed;
      varying float vAlpha;
      void main(){
        float twinkle = 0.72 + 0.28 * sin(uTime * uSpeed + phase);
        vAlpha = twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        float alpha = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Public API for UI ---
  const api = {
    update(dt) { starUniforms.uTime.value += dt; },
    // sky params (match example)
    setTurbidity(v)        { uniforms['turbidity'       ].value = v; },
    setRayleigh(v)         { uniforms['rayleigh'        ].value = v; },
    setMieCoefficient(v)   { uniforms['mieCoefficient'  ].value = v; },
    setMieDirectionalG(v)  { uniforms['mieDirectionalG' ].value = v; },
    setElevation(deg)      { elevation = deg; updateSun(); },
    setAzimuth(deg)        { azimuth = deg;   updateSun(); },
    setExposure(v)         { renderer.toneMappingExposure = v; },

    // stars
    setStarCount(n)        { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px)        { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // snapshot
    _getCurrent: () => ({
      turbidity: uniforms['turbidity'].value,
      rayleigh: uniforms['rayleigh'].value,
      mieCoefficient: uniforms['mieCoefficient'].value,
      mieDirectionalG: uniforms['mieDirectionalG'].value,
      elevation, azimuth,
      exposure: renderer.toneMappingExposure,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}