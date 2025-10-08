import * as THREE from 'three';

export function createTerrain(manager, opts = {}) {
  const loader = new THREE.TextureLoader(manager);

  // Textures you already have
  const texA = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');          // base (sandier)
  const texB = loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg');    // highlands candidate
  const disp = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');

  [texA, texB].forEach(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  });
  disp.wrapS = disp.wrapT = THREE.RepeatWrapping;

  // Geometry
  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Mobile-friendly dunes (your CPU noise)
  function noise2(x, z) {
    return (
      Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5 +
      Math.sin(x * 0.013 + z * 0.021) * 0.35 +
      Math.cos(x * 0.002 - z * 0.003) * 0.15
    );
  }
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = Math.max(0, noise2(x, z)) * 6.0 + Math.max(0, noise2(x * 0.5, z * 0.5)) * 3.0;
    pos.setY(i, h);
  }
  geometry.computeVertexNormals();

  // --- SAFE MODE material (default): single texture, no shader patch ---
  const material = new THREE.MeshStandardMaterial({
    map: texA,
    displacementMap: disp,
    displacementScale: 0.5,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: new THREE.Color(0xffffff) // tint knob
  });

  let repeat = 48; // finer detail = sandier look
  [texA, texB, disp].forEach(t => t.repeat.set(repeat, repeat));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // ----------------------------
  // Optional: super-simple 2-texture blend (by height only)
  // Toggle with api.setBlendMode('blend2') / api.setBlendMode('simple')
  // ----------------------------
  const blendUniforms = {
    mapB: { value: texB },
    uRepeat: { value: repeat },
    uTint: { value: new THREE.Color(0xffffff) },
    uHeightMin: { value: 0.0 },
    uHeightMax: { value: 12.0 },
    uMixPower:  { value: 1.0 } // 1=linear, >1 sharper transition
  };

  let blendMode = 'simple'; // default SAFE

  function applyBlendShader() {
    if (blendMode !== 'blend2') return;

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, blendUniforms);

      // We only need world position (for y). Avoid normals/slope/vMapUv.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `
          #include <common>
          varying vec3 vWorldPos;
        `)
        .replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vWorldPos = (modelMatrix * vec4( transformed, 1.0 )).xyz;
        `);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          uniform sampler2D mapB;
          uniform float uRepeat;
          uniform vec3  uTint;
          uniform float uHeightMin;
          uniform float uHeightMax;
          uniform float uMixPower;
          varying vec3 vWorldPos;
        `)
        .replace('#include <map_fragment>', `
          // --- Height-only blend: A at low y -> B at high y ---
          vec2 uvTiled = vUv * uRepeat;

          vec4 A = texture2D( map,  uvTiled );
          vec4 B = texture2D( mapB, uvTiled );

          A = mapTexelToLinear( A );
          B = mapTexelToLinear( B );

          float h = clamp( (vWorldPos.y - uHeightMin) / max(0.0001, (uHeightMax - uHeightMin)), 0.0, 1.0 );
          h = pow(h, uMixPower);

          vec4 texelColor = mix( A, B, h );
          texelColor.rgb *= uTint;

          diffuseColor *= texelColor;
        `);
    };

    // Force recompilation
    material.needsUpdate = true;
  }

  function removeBlendShader() {
    // Remove any previous onBeforeCompile hook
    material.onBeforeCompile = undefined;
    material.needsUpdate = true;
  }

  // --- Public API (keeps your existing UI surface area) ---
  const api = {
    mesh,
    material,

    // SAFE knobs
    setDisplacementScale(v) { material.displacementScale = v; },
    setRoughness(v) { material.roughness = v; },
    setRepeat(v) {
      repeat = Math.max(1, v | 0);
      [texA, texB, disp].forEach(t => t.repeat.set(repeat, repeat));
      blendUniforms.uRepeat.value = repeat;
      material.needsUpdate = true;
    },
    setTintColor(hex) { blendUniforms.uTint.value.set(hex); material.color.set(hex); },

    // Height-only blend controls (active only in 'blend2' mode)
    setHeightRange(min, max) { blendUniforms.uHeightMin.value = min; blendUniforms.uHeightMax.value = Math.max(min + 0.001, max); if (blendMode==='blend2') material.needsUpdate = true; },
    setSlopeBias(_) { /* no-op in height-only mode; left for UI compatibility */ },
    setWeights(low, high, slope) { /* no-op in height-only mode */ },

    setBlendMode(mode) {
      blendMode = (mode === 'blend2') ? 'blend2' : 'simple';
      if (blendMode === 'blend2') applyBlendShader(); else removeBlendShader();
    },

    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: repeat,
      terrainTint: `#${material.color.getHexString()}`,
      blendMode,
      blendHeightMin: blendUniforms.uHeightMin.value,
      blendHeightMax: blendUniforms.uHeightMax.value,
      blendMixPower: blendUniforms.uMixPower.value
    })
  };

  // Start in SAFE mode (no shader patch)
  api.setBlendMode(opts.blendMode || 'simple');

  return api;
}