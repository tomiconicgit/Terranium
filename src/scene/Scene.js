// Scene.js — flat 70×70 concrete pad + clean sky & shadows (no noise)
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // --- Sky / ambient ---
    const skyColor = 0xcfe4ff;
    const groundColor = 0x9fb6d4;
    this.background = new THREE.Color(skyColor);
    this.fog = new THREE.Fog(skyColor, 220, 900);

    const hemi = new THREE.HemisphereLight(skyColor, groundColor, 0.9);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(80, 120, -70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.add(sun);
    this.add(sun.target);

    // --- Simple gradient skydome shader ---
    this.add(createSky(hemi));

    // --- Dynamic env map for subtle reflections on metals ---
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRT);
    this.dynamicEnvMap = cubeRT.texture;

    // --- 70×70 flat concrete slab at y=0 ---
    // Uses MeshStandardMaterial decorated via onBeforeCompile to draw
    // thin “expansion joint” lines every 4 units without textures.
    const PAD_SIZE = 70; // world units
    const PAD_SEGMENTS = 140; // gives smooth shadows & clean joint lines
    const geo = new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE, PAD_SEGMENTS, PAD_SEGMENTS);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa2ab,          // cool concrete base
      roughness: 0.85,          // concrete roughness
      metalness: 0.0
    });

    // Add subtle AO-ish darkening towards joint lines + faint speckle
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uJointEvery = { value: 4.0 };
      shader.uniforms.uJointWidth = { value: 0.03 };
      shader.uniforms.uJointDarken = { value: 0.25 };
      shader.uniforms.uSpeckle = { value: 0.035 };
      shader.uniforms.uSeed = { value: 1337.0 };

      shader.fragmentShader = `
        uniform float uJointEvery;
        uniform float uJointWidth;
        uniform float uJointDarken;
        uniform float uSpeckle;
        uniform float uSeed;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        // World position from vViewPosition needs reconstruction; cheaper hack:
        // use vUv remapped to world pad coords since the pad is axis-aligned.
        // The PlaneGeometry uv goes [0,1] across — remap to [-PAD/2, PAD/2].
        vec2 uvw = vUv * ${PAD_SIZE.toFixed(1)} - vec2(${(PAD_SIZE/2).toFixed(1)});
        float gx = abs(fract((uvw.x + 0.5*uJointEvery) / uJointEvery) - 0.5);
        float gz = abs(fract((uvw.y + 0.5*uJointEvery) / uJointEvery) - 0.5);
        float jointMask = smoothstep(uJointWidth, 0.0, min(gx, gz));

        // Tiny procedural speckle to break flatness (no textures)
        float s = fract(sin(dot(uvw, vec2(12.9898,78.233)) + uSeed) * 43758.5453);
        float speck = (s - 0.5) * 2.0 * uSpeckle;

        diffuseColor.rgb = diffuseColor.rgb * (1.0 - jointMask * uJointDarken) + speck;
        `
      );
    };

    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI / 2;
    pad.receiveShadow = true;
    pad.name = 'terrainPlane';
    this.terrain = pad;
    this.add(pad);

    // Camera target cache
    this._cameraTarget = new THREE.Vector3();
  }

  // Keep terrain editor API so tools won’t break (no-op on flat pad unless used)
  digPit(position, size) {
    const pos = this.terrain.geometry.attributes.position;
    const pitDepth = size.y;
    const pitRadius = size.x * 0.5;
    const softness = 2.5;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      // pad is a plane rotated to face up; authoring coords are in X,Z via rotation
      // Geometry is already in place-space (x across, y up, z down before rotation),
      // but since we rotated mesh by -PI/2, the position buffer is “pre-rotated”.
      // A simple concentric depression still reads visually fine for the pad.
      const dist = Math.hypot(px, pz);
      if (dist < pitRadius) {
        const d = (1.0 - smoothstep(pitRadius - softness, pitRadius, dist)) * pitDepth;
        pos.setY(i, py - d);
      }
    }
    pos.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
  }

  updateReflections(renderer, camera) {
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(renderer, this);
  }

  updateShadows(camera) {
    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.setLength(20).add(camera.position);
    this.sun.target.position.copy(this._cameraTarget);
    this.sun.shadow.camera.updateProjectionMatrix();
  }
}

function createSky(hemiLight) {
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const fragmentShader = `
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uOffset;
    uniform float uExponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + vec3(0.0, uOffset, 0.0)).y;
      vec3 col = mix(uBottomColor, uTopColor, pow(max(h, 0.0), uExponent));
      gl_FragColor = vec4(col, 1.0);
    }`;
  const uniforms = {
    uTopColor: { value: new THREE.Color(hemiLight.color) },
    uBottomColor: { value: new THREE.Color(hemiLight.groundColor) },
    uOffset: { value: 45.0 },
    uExponent: { value: 0.6 }
  };
  const skyGeo = new THREE.SphereGeometry(1000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, side: THREE.BackSide
  });
  return new THREE.Mesh(skyGeo, skyMat);
}