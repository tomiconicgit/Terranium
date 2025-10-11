// Scene.js — flat terrain + bright, even lighting
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Keep SkyDome if you already have one; otherwise solid sky
    this.background = new THREE.Color(0xbfd8ff);

    // Even lighting so edges are easy to see
    this.add(new THREE.AmbientLight(0xffffff, 0.35));
    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x857355, 1.0);
    hemi.position.set(0, 60, 0);
    this.add(hemi);
    const d1 = new THREE.DirectionalLight(0xffffff, 1.15); d1.position.set(60,80,-60);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.85); d2.position.set(-60,60,60);
    const d3 = new THREE.DirectionalLight(0xffffff, 0.55); d3.position.set(60,30,60);
    [d1,d2,d3].forEach(d => { d.castShadow = false; this.add(d); });

    // ---- Flat terrain (y = 0) ----
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0xdbc9a0, roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.name = 'terrainPlane';
    this.add(ground);

    // Root for placed pieces
    const world = new THREE.Group();
    world.name = 'world';
    this.add(world);
  }
}