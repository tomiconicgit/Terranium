import * as THREE from 'three';
// import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'; // kept available if needed later

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);

  // Three diffuse sets (you already have these)
  const texA = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const texB = loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg');
  const texC = loader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg');

  [texA, texB, texC].forEach(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  });

  // We still use the existing displacement map to keep the relief
  const disp = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');
  disp.wrapS = disp.wrapT = THREE.RepeatWrapping;

  // Geometry (unchanged)
  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Mobile-friendly dune shaping (as you had)
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

  // PBR material we will extend with custom blending logic
  const material = new THREE.MeshStandardMaterial({
    map: texA, // base
    displacementMap: disp,
    displacementScale: 0.5,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: new THREE.Color(0xffffff) // tint control (sandiness tone)
  });

  // Default tiling
  let repeat = 48; // finer = more sandy detail
  [texA, texB, texC, disp].forEach(t => t.repeat.set(repeat, repeat));

  // --- Shader injection: blend texA/texB/texC by height & slope (keeps Standard lighting) ---
  const uniforms = {
    mapB: { value: texB },
    mapC: { value: texC },
    uRepeat: { value: repeat },
    uTint: { value: new THREE.Color(0xffffff) },

    // Blend controls
    uHeightMin: { value: 0.0 },   // world-space y where "higher" starts
    uHeightMax: { value: 12.0 },  // world-space y where "higher" fully applied
    uSlopeBias: { value: 1.0 },   // more = more weight to steep faces (rocks)
    uWLow:  { value: 1.0 },       // base sand weight
    uWHigh: { value: 0.7 },       // highlands weight
    uWSlope:{ value: 0.8 }        // rocky slopes weight
  };

  material.onBeforeCompile = (shader) => {
    // inject uniforms
    Object.assign(shader.uniforms, uniforms);

    // Add varyings in vertex shader to pass world-space position/normal
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vWorldPos = (modelMatrix * vec4( transformed, 1.0 )).xyz;
        // transformedNormal exists (object space) -> world space normal
        vec3 wn = normalize( mat3(modelMatrix) * transformedNormal );
        vWorldNormal = wn;
      `);

    // Add uniforms + logic to fragment shader
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
        // --- Custom 3-way blend for albedo map (keeps PBR pipeline) ---
        vec2 uvTiled = vMapUv * uRepeat;

        vec4 texA = texture2D( map, uvTiled );
        vec4 texB = texture2D( mapB, uvTiled );
        vec4 texC = texture2D( mapC, uvTiled );

        texA = mapTexelToLinear( texA );
        texB = mapTexelToLinear( texB );
        texC = mapTexelToLinear( texC );

        // Height factor: 0 at uHeightMin, 1 at uHeightMax
        float h = clamp( (vWorldPos.y - uHeightMin) / max(0.0001, (uHeightMax - uHeightMin)), 0.0, 1.0 );

        // Slope factor: 0 for flat up-facing, 1 for vertical walls
        float slope = 1.0 - clamp( vWorldNormal.y, 0.0, 1.0 );
        slope = pow( slope, uSlopeBias ); // accentuate if needed

        // Weights for A (low flats sand), B (highlands), C (slopes/rocks)
        vec3 w = vec3(uWLow * (1.0 - h) * (1.0 - slope),
                      uWHigh * h,
                      uWSlope * slope);
        float sum = max(1e-4, (w.x + w.y + w.z));
        w /= sum;

        vec4 texelColor = w.x * texA + w.y * texB + w.z * texC;

        // Apply tint (sandiness tone)
        texelColor.rgb *= uTint;

        diffuseColor *= texelColor;
      `);
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // Public API for UI
  const api = {
    mesh,
    material,
    setDisplacementScale(v) { material.displacementScale = v; },
    setRoughness(v) { material.roughness = v; },
    setRepeat(v) {
      repeat = Math.max(1, v | 0);
      [texA, texB, texC, disp].forEach(t => t.repeat.set(repeat, repeat));
      uniforms.uRepeat.value = repeat;
    },
    setTintColor(hex) { uniforms.uTint.value.set(hex); },

    // Blend controls
    setHeightRange(min, max) { uniforms.uHeightMin.value = min; uniforms.uHeightMax.value = Math.max(min + 0.001, max); },
    setSlopeBias(v) { uniforms.uSlopeBias.value = Math.max(0.2, v); },
    setWeights(low, high, slope) {
      uniforms.uWLow.value   = Math.max(0, low);
      uniforms.uWHigh.value  = Math.max(0, high);
      uniforms.uWSlope.value = Math.max(0, slope);
    },

    // snapshot for copy
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