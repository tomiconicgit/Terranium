// Scene.js â simplified flat grass terrain
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    this.background = new THREE.Color(0x87CEEB);

    /* ---------- Lights (with VSM shadows) ---------- */
    this.add(new THREE.AmbientLight(0xffffff, 0.15));

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(120, 180, -90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 600;

    // SHADOW UPGRADE: VSM parameters for soft, artifact-free shadows
    sun.shadow.bias = -0.00001;

    this.sun = sun;
    this.add(sun);
    this.add(sun.target); // The light's target must be in the scene to be movable

    this.add(new THREE.DirectionalLight(0xffffff, 0.25).position.set(-80, 120, 80));
    this.add(new THREE.HemisphereLight(0xdfeaff, 0x9a7c55, 0.5).position.set(0, 120, 0));

    /* ---------- Terrain ---------- */
    const terrainSize = 100;
    const geo = new THREE.PlaneGeometry(terrainSize, terrainSize);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x4d9c4b, // A simple grass green color
        roughness: 0.9,
        metalness: 0.0,
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.name = 'terrainPlane';
    terrain.receiveShadow = true;
    this.terrain = terrain;
    this.add(terrain);

    this._v3a = new THREE.Vector3();
    this._cameraTarget = new THREE.Vector3();
  }
  
  updateShadows(camera) {
    const shadowCam = this.sun.shadow.camera;
    const distance = 100;

    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.multiplyScalar(distance / 4);
    this._cameraTarget.add(camera.position);
    
    this.sun.target.position.copy(this._cameraTarget);
    
    const frustumSize = 80;
    shadowCam.left = -frustumSize;
    shadowCam.right = frustumSize;
    shadowCam.top = frustumSize;
    shadowCam.bottom = -frustumSize; // Corrected typo for proper shadow frustum
    
    shadowCam.updateProjectionMatrix();
  }

  getTerrainHeightAt(wx, wz) {
    // The terrain is a flat plane at y=0.
    return 0;
  }

  pressSand(centerWorld, bottomY, innerR, outerR, extraPress = 0.06) {
    // This function is disabled as the terrain is flat and should not deform.
    // The geometry is not updated, so we don't need to do anything here.
  }
}
