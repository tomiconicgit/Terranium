// Simple skybox + stars + horizon haze + environment (IBL) only.
// No sun/three.js Sky shader. Terrain is lit solely by scene.environment.

import * as THREE from 'three';

export function createSky(scene, renderer) {
  // ---------- STARFIELD ----------
  const maxStars = 15000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(maxStars * 3);
  const starPhase = new Float32Array(maxStars);

  for (let i = 0; i < maxStars; i++) {
    const r = 2200 + Math.random() * 1800;
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
    uTime:  { value: 0 },
    uSize:  { value: 1.6 },
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

  // ---------- SKY SPHERE (simple vertical gradient) ----------
  // Giant inside-out sphere; fragment uses world Y to blend two colors.
  const skySphere = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:    { value: new THREE.Color(0x000000) },
        bottomColor: { value: new THREE.Color(0x000000) },
        contrast:    { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float contrast;
        varying vec3 vWorldPos;
        void main(){
          float t = clamp( (vWorldPos.y + 500.0) / 2000.0, 0.0, 1.0 );
          // Optional contrast shaping
          t = pow(t, max(0.001, contrast));
          vec3 col = mix(bottomColor, topColor, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
  );
  scene.add(skySphere);

  // ---------- HORIZON HAZE (rayleigh-ish border around terrain) ----------
  // A thin cylindrical shell around the terrain edge, fading upward.
  // Default terrain SIZE is 400 in your repo => radius ~ 220 looks nice.
  const hazeUniforms = {
    hazeColor: { value: new THREE.Color(0x223366) },
    height:    { value: 40.0 },
    radius:    { value: 220.0 },
    alpha:     { value: 0.75 }
  };
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: hazeUniforms,
    vertexShader: `
      varying vec3 vPos;
      void main(){
        vPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 hazeColor;
      uniform float height;
      uniform float alpha;
      varying vec3 vPos;
      void main(){
        // Fade strongest at ground (y≈0), to 0 at 'height'
        float t = clamp(1.0 - (vPos.y / max(0.001, height)), 0.0, 1.0);
        // Soft edge near top
        t = smoothstep(0.0, 1.0, t);
        gl_FragColor = vec4(hazeColor, t * alpha);
      }
    `
  });

  // Build a cylindrical shell that we can resize via API
  let hazeMesh = buildHazeMesh(hazeUniforms.radius.value, hazeUniforms.height.value);
  scene.add(hazeMesh);

  function buildHazeMesh(radius, height) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
    const mesh = new THREE.Mesh(geo, hazeMat);
    mesh.position.y = height * 0.5; // start at ground, rise up
    return mesh;
  }
  function updateHazeGeometry() {
    if (hazeMesh) {
      scene.remove(hazeMesh);
      hazeMesh.geometry.dispose();
    }
    hazeMesh = buildHazeMesh(hazeUniforms.radius.value, hazeUniforms.height.value);
    scene.add(hazeMesh);
  }

  // ---------- ENVIRONMENT LIGHT (IBL via PMREM) ----------
  // We generate a simple vertical gradient equirectangular texture,
  // convert with PMREM, and assign to scene.environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  let envTop = new THREE.Color(0x222222);
  let envBottom = new THREE.Color(0x000000);
  let envPower = 1.0;      // intensity multiplier
  let envShape = 1.0;      // gradient power (coverage/steepness)

  let currentEnvRT = null;

  function makeEnvTexture() {
    // 512x256 equirectangular gradient
    const w = 512, h = 256;
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      // v: 0 bottom .. 1 top
      let v = y / (h - 1);
      // shape controls how much "area" (height) the top color covers
      v = Math.pow(v, Math.max(0.001, envShape));

      const r = THREE.MathUtils.lerp(envBottom.r, envTop.r, v) * 255;
      const g = THREE.MathUtils.lerp(envBottom.g, envTop.g, v) * 255;
      const b = THREE.MathUtils.lerp(envBottom.b, envTop.b, v) * 255;

      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i + 0] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(cvs);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    if (currentEnvRT) {
      currentEnvRT.texture.dispose();
      currentEnvRT.dispose();
      currentEnvRT = null;
    }
    currentEnvRT = pmrem.fromEquirectangular(tex);
    tex.dispose();

    scene.environment = currentEnvRT.texture;
  }
  makeEnvTexture();

  // renderer tone mapping: keep neutral; brightness via envPower & materials
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ---------- PUBLIC API ----------
  const api = {
    update(dt) {
      starUniforms.uTime.value += dt;
    },

    // Stars
    setStarCount(n) {
      starGeo.setDrawRange(0, Math.max(0, Math.min(maxStars, Math.floor(n))));
    },
    setStarSize(px)  { starUniforms.uSize.value = px; },
    setStarTwinkleSpeed(s) { starUniforms.uSpeed.value = s; },

    // Simple sky sphere colors & contrast
    setSkyTopColor(hex)    { skySphere.material.uniforms.topColor.value.set(hex); },
    setSkyBottomColor(hex) { skySphere.material.uniforms.bottomColor.value.set(hex); },
    setSkyContrast(v)      { skySphere.material.uniforms.contrast.value = Math.max(0.01, v); },

    // Horizon haze (rayleigh-like border)
    setHazeColor(hex) { hazeUniforms.hazeColor.value.set(hex); },
    setHazeHeight(h)  { hazeUniforms.height.value = Math.max(1, h); updateHazeGeometry(); },
    setHazeRadius(r)  { hazeUniforms.radius.value = Math.max(10, r); updateHazeGeometry(); },
    setHazeAlpha(a)   { hazeUniforms.alpha.value = Math.max(0, a); },

    // Environment lighting (IBL)
    setEnvTopColor(hex)    { envTop.set(hex); makeEnvTexture(); },
    setEnvBottomColor(hex) { envBottom.set(hex); makeEnvTexture(); },
    setEnvShape(v)         { envShape = Math.max(0.05, v); makeEnvTexture(); }, // "coverage/steepness"
    setEnvIntensity(v)     { envPower = Math.max(0, v); /* use with material.envMapIntensity */ },

    // Utility for terrain: read current env intensity for scaling
    getEnvIntensity() { return envPower; },

    // Snapshot (for Copy)
    _getCurrent: () => ({
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value,
      skyTopColor: `#${skySphere.material.uniforms.topColor.value.getHexString()}`,
      skyBottomColor: `#${skySphere.material.uniforms.bottomColor.value.getHexString()}`,
      skyContrast: skySphere.material.uniforms.contrast.value,
      hazeColor: `#${hazeUniforms.hazeColor.value.getHexString()}`,
      hazeHeight: hazeUniforms.height.value,
      hazeRadius: hazeUniforms.radius.value,
      hazeAlpha: hazeUniforms.alpha.value,
      envTopColor: `#${envTop.getHexString()}`,
      envBottomColor: `#${envBottom.getHexString()}`,
      envShape,
      envIntensity: envPower
    })
  };

  return api;
}