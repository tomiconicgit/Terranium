// src/Main.js
import * as THREE from 'three';
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';
import { TouchPad }       from './controls/TouchPad.js';
import { loadModel }      from './ModelLoading.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;

    // --- renderer / scene / camera ---
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // --- lighting / sky / terrain ---
    const lights = createLighting();
    this.ambientLight = lights.ambientLight;
    this.sunLight     = lights.sunLight;
    this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);

    this.sky = createSkyDome();
    this.terrain = createTerrain(); // 100x100 flat base
    this.scene.add(this.terrain, this.sky);

    // --- controls ---
    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // --- World Models ---
    this.hallModel = null;
    this.loadHallModel();

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    // All UI has been removed.

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  /**
   * Loads the main hall model into the scene.
   */
  loadHallModel() {
    // Helper function to set material properties for shadows
    const setMaterialProperties = (mat) => {
      if (mat.transparent) {
        // This is the key: It tells the renderer to only cast shadows
        // from pixels with an alpha value > 0.5 (the window rails)
        // and let light pass through pixels < 0.5 (the glass).
        mat.alphaTest = 0.5;
      }
    };

    loadModel(
      'src/assets/ModernHall.glb',
      (model) => {
        model.position.set(0, 0, 0); // Place at world center, ground level
        
        // *** NEW: Traverse model to set shadow and transparency properties ***
        model.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true; // All parts of the hall can cast shadows
            o.receiveShadow = true; // All parts can receive shadows
            
            // Handle transparent windows
            if (Array.isArray(o.material)) {
              o.material.forEach(mat => setMaterialProperties(mat));
            } else if (o.material) {
              setMaterialProperties(o.material);
            }
          }
        });
        
        this.scene.add(model);
        this.hallModel = model; // Save reference for collision
        this.debugger?.log('Loaded static model: ModernHall.glb');
      },
      (error) => {
        this.debugger?.handleError(error, 'StaticModel: ModernHall.glb');
      }
    );
  }

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta();
    const now = this.clock.getElapsedTime();

    if (!this.controlsPaused) this.updatePlayer(dt);

    // All rocket and effect updates removed

    // Simple render
    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
  }

  updatePlayer(deltaTime){
    // *** UPDATED: Increased moveSpeed from 5.0 to 12.0 ***
    const moveSpeed = 12.0 * deltaTime, mv=this.controls.moveVector, lv=this.controls.lookVector;
    
    if (lv.length()>0){
      this.camera.rotation.y -= lv.x*this.lookSpeed;
      this.camera.rotation.x -= lv.y*this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0);
    }
    this.playerVelocity.z = mv.y*moveSpeed; this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x); this.camera.translateZ(this.playerVelocity.z);

    // keep camera at least slightly above ground
    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);

    // UPDATED to check terrain AND hall model
    const collidableMeshes = [];
    this.terrain.traverse(o => { if (o.isMesh) collidableMeshes.push(o); });
    if (this.hallModel) {
        this.hallModel.traverse(o => { if (o.isMesh) collidableMeshes.push(o); });
    }

    const hits = this.raycaster.intersectObjects(collidableMeshes, true);
    if (hits.length > 0) {
      // *** UPDATED: Changed from Math.max to direct assignment to "stick" to floor ***
      this.camera.position.y = hits[0].point.y + this.playerHeight;
    }
  }

  onWindowResize(){
    this.camera.aspect = window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth,window.innerHeight);
  }

  initPerformanceMonitor(){
    setInterval(()=>{
      if (this.frameCount>0 && this.frameCount<30)
        this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`,'Performance');
      this.frameCount=0;
    },1000);
  }
}
