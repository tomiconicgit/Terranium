import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene, renderer) {
  // Sky dome (visual)
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const U = sky.material.uniforms;
  U.turbidity.value = 2.0;
  U.rayleigh.value = 0.3;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.8;

  // Real lighting for terrain
  const sunDir = new THREE.DirectionalLight(0xffffff, 1.5);
  sunDir.castShadow = true;
  sunDir.shadow.mapSize.set(1024, 1024);
  sunDir.shadow.camera.near = 1;
  sunDir.shadow.camera.far = 1500;
  sunDir.shadow.camera.left = -400;
  sunDir.shadow.camera.right = 400;
  sunDir.shadow.camera.top = 400;
  sunDir.shadow.camera.bottom = -400;
  scene.add(sunDir);

  const ambient = new THREE.AmbientLight(0x223344, 0.25);
  scene.add(ambient);

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

  // Sun position from elevation/azimuth
  const sun = new THREE.Vector3();
  let elevation = 6;
  let azimuth = 180;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);

    // Sky shader sun
    U.sunPosition.value.copy(sun);

    // Match the DirectionalLight to the same direction
    const dist = 1000;
    sunDir.position.set(sun.x * dist, sun.y * dist, sun.z * dist);
    sunDir.target.position.set(0, 0, 0);
    sunDir.target.updateMatrixWorld();
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

  // Base intensities for exposure scaling
  const baseSun = sunDir.intensity;
  const baseAmb = ambient.intensity;

  const api = {
    update(dt) { starUniforms.uTime.value += dt; },

    // Sky params
    setTurbidity(v) { U.turbidity.value = v; },
    setRayleigh(v) { U.rayleigh.value = v; },
    setMieCoefficient(v) { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg) { elevation = deg; updateSun(); },
    setAzimuth(deg) { azimuth = deg; updateSun(); },

    // Separate exposures
    setSkyExposure(v) { skyExposureUniform.value = v; sky.material.needsUpdate = true; },
    setLightingExposure(v) {
      sunDir.intensity = baseSun * v;
      ambient.intensity = baseAmb * Math.pow(v, 0.75);
    },

    // Optional global exposure (tone mapping)
    setExposureGlobal(v) { renderer.toneMappingExposure = v; },

    // Lighting tweaks
    setSunIntensity(v) { sunDir.intensity = v; },
    setAmbientIntensity(v) { ambient.intensity = v; },
    setEnvLightColor(hex) { sunDir.color.set(hex); ambient.color.set(hex); },

    // Stars
    setStarCount(n) { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px) { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth,
      skyExposure: skyExposureUniform.value,
      lightingExposure: +(sunDir.intensity / baseSun).toFixed(3),
      exposureGlobal: renderer.toneMappingExposure,
      sunIntensity: sunDir.intensity,
      ambientIntensity: ambient.intensity,
      envLightColor: `#${sunDir.color.getHexString()}`,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}