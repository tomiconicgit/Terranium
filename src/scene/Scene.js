// Scene.js — procedural sky with real-time reflections and shadow bias
import * as THREE from 'three';

// --- Noise functions for terrain generation ---
const lerp = (a, b, t) => a + (b - a) * t;
const fade = (t) => t*t*t*(t*(t*6-15)+10);
function hash(x, y) { let n=x*374761393+y*668265263; n=(n^(n>>13))*1274126177; return ((n^(n>>16))>>>0)/4294967295; }
function valueNoise(x, y) {
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const s=hash(xi,yi), t=hash(xi+1,yi), u=hash(xi,yi+1), v=hash(xi+1,yi+1);
  const sx=fade(xf), sy=fade(yf); return lerp(lerp(s,t,sx), lerp(u,v,sx), sy) * 2.0 - 1.0;
}
function fbm(x, y, octaves) {
  let sum=0, amp=0.5, freq=1;
  for (let i=0; i<octaves; i++) { sum += amp * valueNoise(x*freq, y*freq); amp*=0.5; freq*=2; } return sum;
}
function smoothstep(a, b, x) { const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); }

export class Scene extends THREE.Scene {
  constructor() {
    super();

    const skyColor = 0xcce0ff;
    const groundColor = 0x95abcc;
    this.background = new THREE.Color(skyColor);
    this.fog = new THREE.Fog(skyColor, 200, 600);

    /* ---------- Lights ---------- */
    const hemiLight = new THREE.HemisphereLight(skyColor, groundColor, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(80, 100, -70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 400;
    // ✨ FIX: Added shadow bias to prevent shadow acne
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.add(sun);
    this.add(sun.target);

    this.add(createSky(hemiLight));

    // ✨ NEW: Create a CubeCamera for real-time reflections
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    this.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
    this.cubeCamera.position.set(0, 5, 0); // Position it in the center of the action
    this.dynamicEnvMap = cubeRenderTarget.texture;


    /* ... rest of the file is unchanged ... */
    const size = 100;
    const segments = 128;
    const flatRadius = 35;
    const baseHeight = 0.0;
    const geo = new THREE.PlaneGeometry(size * 2, size * 2, segments, segments);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.hypot(x, y);

        let height = baseHeight;
        if (r > flatRadius) {
            const mountainFactor = smoothstep(flatRadius, size * 0.6, r);
            const baseMountain = (fbm(x * 0.03, y * 0.03, 5) + 0.5) * 20.0;
            const detailMountain = fbm(x * 0.1, y * 0.1, 4) * 5.0;
            height += (baseMountain + detailMountain) * mountainFactor;
        }
        pos.setZ(i, height);
    }
    geo.computeVertexNormals();
    
    const mat = new THREE.MeshStandardMaterial({
        color: 0xf5f9fc,
        roughness: 0.65,
        metalness: 0.0,
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.name = 'terrainPlane';
    terrain.receiveShadow = true;
    this.terrain = terrain;
    this.add(terrain);

    this._cameraTarget = new THREE.Vector3();
  }

  // ✨ NEW: Method to update the reflection probe each frame
  updateReflections(renderer) {
    this.cubeCamera.update(renderer, this);
  }
  
  updateShadows(camera) {
    const shadowCam = this.sun.shadow.camera;
    const distance = 80;

    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.multiplyScalar(distance / 4);
    this._cameraTarget.add(camera.position);
    
    this.sun.target.position.copy(this._cameraTarget);
    
    const frustumSize = 50;
    shadowCam.left = -frustumSize;
    shadowCam.right = frustumSize;
    shadowCam.top = frustumSize;
    shadowCam.bottom = -frustumSize;
    
    shadowCam.updateProjectionMatrix();
  }

  getTerrainHeightAt(wx, wz) {
    if (Math.hypot(wx, wz) <= 35) return 0.0;
    return 0.0;
  }

  pressSand() { /* Disabled */ }
}

function createSky(hemiLight) {
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`;

  const fragmentShader = `
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uOffset;
    uniform float uExponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize( vWorldPosition + uOffset ).y;
      gl_FragColor = vec4( mix( uBottomColor, uTopColor, max( pow( max( h , 0.0), uExponent ), 0.0 ) ), 1.0 );
    }`;

  const uniforms = {
    'uTopColor': { value: new THREE.Color(hemiLight.color) },
    'uBottomColor': { value: new THREE.Color(hemiLight.groundColor) },
    'uOffset': { value: 33 },
    'uExponent': { value: 0.6 }
  };

  const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
  });

  return new THREE.Mesh(skyGeo, skyMat);
}
