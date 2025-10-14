// Scene.js — flat 70×70 concrete pad (no joint lines) + clean sky & shadows
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // --- Sky / ambient ---
    const skyColor = 0xcfe4ff;
    const groundColor = 0xa0b6d4;
    this.background = new THREE.Color(skyColor);
    this.fog = new THREE.Fog(skyColor, 220, 900);

    const hemi = new THREE.HemisphereLight(skyColor, groundColor, 0.9);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
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

    this.add(createSky(hemi));

    // --- Dynamic env map for subtle reflections on metals ---
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRT);
    this.dynamicEnvMap = cubeRT.texture;

    // --- 70×70 flat concrete pad at y=0 (no dark seam lines) ---
    const PAD_SIZE = 70;
    const PAD_SEGMENTS = 4; // coarse; we don’t need dense tessellation now
    const geo = new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE, PAD_SEGMENTS, PAD_SEGMENTS);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa2ab,    // concrete
      roughness: 0.88,
      metalness: 0.0
    });

    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI / 2;
    pad.receiveShadow = true;
    pad.name = 'terrainPlane';
    this.terrain = pad;
    this.add(pad);

    // Camera target cache
    this._cameraTarget = new THREE.Vector3();
  }

  // Keep terrain editor API (used by “hole” floors)
  digPit(position, size, depth = 2.0, radiusScale = 0.5) {
    const pos = this.terrain.geometry.attributes.position;
    if (!pos) return; // flat plane with low segments -> we’ll simply lower the mesh locally
    const pitRadius = Math.max(size.x, size.z) * radiusScale;

    // Coarse lowering by translating the pad mesh under the placed tile center:
    // since the pad has low segments, we mimic a pit by dropping nearby vertices.
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i);
      const dx = px - position.x, dz = pz - position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < pitRadius) {
        const y = pos.getY(i);
        const t = 1.0 - Math.min(1.0, dist / pitRadius);
        pos.setY(i, y - depth * t);
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