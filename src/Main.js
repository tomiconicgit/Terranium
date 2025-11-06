// src/Main.js
import * as THREE from 'three';
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';
import { TouchPad }       from './controls/TouchPad.js';
// import { loadModel }      from './ModelLoading.js'; // Not used by default
import { EditorManager }  from './EditorManager.js'; 

export class Main {
  // *** MODIFIED: Accept viewportContainer ***
  constructor(debuggerInstance, viewportContainer) {
    this.debugger = debuggerInstance;
    this.viewportContainer = viewportContainer;

    // --- renderer / scene / camera ---
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
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
    this.sunLight = lights.sunLight;
    
    this.hemiLight = new THREE.HemisphereLight(0x8ecaff, 0x404040, 0.8);
    this.scene.add(this.hemiLight, this.sunLight, this.sunLight.target);

    this.sky = createSkyDome();
    this.terrain = createTerrain();
    this.scene.add(this.terrain, this.sky);

    // *** NEW: Store reference to the mesh for texture swapping ***
    this.terrainMesh = this.terrain.getObjectByName('ConcreteTerrain_100x100_Flat');
    this.textureLoader = new THREE.TextureLoader();

    // *** NEW: Add grid helper ***
    this.gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444);
    this.scene.add(this.gridHelper);

    this.skyColors = {
      nightTop: new THREE.Color(0x02030a),
      nightBottom: new THREE.Color(0x0c101d),
      dayTop: new THREE.Color(0x4fa8ff),
      dayBottom: new THREE.Color(0xdfeaff)
    };
    
    // --- controls ---
    this.controls = new TouchPad();
    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 1.83; 
    this.bobTime = 0;
    this.bobSpeed = 10;
    this.bobAmount = 0.08; 
    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // --- World Models ---
    // *** REMOVED: this.loadHallModel() removed from start ***

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    // Sun slider is now handled by EditorManager
    
    // =========== NEW: INIT EDITOR ===========
    this.editorManager = new EditorManager(this);
    // ======================================

    // *** MODIFIED: Use new resize method ***
    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.controls.setPaused(this.editorManager.state === 'EDITOR');
    
    // *** MODIFIED: Set initial size ***
    this.onWindowResize();
    this.start();
  }

  // No loadHallModel method

  updateSun(sliderValue) {
    const normalizedTime = sliderValue / 100; // 0.0 to 1.0
    const angle = normalizedTime * Math.PI;
    const R = 600;
    
    this.sunLight.position.set(0, Math.sin(angle) * R, Math.cos(angle) * R);
    const sunProgress = Math.max(0, Math.sin(angle));
    this.sunLight.intensity = sunProgress * 2.5;
    this.hemiLight.intensity = sunProgress * 0.8 + 0.25;
    
    this.sky.material.uniforms.topColor.value.lerpColors(
      this.skyColors.nightTop, this.skyColors.dayTop, sunProgress
    );
    this.sky.material.uniforms.bottomColor.value.lerpColors(
      this.skyColors.nightBottom, this.skyColors.dayBottom, sunProgress
    );
  }

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta();

    if (this.editorManager.state === 'GAME') {
      this.updatePlayer(dt);
    }
    
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

    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);

    const collidableMeshes = [];
    this.scene.children.forEach(child => {
        if (child.isMesh || child.isGroup) {
            // Check if it's NOT one of the editor helpers
            if (child !== this.sky && child !== this.gridHelper && !child.isTransformControls) {
                child.traverse(o => { if (o.isMesh) collidableMeshes.push(o); });
            }
        }
    });

    const hits = this.raycaster.intersectObjects(collidableMeshes, true);
    if (hits.length > 0) {
      this.camera.position.y = hits[0].point.y + this.playerHeight + bobOffset;
    }
  }

  // *** MODIFIED: Resize based on container ***
  onWindowResize(){
    const width = this.viewportContainer.clientWidth;
    const height = this.viewportContainer.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  initPerformanceMonitor(){
    setInterval(()=>{
      if (this.frameCount>0 && this.frameCount<30)
        this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`,'Performance');
      this.frameCount=0;
    },1000);
  }
}
