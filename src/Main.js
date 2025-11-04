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

    // --- NEW: Store base sky colors for interpolation ---
    this.skyColors = {
      nightTop: new THREE.Color(0x050a1f),
      nightBottom: new THREE.Color(0x10152f),
      dayTop: new THREE.Color(0x4fa8ff),
      dayBottom: new THREE.Color(0xdfeaff)
    };
    
    // --- controls ---
    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    // *** UPDATED: Player height set to 1.83m (~6ft) ***
    this.playerHeight = 1.83; 

    // --- NEW: Camera Bob ---
    this.bobTime = 0;
    this.bobSpeed = 10;
    this.bobAmount = 0.08; // 8cm bob

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // --- World Models ---
    this.hallModel = null;
    this.loadHallModel();

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    // *** NEW: Sun slider listener ***
    this.sunSlider = document.getElementById('sun-slider');
    if (this.sunSlider) {
      this.sunSlider.addEventListener('input', (e) => this.updateSun(e.target.value));
      this.updateSun(this.sunSlider.value); // Set initial position
    }

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
        mat.alphaTest = 0.5;
      }
    };

    loadModel(
      'src/assets/ModernHall.glb',
      (model) => {
        model.position.set(0, 0, 0); // Place at world center, ground level
        
        model.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true; 
            o.receiveShadow = true; 
            
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

  // *** NEW: Function to update sun and sky based on slider ***
  updateSun(sliderValue) {
    const normalizedTime = sliderValue / 100; // 0.0 to 1.0
    // Angle: -0.25 (sunrise) -> 0.0 (noon) -> 0.25 (sunset) -> 0.5 (midnight)
    const angle = (normalizedTime - 0.25) * Math.PI * 2;
    
    const R = 600; // Sun distance
    
    // Sun rises in the East (positive Z), high at noon, sets in West (negative Z)
    const sunX = 0;
    const sunY = Math.sin(angle) * R; // Elevation (max at noon)
    const sunZ = Math.cos(angle) * R; // East/West
    this.sunLight.position.set(sunX, sunY, sunZ);

    // Sun progress: 0.0 at night, 1.0 at noon
    const sunProgress = Math.max(0, Math.sin(angle));

    // Intensity
    this.sunLight.intensity = sunProgress * 1.4 + 0.05; // Min 0.05, max 1.45
    this.ambientLight.intensity = sunProgress * 0.4 + 0.1; // Min 0.1, max 0.5
    
    // Sky Color
    this.sky.material.uniforms.topColor.value.lerpColors(
      this.skyColors.nightTop, 
      this.skyColors.dayTop, 
      sunProgress
    );
    this.sky.material.uniforms.bottomColor.value.lerpColors(
      this.skyColors.nightBottom, 
      this.skyColors.dayBottom, 
      sunProgress
    );
  }

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta();
    const now = this.clock.getElapsedTime();

    if (!this.controlsPaused) this.updatePlayer(dt);

    // Simple render
    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
  }

  updatePlayer(deltaTime){
    const moveSpeed = 12.0 * deltaTime, mv=this.controls.moveVector, lv=this.controls.lookVector;
    
    if (lv.length()>0){
      this.camera.rotation.y -= lv.x*this.lookSpeed;
      this.camera.rotation.x -= lv.y*this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0);
    }

    // Check for movement
    const isMoving = mv.y !== 0 || mv.x !== 0;
    let bobOffset = 0;
    
    if (isMoving) {
      this.bobTime += deltaTime * this.bobSpeed;
      bobOffset = Math.sin(this.bobTime) * this.bobAmount;
    } else {
      this.bobTime = 0; // Reset time if not moving
    }
    
    this.playerVelocity.z = mv.y*moveSpeed; this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x); this.camera.translateZ(this.playerVelocity.z);

    // keep camera at least slightly above ground
    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);

    const collidableMeshes = [];
    this.terrain.traverse(o => { if (o.isMesh) collidableMeshes.push(o); });
    if (this.hallModel) {
        this.hallModel.traverse(o => { if (o.isMesh) collidableMeshes.push(o); });
    }

    const hits = this.raycaster.intersectObjects(collidableMeshes, true);
    if (hits.length > 0) {
      // *** UPDATED: Set Y-pos + player height + bob offset ***
      this.camera.position.y = hits[0].point.y + this.playerHeight + bobOffset;
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
