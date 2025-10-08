import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);
  const exrLoader = new EXRLoader(manager);

  // --- Texture sets ---
  const moondusted = {
    diffuse: loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg'),
    displacement: loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png'),
    normal: exrLoader.load('src/assets/textures/moon/moondusted/moondusted-normal.exr'),
    roughness: exrLoader.load('src/assets/textures/moon/moondusted/moondusted-roughness.exr'),
  };
  const moonflatmacro = {
    diffuse: loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg'),
    displacement: loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-displacement.png'),
    normal: exrLoader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-normal.exr'),
    roughness: exrLoader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-roughness.exr'),
  };
  const moonnormal = {
    diffuse: loader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg'),
    displacement: loader.load('src/assets/textures/moon/moonnormal/moonnormal-displacement.png'),
    normal: exrLoader.load('src/assets/textures/moon/moonnormal/moonnormal-normal.exr'),
    roughness: exrLoader.load('src/assets/textures/moon/moonnormal/moonnormal-roughness.exr'),
  };

  // Repeat/tiling
  [moondusted, moonflatmacro, moonnormal].forEach(set => {
    Object.values(set).forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(10, 10);
    });
  });

  // --- Perlin noise (JS) ---
  const perlin = {
    gradients: {},
    rand_vect() {
      const t = Math.random() * Math.PI * 2;
      return { x: Math.cos(t), y: Math.sin(t) };
    },
    dot_prod_grid(x, y, vx, vy) {
      const d = { x: x - vx, y: y - vy };
      const key = `${vx},${vy}`;
      let g = this.gradients[key];
      if (!g) { g = this.rand_vect(); this.gradients[key] = g; }
      return d.x * g.x + d.y * g.y;
    },
    smootherstep(x) { return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3; },
    interp(x, a, b) { return a + this.smootherstep(x) * (b - a); },
    get(x, y) {
      const xf = Math.floor(x), yf = Math.floor(y);
      const tl = this.dot_prod_grid(x, y, xf,     yf);
      const tr = this.dot_prod_grid(x, y, xf + 1, yf);
      const bl = this.dot_prod_grid(x, y, xf,     yf + 1);
      const br = this.dot_prod_grid(x, y, xf + 1, yf + 1);
      const xt = this.interp(x - xf, tl, tr);
      const xb = this.interp(x - xf, bl, br);
      return this.interp(y - yf, xt, xb);
    }
  };

  function getHeight(x, z) {
    let total = 0, freq = 0.05, amp = 5, max = 0;
    for (let i = 0; i < 4; i++) {
      total += ((perlin.get(x * freq, z * freq) + 1) * 0.5) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    total /= max;
    return Math.pow(total, 1.5) * 10;
  }

  // --- Geometry ---
  const size = 30;
  const segments = 128;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getHeight(x, z));
  }
  geometry.computeVertexNormals();

  // --- Material (PBR with blended maps) ---
  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    displacementScale: 0.1,
    displacementBias: 0,
    roughness: 1.0,
    metalness: 0.0,
  });

  // Optional quick debug override to prove geometry renders:
  // material.color = new THREE.Color(0x777777);

  const noiseGLSL = `
    vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.57735026919,0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.wwww) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
  `;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.diffuse1 = { value: moondusted.diffuse };
    shader.uniforms.diffuse2 = { value: moonflatmacro.diffuse };
    shader.uniforms.diffuse3 = { value: moonnormal.diffuse };
    shader.uniforms.displacement1 = { value: moondusted.displacement };
    shader.uniforms.displacement2 = { value: moonflatmacro.displacement };
    shader.uniforms.displacement3 = { value: moonnormal.displacement };
    shader.uniforms.normal1 = { value: moondusted.normal };
    shader.uniforms.normal2 = { value: moonflatmacro.normal };
    shader.uniforms.normal3 = { value: moonnormal.normal };
    shader.uniforms.roughness1 = { value: moondusted.roughness };
    shader.uniforms.roughness2 = { value: moonflatmacro.roughness };
    shader.uniforms.roughness3 = { value: moonnormal.roughness };

    shader.vertexShader = noiseGLSL + shader.vertexShader;
    shader.fragmentShader = noiseGLSL + shader.fragmentShader;

    // Displacement blend
    shader.vertexShader = shader.vertexShader.replace(
      '#include <displacementmap_vertex>',
      `
      #ifdef USE_DISPLACEMENTMAP
        float f1 = snoise(position.xz * 0.05) * 0.5 + 0.5;
        float f2 = (snoise(position.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5) * (1.0 - f1);
        float f3 = max(0.0, 1.0 - f1 - f2);
        float disp =
          texture2D(displacement1, vDisplacementMapUv).r * f1 +
          texture2D(displacement2, vDisplacementMapUv).r * f2 +
          texture2D(displacement3, vDisplacementMapUv).r * f3;
        transformed += normal * disp * displacementScale + displacementBias;
      #endif
      `
    );

    // Diffuse blend
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        float f1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
        float f2 = (snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5) * (1.0 - f1);
        float f3 = max(0.0, 1.0 - f1 - f2);
        vec4 texelColor =
          texture2D(diffuse1, vMapUv) * f1 +
          texture2D(diffuse2, vMapUv) * f2 +
          texture2D(diffuse3, vMapUv) * f3;
        texelColor = mapTexelToLinear(texelColor);
        diffuseColor *= texelColor;
      #endif
      `
    );

    // Normal blend
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normalmap_fragment>',
      `
      #ifdef USE_NORMALMAP
        float f1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
        float f2 = (snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5) * (1.0 - f1);
        float f3 = max(0.0, 1.0 - f1 - f2);
        vec3 normalTex =
          texture2D(normal1, vNormalMapUv).xyz * f1 +
          texture2D(normal2, vNormalMapUv).xyz * f2 +
          texture2D(normal3, vNormalMapUv).xyz * f3;
        normalTex = normalTex * 2.0 - 1.0;
        #ifdef USE_TANGENT
          normal = normalize( vTBN * normalTex );
        #else
          normal = perturbNormal2Arb( - vViewPosition, normal, normalTex, faceDirection );
        #endif
      #endif
      `
    );

    // Roughness blend
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        float f1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
        float f2 = (snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5) * (1.0 - f1);
        float f3 = max(0.0, 1.0 - f1 - f2);
        vec4 texelRoughness =
          texture2D(roughness1, vRoughnessMapUv) * f1 +
          texture2D(roughness2, vRoughnessMapUv) * f2 +
          texture2D(roughness3, vRoughnessMapUv) * f3;
        roughnessFactor *= saturate(texelRoughness.x);
      #endif
      `
    );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true; // so the sun lights/shadows are obvious on terrain
  return mesh;
}