// SAFE baseline terrain + saturation via canvas + terrain-only exposure
import * as THREE from 'three';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);

  // NOTE: ensure these paths are correct in your repo
  const diffuse = loader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg', onDiffuseLoaded);
  const displacement = loader.load('src/assets/textures/moon/moonnormal/moonnormal-displacement.png');

  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;

  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Dune shaping
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

  // Keep a separate tint and exposure multiplier, then apply to material.color
  const tint = new THREE.Color('#f5f7ff');
  let exposureMul = 1.0; // terrain-only exposure multiplier (from UI)

  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    displacementMap: displacement,
    displacementScale: 0.55,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: tint.clone().multiplyScalar(exposureMul)
  });

  function applyTintAndExposure() {
    material.color.copy(tint).multiplyScalar(exposureMul);
  }

  let repeat = 48;
  diffuse.repeat.set(repeat, repeat);
  displacement.repeat.set(repeat, repeat);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // ---- Canvas-based saturation pipeline (no shaders) ----
  let canvas = null;
  let ctx = null;
  let origData = null;
  let workData = null;
  let satValue = 0.0; // default from your preset

  function onDiffuseLoaded(tex) {
    const img = tex.image;
    if (!img || !img.width || !img.height) return;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(img.width, img.height);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
    }
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    try {
      origData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      origData = null;
      return;
    }
    workData = ctx.createImageData(canvas.width, canvas.height);

    // Replace map with CanvasTexture so we can update saturation
    const canvasTex = new THREE.CanvasTexture(canvas);
    canvasTex.colorSpace = THREE.SRGBColorSpace;
    canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
    canvasTex.repeat.copy(diffuse.repeat);
    material.map = canvasTex;

    applySaturation(satValue);
  }

  function applySaturation(s) {
    const sat = Math.max(0, Math.min(2, s));
    satValue = sat;
    if (!origData || !ctx || !canvas) return;

    const src = origData.data;
    const dst = workData.data;
    const n = src.length;

    const lr = 0.2126, lg = 0.7152, lb = 0.0722;

    for (let i = 0; i < n; i += 4) {
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const a = src[i + 3];
      const lum = lr * r + lg * g + lb * b;
      dst[i]     = lum + (r - lum) * sat;
      dst[i + 1] = lum + (g - lum) * sat;
      dst[i + 2] = lum + (b - lum) * sat;
      dst[i + 3] = a;
    }

    ctx.putImageData(workData, 0, 0);
    if (material.map) material.map.needsUpdate = true;
  }

  // Public API
  return {
    mesh,
    material,

    setDisplacementScale(v){ material.displacementScale = v; },
    setRoughness(v){ material.roughness = v; },

    setRepeat(v){
      const r = Math.max(1, v|0);
      repeat = r;
      if (material.map) material.map.repeat.set(r, r);
      diffuse.repeat.set(r, r);
      displacement.repeat.set(r, r);
      diffuse.needsUpdate = true;
      displacement.needsUpdate = true;
    },

    setTintColor(hex){
      tint.set(hex);
      applyTintAndExposure();
    },

    // NEW: terrain-only exposure (does not affect the sky)
    setExposure(v){
      exposureMul = Math.max(0.01, v); // avoid zeroing it out
      applyTintAndExposure();
    },

    // Saturation (0 = grayscale, 1 = original)
    setSaturation(v){
      applySaturation(v);
    },

    // future blend placeholders
    setHeightRange(){},
    setSlopeBias(){},
    setWeights(){},

    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: repeat,
      terrainTint: `#${tint.getHexString()}`,
      terrainSaturation: satValue,
      terrainExposure: exposureMul
    })
  };
}