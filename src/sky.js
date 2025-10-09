import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createSky(scene, renderer, manager) {
  // Sky dome (visual)
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const U = sky.material.uniforms;
  U.turbidity.value = 2.0;
  U.rayleigh.value = 1.2;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.8;

  // Sun position from elevation/azimuth
  const sun = new THREE.Vector3();
  let elevation = 25.4;
  let azimuth = 180;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sun);
  }
  updateSun();

  // Tone mapping
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Stars
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

  // --- Earth (GLB) — ORIGINAL materials, own lights, separate layer ---
  const EARTH_LAYER = 1;

  const earthGroup = new THREE.Group();
  earthGroup.layers.set(EARTH_LAYER);
  scene.add(earthGroup);

  // Lights that only affect Earth
  const earthDir = new THREE.DirectionalLight(0xffffff, 1.2);
  earthDir.position.set(100, 150, -90);
  earthDir.layers.set(EARTH_LAYER);
  scene.add(earthDir);

  const earthAmb = new THREE.AmbientLight(0xffffff, 0.4);
  earthAmb.layers.set(EARTH_LAYER);
  scene.add(earthAmb);

  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('src/assets/models/earth/earth.glb', (gltf) => {
    const root = gltf.scene || gltf.scenes[0];

    root.traverse((obj) => {
      if (obj.isMesh) {
        // Keep the original PBR materials & textures
        obj.layers.set(EARTH_LAYER);
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });

    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    earthGroup.add(root);

    // Defaults (can be changed via UI)
    earthGroup.scale.setScalar(120);
    earthGroup.position.set(0, 80, -220);

    // Aim the directional at Earth
    earthDir.target.position.copy(earthGroup.position);
    earthDir.target.updateMatrixWorld();
  });

  // --- Public API ---
  const api = {
    update(dt) { starUniforms.uTime.value += dt; },

    // Sky params
    setTurbidity(v) { U.turbidity.value = v; },
    setRayleigh(v) { U.rayleigh.value = v; },
    setMieCoefficient(v) { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg) { elevation = deg; updateSun(); },
    setAzimuth(deg) { azimuth = deg; updateSun(); },

    // Stars
    setStarCount(n) { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px) { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // Earth controls
    setEarthScale(s) {
      const sc = Math.max(0.01, s);
      earthGroup.scale.set(sc, sc, sc);
    },
    setEarthPosition(x, y, z) {
      earthGroup.position.set(x || 0, y || 0, z || 0);
      earthDir.target.position.copy(earthGroup.position);
      earthDir.target.updateMatrixWorld();
    },
    setEarthBrightness(b) {
      const k = Math.max(0, b);
      earthDir.intensity = 0.9 * k;
      earthAmb.intensity = 0.3 * Math.pow(k, 0.9);
    },

    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}