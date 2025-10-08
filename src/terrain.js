// Terrain with desaturation + cool/white tint pass (stable with r160)
import * as THREE from 'three';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);

  const diffuse = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const displacement = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');

  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;

  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Dune shaping (same as before)
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

  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    displacementMap: displacement,
    displacementScale: 0.55,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: '#ffffff' // base multiplier; fine-tuned via uTint below
  });

  let repeat = 48;
  diffuse.repeat.set(repeat, repeat);
  displacement.repeat.set(repeat, repeat);

  // --- Color correction uniforms ---
  const uniforms = {
    uDesaturate: { value: 0.65 },                 // 0 = original, 1 = full grayscale
    uTint:       { value: new THREE.Color('#f5f7ff') } // subtle cool white
  };

  // Replace just the map sampling block to desaturate + tint the albedo
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
        #ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
          texelColor = mapTexelToLinear( texelColor );
          // Luma in linear space
          float lum = dot(texelColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          // Desaturate toward luminance
          texelColor.rgb = mix(texelColor.rgb, vec3(lum), uDesaturate);
          // Cool/white tint
          texelColor.rgb *= uTint;
          diffuseColor *= texelColor;
        #endif
      `
    );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  return {
    mesh,
    material,

    // existing knobs still work
    setDisplacementScale(v){ material.displacementScale = v; },
    setRoughness(v){ material.roughness = v; },
    setRepeat(v){
      const r = Math.max(1, v|0);
      repeat = r;
      diffuse.repeat.set(r, r);
      displacement.repeat.set(r, r);
      diffuse.needsUpdate = true;
      displacement.needsUpdate = true;
    },
    setTintColor(hex){
      uniforms.uTint.value.set(hex);  // lets your UI tint toward any white you like
      material.needsUpdate = true;
    },

    // placeholders (safe no-ops for now)
    setHeightRange(){},
    setSlopeBias(){},
    setWeights(){},

    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: repeat,
      terrainTint: `#${uniforms.uTint.value.getHexString()}`,
      terrainDesaturate: uniforms.uDesaturate.value
    })
  };
}