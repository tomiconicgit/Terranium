import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createSky(scene, renderer, manager) {
  // --- Sky dome (visual only; does not light terrain) ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  // Native sky uniforms
  const U = sky.material.uniforms;
  U.turbidity.value = 0.0;
  U.rayleigh.value = 0.03;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.03;

  // Add grading uniforms: top/bottom/coeff colors + contrast
  const uTopColor    = { value: new THREE.Color('#88aaff') };
  const uBottomColor = { value: new THREE.Color('#000011') };
  const uCoeffColor  = { value: new THREE.Color('#ffffff') };
  const uContrast    = { value: 1.0 };

  // Inject grading after physical sky color is computed
  sky.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTopColor    = uTopColor;
    shader.uniforms.uBottomColor = uBottomColor;
    shader.uniforms.uCoeffColor  = uCoeffColor;
    shader.uniforms.uContrast    = uContrast;

    // add uniforms
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 uTopColor;
       uniform vec3 uBottomColor;
       uniform vec3 uCoeffColor;
       uniform float uContrast;`
    );

    // apply grading & contrast in final color
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( skyColor, 1.0 );',
      `
      // gradient factor from world direction
      vec3 dir = normalize( vWorldPosition );
      float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 grad = mix(uBottomColor, uTopColor, t);
      skyColor *= (uCoeffColor * grad);

      // contrast around mid-gray (0.5)
      skyColor = (skyColor - 0.5) * uContrast + 0.5;

      gl_FragColor = vec4( skyColor, 1.0 );
      `
    );
  };
  sky.material.needsUpdate = true;

  // Sun direction (visual in shader only)
  const sunVec = new THREE.Vector3();
  let elevation = 16.5;
  let azimuth = 360;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sunVec.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sunVec); // shader uses this; no extra mesh added
  }
  updateSun();

  // Tone mapping stays standard (terrain lights control terrain brightness)
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

  // --- Earth (GLB) — visual-only, unlit, independent of sky sun ---
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const loader = new GLTFLoader(manager);
  loader.load('src/assets/models/earth/earth.glb', (gltf) => {
    const root = gltf.scene || gltf.scenes[0];
    // normalize root transform, we control via group
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);

    root.traverse((obj) => {
      if (obj.isMesh) {
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

    // sensible defaults (also settable via API)
    earthGroup.scale.setScalar(120);
    earthGroup.position.set(0, 80, -220);
  });

  // --- Public API ---
  const api = {
    update(dt) { starUniforms.uTime.value += dt; },

    // Physical sky params
    setTurbidity(v)       { U.turbidity.value = v; },
    setRayleigh(v)        { U.rayleigh.value = v; },
    setMieCoefficient(v)  { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg)     { elevation = deg; updateSun(); },
    setAzimuth(deg)       { azimuth = deg; updateSun(); },

    // Sky grading
    setSkyTopColor(hex)    { uTopColor.value.set(hex); sky.material.needsUpdate = true; },
    setSkyCoeffColor(hex)  { uCoeffColor.value.set(hex); sky.material.needsUpdate = true; },
    setSkyBottomColor(hex) { uBottomColor.value.set(hex); sky.material.needsUpdate = true; },
    setSkyContrast(v)      { uContrast.value = Math.max(0.0, v); },

    // Stars
    setStarCount(n)        { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px)        { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // Earth
    setEarthScale(s)       { const sc = Math.max(0.01, s); earthGroup.scale.set(sc, sc, sc); },
    setEarthPosition(x,y,z){ earthGroup.position.set(x||0, y||0, z||0); },
    setEarthBrightness(b)  {
      const k = Math.max(0, b);
      earthGroup.traverse((o) => {
        if (o.isMesh && o.material && o.material.isMeshBasicMaterial) {
          o.material.color.setScalar(k);
          o.material.needsUpdate = true;
        }
      });
    },

    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth
    })
  };

  return api;
}