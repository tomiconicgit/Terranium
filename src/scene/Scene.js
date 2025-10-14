// Scene.js — flat 70×70 concrete pad, snap grid, hole digging API
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

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

    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRT);
    this.dynamicEnvMap = cubeRT.texture;

    // --- 70×70 flat concrete pad at y=0
    const PAD_SIZE = 70;
    const PAD_SEGMENTS = 64; // enough vertices so holes look decent
    const geo = new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE, PAD_SEGMENTS, PAD_SEGMENTS);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa2ab, roughness: 0.88, metalness: 0.0
    });

    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI / 2;
    pad.receiveShadow = true;
    pad.name = 'terrainPlane';
    this.terrain = pad;
    this.add(pad);

    // Grid size (tile) — used by Builder for snapping/highlight
    this.userData.tile = 4;

    this._cameraTarget = new THREE.Vector3();
  }

  // Dig a cylindrical-ish pit by lowering vertices inside radius with soft edge.
  // depth in world units, radius in world units.
  digPit(center, depth = 32, radius = 2.0) {
    const g = this.terrain.geometry;
    const pos = g.attributes.position;
    if (!pos) return;

    for (let i = 0; i < pos.count; i++) {
      // Plane vertices are in local X (across) and Z (forward) because we rotate the mesh.
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dx = vx - center.x;
      const dz = vz - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        const t = 1.0 - Math.min(1.0, dist / radius);
        const y = pos.getY(i);
        pos.setY(i, y - depth * (t * t)); // smooth falloff
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
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