import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene, renderer) {
  // --- Sky dome (visual only) ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  // VERY IMPORTANT: don’t let renderer’s tone mapping change the sky
  sky.material.toneMapped = false;
  scene.add(sky);

  // official uniforms
  const U = sky.material.uniforms;
  U.turbidity.value = 2.0;
  U.rayleigh.value = 1.2;
  U.mieCoefficient.value = 0.005;
  U.mieDirectionalG.value = 0.8;

  // Extra uniform for sky-only exposure
  const skyExposureUniform = { value: 1.0 };
  sky.material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkyExposure = skyExposureUniform;
    // multiply final skyColor by uSkyExposure
    shader.fragmentShader = shader.fragmentShader.replace(
      /gl_FragColor\s*=\s*vec4\(\s*skyColor\s*,\s*1\.0\s*\)\s*;/,
      'gl_FragColor = vec4(skyColor * uSkyExposure, 1.0);'
    );
  };
  sky.material.needsUpdate = true;

  // Sun direction (for sky only)
  const sun = new THREE.Vector3();
  let elevation = 6;
  let azimuth = 180;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sun);

    // move the visual sun sprite to match (far away in that direction)
    const dist = 2000;
    sunSprite.position.set(sun.x * dist, sun.y * dist, sun.z * dist);
  }

  // --- Stars (twinkling) ---
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

  const starUniforms = {
    uTime: { value: 0 },
    uSize: { value: 1.6 },
    uSpeed: { value: 0.9 }
  };
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

  // --- Visual sun disc (sprite) that does NOT light the terrain ---
  const sunTexture = makeRadialDiscTexture();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTexture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    color: 0xffffff
  }));
  sunSprite.scale.setScalar(35); // default disc size
  scene.add(sunSprite);

  function makeRadialDiscTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    return tex;
  }

  // initial position
  updateSun();

  // --- Public API for UI ---
  const api = {
    update(dt) { starUniforms.uTime.value += dt; },

    // Sky params
    setTurbidity(v) { U.turbidity.value = v; },
    setRayleigh(v) { U.rayleigh.value = v; },
    setMieCoefficient(v) { U.mieCoefficient.value = v; },
    setMieDirectionalG(v) { U.mieDirectionalG.value = v; },
    setElevation(deg) { elevation = deg; updateSun(); },
    setAzimuth(deg) { azimuth = deg; updateSun(); },

    // Sky-only exposure (material is toneMapped=false)
    setSkyExposure(v) { skyExposureUniform.value = v; sky.material.needsUpdate = true; },

    // Stars
    setStarCount(n) { starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n)))); },
    setStarSize(px) { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // Apparent sun disc size (visual only)
    setSunSize(s) { sunSprite.scale.set(s, s, s); },

    _getCurrent: () => ({
      turbidity: U.turbidity.value,
      rayleigh: U.rayleigh.value,
      mieCoefficient: U.mieCoefficient.value,
      mieDirectionalG: U.mieDirectionalG.value,
      elevation, azimuth,
      skyExposure: skyExposureUniform.value,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}