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

// Builder (Minecraft-style)
import { CraftSystem } from './craft/Craft.js';
import { BuilderController } from './controls/BuilderController.js';

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
    this.terrain = createTerrain(); // 200x200 sandy base (procedural)
    this.scene.add(this.terrain, this.sky);

    // --- controls ---
    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // --- effects & rocket ---
    this.effects = [];
    this.instanced = null;
    this.rocketModel = null;

    // --- builder systems ---
    this.craft = new CraftSystem({ scene:this.scene, camera:this.camera, renderer:this.renderer, debuggerInstance:this.debugger });
    this.builder = new BuilderController({ camera:this.camera, craft:this.craft });

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    this.initModelSystems();
    this.loadStaticModels(); // <-- RESTORED: loads SuperHeavy + InstancedFlames

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene,
        camera: this.camera,
        terrainGroup: this.terrain,
        debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  /* ---------------- UI systems ---------------- */
  initModelSystems() {
    this.importModelUI = new ImportModelUI(
      this.scene,
      (m)=>{ this.modelSliders.setActiveModel(m); },
      this.debugger
    );
    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Engine panel: manual ignite/cutoff like before
    this.enginePanel = new EnginePanelUI({
      get: () => (this.instanced ? { ...this.instanced.params } : cloneDefaults()),
      set: (patch) => { if (this.instanced) this.instanced.setParams(patch); },
      setIgnition: (on) => { if (this.instanced) this.instanced.setIgnition(on); },
      getIgnition: () => (this.instanced ? !!this.instanced.params.enginesOn : false),
      onPanelOpen: () => { this.controlsPaused = true; this.controls.setPaused(true); },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); },
      placeFlame: () => -1, setMoveMode: (_on) => {}, selectFixed: (_idx) => false, getFixedList: () => [], copyFixedJSON: () => '[]',
    }, this.debugger);
  }

  /* ---------------- Rocket load (restored) ---------------- */
  loadStaticModels(){
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj=>{
      loadModel(
        obj.path,
        (model)=>{
          // place at authored transform
          model.position.set(obj.position.x,obj.position.y,obj.position.z);
          model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
          model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
          this.scene.add(model);
          this.debugger?.log(`Loaded static model: ${obj.name}`);

          if (obj.name === 'SuperHeavy') {
            this.rocketModel = model;

            // Instanced flames attach to same parent (scene), baked offsets
            this.instanced = new InstancedFlames(
              this.rocketModel,
              bakedFlameOffsets,
              cloneDefaults(),
              this.camera,
              { ignite: 'src/assets/RocketIgnition.wav' }
            );
            this.instanced.setIgnition(false);
            this.effects.push(this.instanced);

            this.enginePanel.setReady(true);
          }
        },
        (error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); }
      );
    });
  }

  /* ---------------- main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta();
    const now = this.clock.getElapsedTime();

    if (!this.controlsPaused) this.updatePlayer(dt);

    // Gamepad builder input
    this.builder.update(dt);

    // Craft preview & housekeeping
    this.craft.update(dt);

    // FX (flames etc.)
    for (const fx of this.effects) fx.update?.(dt, now, this.camera);

    if (this.highlighter?.update) this.highlighter.update(dt);
    this.renderer.render(this.scene,this.camera);

    this.frameCount++;
  }

  /* ---------------- movement ---------------- */
  updatePlayer(deltaTime){
    const moveSpeed = 5.0 * deltaTime;
    const mv = this.controls.moveVector;
    const lv = this.controls.lookVector;

    if (lv.length()>0){
      this.camera.rotation.y -= lv.x * this.lookSpeed;
      this.camera.rotation.x -= lv.y * this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0);
    }

    this.playerVelocity.z = mv.y * moveSpeed;
    this.playerVelocity.x = mv.x * moveSpeed;
    this.camera.translateX(this.playerVelocity.x);
    this.camera.translateZ(this.playerVelocity.z);

    // keep camera at least slightly above ground
    const rayOrigin = new THREE.Vector3(this.camera.position.x,80,this.camera.position.z);
    this.raycaster.set(rayOrigin,this.rayDown);
    const terrainMeshes=[];
    this.terrain.traverse(o=>{ if (o.isMesh) terrainMeshes.push(o); });
    const hits = this.raycaster.intersectObjects(terrainMeshes,true);
    if (hits.length>0) this.camera.position.y = Math.max(this.camera.position.y, hits[0].point.y + this.playerHeight);
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