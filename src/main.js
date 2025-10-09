import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene /*, renderer (unused) */) {
  // --- Visual sky (from three.js example) ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const U = sky.material.uniforms;
  U.turbidity.value = 2.0;
  U.rayleigh.value = 1.2;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.8;

  // --- Sun direction that drives the Sky shader only (no lighting) ---
  const sunDir = new THREE.Vector3();
  let elevation = 16.5; // deg
  let azimuth   = 360;  // deg

  function updateSun() {
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sunDir.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sunDir);
    // also move the visual sun disk
    placeSunDisk();
  }

  // --- Stars (twinkling) ---
  const maxStars = 15000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(maxStars * 3);
  const starPhase = new Float32Array(maxStars);
  for (let i = 0; i < maxStars; i++) {
    const r = 2200 + Math.random() * 1600;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    starPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starPhase[i] = Math.random() * Math.PI * 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setDrawRange(0, 10000);

  const starUniforms = { uTime: { value: 0 }, uSize: { value: 1.6 }, uSpeed: { value: 0.9 } };
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: starUniforms,
    vertexShader: `
      attribute float phase;
      uniform float uTime, uSize, uSpeed;
      varying float vAlpha;
      void main(){
        float tw = 0.72 + 0.28 * sin(uTime * uSpeed + phase);
        vAlpha = tw;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        float a = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Visual sun disk (billboard quad; no lighting) ---
  const SUN_DISTANCE = 3000;
  const sunDiskGeo = new THREE.PlaneGeometry(1, 1);
  const sunDiskMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uInner: { value: 1.0 }, // inner intensity
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uInner;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float disk = smoothstep(1.0, 0.0, r);       // soft edge
        float glow = smoothstep(1.0, 0.0, r*1.8) * 0.6;
        vec3 col = vec3(1.0) * (disk * uInner + glow);
        gl_FragColor = vec4(col, max(disk, glow));
      }
    `
  });
  const sunDisk = new THREE.Mesh(sunDiskGeo, sunDiskMat);
  sunDisk.renderOrder = 1;
  scene.add(sunDisk);

  let sunSize = 45; // world units width/height of the quad

  function placeSunDisk() {
    // position at far distance along sunDir
    sunDisk.position.set(sunDir.x * SUN_DISTANCE, sunDir.y * SUN_DISTANCE, sunDir.z * SUN_DISTANCE);
    sunDisk.scale.setScalar(sunSize);
  }

  // camera ref for billboard
  let cameraRef = null;
  function faceCamera() {
    if (!cameraRef) return;
    sunDisk.lookAt(cameraRef.position);
  }

  updateSun(); // initial

  const api = {
    update(dt, camera) {
      starUniforms.uTime.value += dt;
      cameraRef = camera;
      faceCamera();
    },

    // Sky params (official)
    setTurbidity(v)       { U.turbidity.value = v; },
    setRayleigh(v)        { U.rayleigh.value = v; },
    setMieCoefficient(v)  { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg)     { elevation = deg; updateSun(); },
    setAzimuth(deg)       { azimuth = deg; updateSun(); },

    // Stars
    setStarCount(n)       { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px)       { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s){ starUniforms.uSpeed.value = s; },

    // Visual sun
    setSunSize(s)         { sunSize = Math.max(1, s); placeSunDisk(); },
    setSunInnerIntensity(v){ sunDiskMat.uniforms.uInner.value = Math.max(0, v); },

    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value,
      sunSize
    })
  };

  return api;
}