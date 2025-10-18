// src/Main.js
import * as THREE from 'three';
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';
import { TouchPad }       from './controls/TouchPad.js';
import { ImportModelUI }  from './ui/ImportModel.js';
import { ModelSlidersUI } from './ui/ModelSliders.js';
import { EnginePanelUI }  from './ui/EnginePanel.js';
import { HighlighterUI }  from './ui/Highlighter.js';
import { worldObjects }   from './world/Mapping.js';
import { loadModel }      from './ModelLoading.js';

import { InstancedFlames }   from './effects/InstancedFlames.js';
import { bakedFlameOffsets } from './world/BakedFlames.js';
import { cloneDefaults }     from './effects/FlameDefaults.js';
import { RocketLightRig }    from './effects/RocketLightRig.js';

// Environment (Day/Dusk + plume controls)
import { EnvironmentPanelUI } from './ui/EnvironmentPanel.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;

    // --- Renderer / canvas ---
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 1.0;

    // --- Scene / camera / base lights ---
    this.scene  = new THREE.Scene();
    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const { ambientLight, sunLight } = createLighting();
    this.ambientLight = ambientLight;
    this.sunLight     = sunLight;
    this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);

    // --- Terrain / sky ---
    this.sky = createSkyDome();
    this.terrain = createTerrain({ selection: window.EXCAVATION_SELECTION || null });
    this.scene.add(this.terrain);
    this.scene.add(this.sky);

    // --- Controls / player ---
    this.controls = new TouchPad();
    this.controlsPaused = false;
    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;

    // --- Ground snap via raycast ---
    this.raycaster = new THREE.Raycaster();
    this.rayDown   = new THREE.Vector3(0, -1, 0);

    // --- FX containers ---
    this.effects = [];
    this.instanced = null;
    this.plumeRig = null;

    // legacy flags kept for UI compatibility
    this.fixedFX = []; this.activeFixedIndex = -1;
    this.flameMoveMode = false;
    this._dragActive = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragBase  = { x: 0, z: 0 };
    this._dragTarget = null;

    // --- Clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs and assets ---
    this.initModelSystems();
    this.loadStaticModels();

    // Environment panel (day/dusk + plume rig controls)
    this.envPanel = new EnvironmentPanelUI({
      setDay:  () => this.applyDayPreset(),
      setDusk: () => this.applyDuskPreset(),
      getPlume: () => this.plumeRig?.getParams(),
      setPlume: (patch) => this.plumeRig?.setParams(patch),
    }, this.debugger);

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  /* ---------------- UI systems ---------------- */
  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders  = new ModelSlidersUI(this.debugger);

    this.enginePanel = new EnginePanelUI({
      get: () => (this.instanced ? { ...this.instanced.params } : cloneDefaults()),
      set: (patch) => { if (this.instanced) this.instanced.setParams(patch); },
      setIgnition: (on) => { if (this.instanced) this.instanced.setIgnition(on); },
      getIgnition: () => (this.instanced ? !!this.instanced.params.enginesOn : false),
      onPanelOpen: () => { this.controlsPaused = true;  this.controls.setPaused(true);  },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); this.setMoveMode(false); },
      // no-ops for the old fixed flames mover:
      placeFlame: () => -1, setMoveMode: (_on) => {}, selectFixed: (_idx) => false, getFixedList: () => [], copyFixedJSON: () => '[]',
    }, this.debugger);
  }

  setMoveMode(on){ this.flameMoveMode=!!on; this._dragActive=false; this._dragTarget=null; }

  /* ---------------- Assets / models ---------------- */
  loadStaticModels(){
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj=>{
      loadModel(obj.path,(model)=>{

        // Ensure meshes are light/shadow ready
        model.traverse(n=>{
          if (n.isMesh){
            n.castShadow = true;
            n.receiveShadow = true;
            if (n.material) {
              // If the GLB used non-PBR, give sane PBR defaults so lights look good
              if ('metalness' in n.material === false) n.material.metalness = 0.0;
              if ('roughness' in n.material === false) n.material.roughness = 0.8;
            }
          }
        });

        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model);
        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;

          // --- Instanced flames only (with ignite SFX) ---
          this.instanced = new InstancedFlames(
            this.rocketModel,
            bakedFlameOffsets,
            cloneDefaults(),
            this.camera,
            { ignite: 'src/assets/RocketIgnition.wav' } // add cutoff here if you have it
          );
          this.instanced.setIgnition(false);
          this.effects.push(this.instanced);

          // --- Plume lighting rig (follows flame centroid/params) ---
          this.plumeRig = new RocketLightRig({
            parent: this.rocketModel.parent || this.rocketModel,
            rocketRoot: this.rocketModel,
            offsets: bakedFlameOffsets,
            getParams: () => (this.instanced ? this.instanced.params : cloneDefaults())
          });
          this.scene.add(this.plumeRig.group);
          this.effects.push(this.plumeRig);

          this.enginePanel.setReady(true);
        }
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  /* ---------------- Day / Dusk presets ---------------- */
  applyDayPreset() {
    // Lights
    this.ambientLight.color.setHex(0xffffff);
    this.ambientLight.intensity = 0.45;

    this.sunLight.color.setHex(0xffffff);
    this.sunLight.intensity = 1.4;

    // High sun
    const az = THREE.MathUtils.degToRad(45);
    const el = THREE.MathUtils.degToRad(65);
    const R  = 600;
    this.sunLight.position.set(
      Math.sin(az)*Math.cos(el)*R,
      Math.sin(el)*R,
      Math.cos(az)*Math.cos(el)*R
    );

    // Sky
    const mat = this.sky.material;
    if (mat?.uniforms) {
      mat.uniforms.topColor.value.set(0x4fa8ff);
      mat.uniforms.bottomColor.value.set(0xdfeaff);
      mat.uniforms.offset.value = 20.0;
      mat.uniforms.exponent.value = 0.45;
    }
  }

  applyDuskPreset() {
    // Lights
    this.ambientLight.color.setHex(0x243760);
    this.ambientLight.intensity = 0.28;

    this.sunLight.color.setHex(0xffb07a);
    this.sunLight.intensity = 0.95;

    // Low sun near horizon
    const az = THREE.MathUtils.degToRad(80);
    const el = THREE.MathUtils.degToRad(6);
    const R  = 600;
    this.sunLight.position.set(
      Math.sin(az)*Math.cos(el)*R,
      Math.sin(el)*R,
      Math.cos(az)*Math.cos(el)*R
    );

    // Sky
    const mat = this.sky.material;
    if (mat?.uniforms) {
      mat.uniforms.topColor.value.set(0x0e203a);
      mat.uniforms.bottomColor.value.set(0xf2a15a);
      mat.uniforms.offset.value = 6.0;
      mat.uniforms.exponent.value = 0.45;
    }
  }

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), t = this.clock.elapsedTime;
    if (dt>0) this.updatePlayer(dt);
    for (const fx of this.effects) fx.update?.(dt,t);
    if (this.highlighter?.update) this.highlighter.update(dt);
    this.renderer.render(this.scene,this.camera);
    this.frameCount++;
  }

  /* ---------------- Player / camera ---------------- */
  updatePlayer(deltaTime){
    if (this.controlsPaused) return;

    const moveSpeed = 5.0*deltaTime;
    const mv=this.controls.moveVector, lv=this.controls.lookVector;

    if (lv.length()>0){
      this.camera.rotation.y -= lv.x*this.lookSpeed;
      this.camera.rotation.x -= lv.y*this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0);
    }

    this.playerVelocity.z = mv.y*moveSpeed;
    this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x);
    this.camera.translateZ(this.playerVelocity.z);

    // Keep camera riding the ground
    const rayOrigin = new THREE.Vector3(this.camera.position.x,80,this.camera.position.z);
    this.raycaster.set(rayOrigin,this.rayDown);
    const terrainMeshes=[]; this.terrain.traverse(o=>{ if (o.isMesh) terrainMeshes.push(o); });
    const hits = this.raycaster.intersectObjects(terrainMeshes,true);
    if (hits.length>0) this.camera.position.y = hits[0].point.y + this.playerHeight;
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