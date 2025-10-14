// src/scene/Scene.js — flat 70×70 concrete pad, sky, sun, reflections, pit digging
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Expose tile size to the builder/snapping logic
    this.userData.tile = 4;                 // 1 tile = 4 world units
    const TILES = 70;
    const PAD = this.userData.tile * TILES; // 280×280 world units

    // --- Atmosphere / lighting ---
    const skyColor = 0xcce0ff;
    const groundColor = 0x95abcc;
    this.background = new THREE.Color(skyColor);
    this.fog = new THREE.Fog(skyColor, 200, 1000);

    const hemi = new THREE.HemisphereLight(skyColor, groundColor, 1.05);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(120, 160, -110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 600;
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.add(sun);
    this.add(sun.target);

    // Simple gradient sky dome (cheap & clean)
    this.add(createSky(hemi));

    // --- Dynamic reflection cubemap for metals ---
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCamera = new THREE.CubeCamera(1, 2000, cubeRT);
    this.dynamicEnvMap = cubeRT.texture;

    // --- Flat concrete pad (NO grooves/lines) ---
    // Dense enough grid so pits can be carved smoothly
    const SEG = TILES * 2; // 140×140
    const geo = new THREE.PlaneGeometry(PAD, PAD, SEG, SEG);
    // Keep perfectly flat initially
    for (let i = 0; i < geo.attributes.position.count; i++) {
      geo.attributes.position.setZ(i, 0);
    }
    geo.computeVertexNormals();

    const concrete = new THREE.MeshStandardMaterial({
      color: 0x9aa2ab,   // neutral concrete gray (no black markings)
      roughness: 0.92,
      metalness: 0.02
    });

    const terrain = new THREE.Mesh(geo, concrete);
    terrain.rotation.x = -Math.PI / 2;
    terrain.name = 'terrainPlane';
    terrain.receiveShadow = true;
    this.terrain = terrain;
    this.add(terrain);

    this._cameraTarget = new THREE.Vector3();
  }

  // Dig circular pit at a world-space center; depth in world units.
  // NOTE: plane is rotated -PI/2, so "down in world Y" == "negative local Z".
  digPit(centerWS, depth = 32, radius = this.userData.tile * 1.8) {
    const g = this.terrain.geometry;
    const pos = g.attributes.position;

    // Convert world position to the terrain's local space
    const center = this.terrain.worldToLocal(centerWS.clone());

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dx = vx - center.x;
      const dz = vz - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        // Smooth falloff towards the center (quadratic)
        const t = 1.0 - Math.min(1.0, dist / radius);
        const curZ = pos.getZ(i);
        pos.setZ(i, curZ - depth * (t * t));
      }
    }

    pos.needsUpdate = true;
    g.computeVertexNormals();
    g.normalsNeedUpdate = true;
  }

  updateReflections(renderer, camera) {
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(renderer, this);
  }
  
  updateShadows(camera) {
    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.multiplyScalar(20).add(camera.position);
    this.sun.target.position.copy(this._cameraTarget);
    this.sun.shadow.camera.updateProjectionMatrix();
  }
}

function createSky(hemiLight) {
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`;
  const fragmentShader = `
    uniform vec3 uTopColor; uniform vec3 uBottomColor; uniform float uOffset; uniform float uExponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + vec3(0.0, uOffset, 0.0)).y;
      vec3 c = mix(uBottomColor, uTopColor, max(pow(max(h, 0.0), uExponent), 0.0));
      gl_FragColor = vec4(c, 1.0);
    }`;
  const uniforms = {
    uTopColor: { value: new THREE.Color(hemiLight.color) },
    uBottomColor: { value: new THREE.Color(hemiLight.groundColor) },
    uOffset: { value: 33 },
    uExponent: { value: 0.6 }
  };
  const skyGeo = new THREE.SphereGeometry(2000, 32, 15);
  const skyMat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide });
  return new THREE.Mesh(skyGeo, skyMat);
}