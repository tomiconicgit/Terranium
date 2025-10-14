// Scene.js — procedural snow terrain with mountains and custom sky
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

    // ✨ FIX: Load a cube texture for the skybox to provide detailed reflections.
    const textureCube = new THREE.CubeTextureLoader()
      .setPath('https://unpkg.com/three@0.169.0/examples/textures/cube/pisa/')
      .load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);
    
    this.background = textureCube;


    /* ---------- Lights ---------- */
    // ✨ FIX: Adjusted light colors to be more neutral for the photographic skybox.
    this.add(new THREE.AmbientLight(0xeeeeee, 0.6)); 
    this.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.7));

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(80, 100, -70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 400;
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    this.add(sun);
    this.add(sun.target);

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

// The old createSky function is no longer needed and can be removed.
