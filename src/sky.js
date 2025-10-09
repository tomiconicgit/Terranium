import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createSky(scene, renderer, manager) {
  // --- Sky dome (visual only; does not light terrain) ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  // Sky uniforms
  const U = sky.material.uniforms;
  U.turbidity.value = 0.0;
  U.rayleigh.value = 0.03;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.03;

  // Separate SKY exposure (dome only)
  const skyExposureUniform = { value: 1.0 };
  sky.material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkyExposure = skyExposureUniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      /gl_FragColor\s*=\s*vec4\(\s*skyColor\s*,\s*1\.0\s*\)\s*;/,
      'gl_FragColor = vec4(skyColor * uSkyExposure, 1.0);'
    );
  };
  sky.material.needsUpdate = true;

  // Sun position from elevation/azimuth (visual only)
  const sunVec = new THREE.Vector3();
  let elevation = 16.5;
  let azimuth = 360;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sunVec.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sunVec);

    // place visual sun sphere far along the same direction
    const dist = 3000;
    sunSphere.position.set(sunVec.x * dist, sunVec.y * dist, sunVec.z * dist);
  }

  // Visual sun (large emissive sphere, no scene lighting)
  const sunGeo = new THREE.SphereGeometry(10, 32, 16);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sunSphere = new THREE.Mesh(sunGeo, sunMat);
  sunSphere.renderOrder = -1; // behind most things
  scene.add(sunSphere);

  updateSun();

  // Renderer tone mapping stays standard; sky exposure is handled inside shader
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // --- Starfield ---
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

  // --- Earth (GLB) — visual-only, unlit, independent of sun ---
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const loader = new GLTFLoader(manager);
  loader.load('src/assets/models/earth/earth.glb', (gltf) => {
    const root = gltf.scene || gltf.scenes[0];
    root.traverse((obj) => {
      if (obj.isMesh) {
        // Convert to unlit so it doesn't need lights and won't affect terrain
        const old = obj.material;
        const basic = new THREE.MeshBasicMaterial({ color: 0xffffff });
        if (old && old.map) basic.map = old.map;
        if (old && old.emissiveMap) basic.map = basic.map || old.emissiveMap;
        basic.transparent = !!(old && old.transparent);
        basic.side = THREE.FrontSide;
        obj.material = basic;
      }
    });
    earthGroup.add(root);
    // default position & scale (these will be overwritten by setters if panel changes)
    root.scale.setScalar(12);
    root.position.set(180, 30, -260);
  });

  // --- API ---
  let sunSize = 7.0;
  const api = {
    update(dt) { starUniforms.uTime.value += dt; },

    // sky params
    setTurbidity(v) { U.turbidity.value = v; },
    setRayleigh(v) { U.rayleigh.value = v; },
    setMieCoefficient(v) { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg) { elevation = deg; updateSun(); },
    setAzimuth(deg) { azimuth = deg; updateSun(); },

    // sky exposure (dome only)
    setSkyExposure(v) { skyExposureUniform.value = v; sky.material.needsUpdate = true; },

    // sun size (visual)
    setSunSize(v) {
      sunSize = Math.max(0.01, v);
      sunSphere.scale.setScalar(sunSize / 10); // sphere base radius is 10
    },

    // stars
    setStarCount(n) { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px) { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // earth controls
    setEarthScale(s) {
      const sc = Math.max(0.01, s);
      earthGroup.traverse((o) => { if (o.isMesh) o.scale.set(sc, sc, sc); });
    },
    setEarthPosition(x, y, z) {
      earthGroup.position.set(x || 0, y || 0, z || 0);
    },
    setEarthBrightness(b) {
      const k = Math.max(0, b);
      earthGroup.traverse((o) => {
        if (o.isMesh && o.material && o.material.isMeshBasicMaterial) {
          // Multiply the base color; keep texture intact
          o.material.color.setScalar(k);
          o.material.needsUpdate = true;
        }
      });
    },

    // snapshot
    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth,
      skyExposure: skyExposureUniform.value,
      sunSize,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}