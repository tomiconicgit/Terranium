import * as THREE from 'three';
// import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);

  // Your three diffuse sets
  const texA = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const texB = loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg');
  const texC = loader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg');

  [texA, texB, texC].forEach(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  });

  // Displacement keeps your relief
  const disp = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');
  disp.wrapS = disp.wrapT = THREE.RepeatWrapping;

  // Geometry (unchanged)
  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Mobile-friendly dunes
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

  // PBR base material (we'll extend in shader)
  const material = new THREE.MeshStandardMaterial({
    map: texA, // ensures USE_MAP/Uv path
    displacementMap: disp,
    displacementScale: 0.5,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: new THREE.Color(0xffffff) // tint control
  });

  // Default tiling
  let repeat = 48; // finer detail = sandier look
  [texA, texB, texC, disp].forEach(t => t.repeat.set(repeat, repeat));

  // Blend uniforms
  const uniforms = {
    mapB: { value: texB },
    mapC: { value: texC },
    uRepeat: { value: repeat },
    uTint: { value: new THREE.Color(0xffffff) },

    // Blend controls
    uHeightMin: { value: 0.0 },
    uHeightMax: { value: 12.0 },
    uSlopeBias: { value: 1.0 },
    uWLow:  { value: 1.0 },  // flats/sand
    uWHigh: { value: 0.7 },  // highlands
    uWSlope:{ value: 0.8 }   // rocky slopes
  };

  // SAFE world-normal injection (no transformedNormal dependency)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      `)
      // use the attribute "normal" and modelMatrix (3x3) — always available
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vWorldPos = (modelMatrix * vec4( transformed, 1.0 )).xyz;
        vec3 objectNormal = normal;                       // attribute
        vec3 worldNormal = normalize( mat3(modelMatrix) * objectNormal );
        vWorldNormal = worldNormal;
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D mapB;
        uniform sampler2D mapC;
        uniform float uRepeat;
        uniform vec3 uTint;
        uniform float uHeightMin;
        uniform float uHeightMax;
        uniform float uSlopeBias;
        uniform float uWLow;
        uniform float uWHigh;
        uniform float uWSlope;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      `)
      .replace('#include <map_fragment>', `
        // --- 3-way albedo blend (A/B/C) over PBR pipeline ---
        vec2 uvTiled = vMapUv * uRepeat;

        vec4 texA = texture2D( map,  uvTiled );
        vec4 texB = texture2D( mapB, uvTiled );
        vec4 texC = texture2D( mapC, uvTiled );

        texA = mapTexelToLinear( texA );
        texB = mapTexelToLinear( texB );
        texC = mapTexelToLinear( texC );

        // Height factor: 0 at min, 1 at max
        float h = clamp( (vWorldPos.y - uHeightMin) / max(0.0001, (uHeightMax - uHeightMin)), 0.0, 1.0 );

        // Slope factor: 0 flat up-facing, 1 vertical
        float slope = 1.0 - clamp( vWorldNormal.y, 0.0, 1.0 );
        slope = pow( max(0.0, slope), uSlopeBias );

        // Blend weights
        vec3 w = vec3(uWLow * (1.0 - h) * (1.0 - slope),
                      uWHigh * h,
                      uWSlope * slope);
        float sum = max(1e-4, w.x + w.y + w.z);
        w /= sum;

        vec4 texelColor = w.x * texA + w.y * texB + w.z * texC;
        texelColor.rgb *= uTint;

        diffuseColor *= texelColor;
      `);
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // Public API (unchanged)
  const api = {
    mesh,
    material,
    setDisplacementScale(v) { material.displacementScale = v; },
    setRoughness(v) { material.roughness = v; },
    setRepeat(v) {
      repeat = Math.max(1, v | 0);
      [texA, texB, texC, disp].forEach(t => t.repeat.set(repeat, repeat));
      uniforms.uRepeat.value = repeat;
      material.needsUpdate = true; // ensure rebind if renderer caches
    },
    setTintColor(hex) { uniforms.uTint.value.set(hex); },

    setHeightRange(min, max) {
      uniforms.uHeightMin.value = min;
      uniforms.uHeightMax.value = Math.max(min + 0.001, max);
    },
    setSlopeBias(v) { uniforms.uSlopeBias.value = Math.max(0.2, v); },
    setWeights(low, high, slope) {
      uniforms.uWLow.value   = Math.max(0, low);
      uniforms.uWHigh.value  = Math.max(0, high);
      uniforms.uWSlope.value = Math.max(0, slope);
    },

    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: repeat,
      terrainTint: `#${uniforms.uTint.value.getHexString()}`,
      blendHeightMin: uniforms.uHeightMin.value,
      blendHeightMax: uniforms.uHeightMax.value,
      blendSlopeBias: uniforms.uSlopeBias.value,
      blendWeights: {
        low: uniforms.uWLow.value,
        high: uniforms.uWHigh.value,
        slope: uniforms.uWSlope.value
      }
    })
  };

  return api;
}