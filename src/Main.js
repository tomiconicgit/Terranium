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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // --- lighting / sky / terrain ---
    const lights = createLighting();
    // this.ambientLight = lights.ambientLight; // <-- Removed
    this.sunLight     = lights.sunLight;
    
    // *** NEW: HemisphereLight for "under lighting" / environment light ***
    this.hemiLight = new THREE.HemisphereLight(
      0x8ecaff, // Sky color
      0x808080, // Ground color (from your concrete)
      0.5       // Initial intensity
    );
    this.scene.add(this.hemiLight);
    
    // this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);
    this.scene.add(this.sunLight, this.sunLight.target); // Add sun

    this.sky = createSkyDome();
    this.terrain = createTerrain(); // 100x100 flat base
    this.scene.add(this.terrain, this.sky);

    // Store base sky colors for interpolation
    this.skyColors = {
      // *** UPDATED: Darker night colors ***
      nightTop: new THREE.Color(0x02030a),
      nightBottom: new THREE.Color(0x0c101d),
      dayTop: new THREE.Color(0x4fa8ff),
      dayBottom: new THREE.Color(0xdfeaff)
    };
    
    // --- controls ---
    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 1.83; 

    // Camera Bob
    this.bobTime = 0;
    this.bobSpeed = 10;
    this.bobAmount = 0.08; 

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // --- World Models ---
    this.hallModel = null;
    this.loadHallModel();

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    this.sunSlider = document.getElementById('sun-slider');
    if (this.sunSlider) {
      this.sunSlider.addEventListener('input', (e) => this.updateSun(e.target.value));
      this.updateSun(this.sunSlider.value); // Set initial position
    }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  loadHallModel() {
    const setMaterialProperties = (mat) => {
      if (mat.transparent) {
        mat.alphaTest = 0.5;
      }
    };

    loadModel(
      'src/assets/ModernHall.glb',
      (model) => {
        model.position.set(0, 0, 0); 
        
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
        this.hallModel = model;
        this.debugger?.log('Loaded static model: ModernHall.glb');
      },
      (error) => {
        this.debugger?.handleError(error, 'StaticModel: ModernHall.glb');
      }
    );
  }

  // *** UPDATED: Rewritten sun/sky logic ***
  updateSun(sliderValue) {
    const normalizedTime = sliderValue / 100; // 0.0 to 1.0
    
    // Angle: 0.0 (sunrise) -> PI/2 (noon) -> PI (sunset)
    const angle = normalizedTime * Math.PI;
    
    const R = 600; // Sun distance
    
    // Sun rises in the East (positive Z), high at noon, sets in West (negative Z)
    const sunX = 0;
    const sunY = Math.sin(angle) * R; // Elevation (max at noon)
    const sunZ = Math.cos(angle) * R; // East/West
    this.sunLight.position.set(sunX, sunY, sunZ);

    // Sun progress: 0.0 at night, 1.0 at noon
    const sunProgress = Math.max(0, Math.sin(angle));

    // Intensity
    // Stronger sun, and a much stronger base light for PBR reflections
    this.sunLight.intensity = sunProgress * 2.5; // Max 2.5 at noon
    this.hemiLight.intensity = sunProgress * 0.8 + 0.25; // Min 0.25 (night), Max 1.05 (day)
    
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

    const isMoving = mv.y !== 0 || mv.x !== 0;
    let bobOffset = 0;
    
    if (isMoving) {
      this.bobTime += deltaTime * this.bobSpeed;
      bobOffset = Math.sin(this.bobTime) * this.bobAmount;
    } else {
      this.bobTime = 0;
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
