import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createSkyDome } from '../objects/SkyDome.js';
import { createGround100 } from '../voxel/Ground100.js';

export class SceneRoot {
  constructor(){
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // lights
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7c6a4d, 0.9); hemi.position.set(0,30,0);
    const sun  = new THREE.DirectionalLight(0xffffff, 1.35); sun.position.set(-40,60,-25);
    this.scene.add(hemi, sun);

    // camera
    this.camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.05, 2000);
    this.camera.position.set(6, 2, 6);

    // skydome
    this.scene.add(createSkyDome());

    // voxel ground 100×100 (y=0), default = sand
    const { mesh, raySurface } = createGround100({ size:100, color:0xe4d3a5 });
    mesh.name = 'ground';
    this.scene.add(mesh);
    this.groundRayMesh = raySurface; // invisible collider to raycast on
  }
  get groundRayMesh(){ return this._g; }
  set groundRayMesh(m){ this._g = m; }
  get scene(){ return this._s; } set scene(v){ this._s = v; }
  get camera(){ return this._c; } set camera(v){ this._c = v; }
}