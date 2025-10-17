// src/Main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';
import { TouchPad }       from './controls/TouchPad.js';
import { ImportModelUI }  from './ui/ImportModel.js';
import { ModelSlidersUI } from './ui/ModelSliders.js';
import { EnginePanelUI }  from './ui/EnginePanel.js';
import { HighlighterUI }  from './ui/Highlighter.js';
import { worldObjects, bakedFlames } from './world/Mapping.js'; // <-- bring baked list
import { loadModel }      from './ModelLoading.js';
import { EngineFX }       from './effects/EngineFX.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = createCamera(); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    const { ambientLight, sunLight } = createLighting(); this.scene.add(ambientLight, sunLight, sunLight.target);

    this.terrain = createTerrain({ selection: window.EXCAVATION_SELECTION || null });
    this.scene.add(this.terrain); this.scene.add(createSkyDome());

    this.controls = new TouchPad(); this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3(); this.lookSpeed = 0.004; this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster(); this.rayDown = new THREE.Vector3(0, -1, 0);

    this.effects = [];        // all FX (editable + fixed)
    this.fx = null;           // editable flame
    this.fixedFX = [];        // baked/fixed flames
    this.activeFixedIndex = -1;

    // Move mode for drag (already implemented)
    this.flameMoveMode = false;
    this._dragActive = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragBase  = { x: 0, z: 0 };
    this._dragTarget = null;
    this._bindMoveHandlers();

    this.clock = new THREE.Clock(); this.frameCount = 0;

    this.initModelSystems(); this.loadStaticModels();

    try { this.highlighter = new HighlighterUI({ scene:this.scene, camera:this.camera, terrainGroup:this.terrain, debugger:this.debugger }); }
    catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor(); this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : this.defaultFXParams()),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => {
        if (this.fx) this.fx.setIgnition(on);
        for (const f of this.fixedFX) f.setIgnition(on);     // <-- tie baked flames in
      },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false),

      onPanelOpen: () => { this.controlsPaused = true; this.controls.setPaused(true); },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); this.setMoveMode(false); },

      placeFlame: () => this.placeFixedFlame(),
      setMoveMode: (on) => this.setMoveMode(on),
      selectFixed: (idx) => this.setActiveFixed(idx),

      getFixedList: () => this.getFixedList(),
      copyFixedJSON: () => JSON.stringify(this.getFixedList(), null, 2),
    }, this.debugger);
  }

  defaultFXParams(){ return {
    enginesOn:true, flameWidthFactor:0.7, flameHeightFactor:0.8, flameYOffset:7.6,
    intensity:1.5, taper:0.0, bulge:1.0, tear:1.0, turbulence:0.5, noiseSpeed:2.2,
    diamondsStrength:0.9, diamondsFreq:2.8, rimStrength:0.0, rimSpeed:4.1,
    colorCyan:0.5, colorOrange:3.0, colorWhite:0.9,
    groupOffsetX:3.1, groupOffsetY:-3.0, groupOffsetZ:1.2,
    tailFadeStart:0.3, tailFeather:4.0, tailNoise:0.2,
    bottomFadeDepth:0.12, bottomFadeFeather:0.80,
    orangeShift:-0.2, lightIntensity:50.0, lightDistance:800.0, lightColor:'#ffb869'
  };}

  // ---- placement helpers (keep for manual placing too) ----
  placeFixedFlame(){
    if (!this.fx || !this.rocketModel) return -1;
    const p = this.fx.getParams();
    const f = new EngineFX(this.rocketModel, this.scene, this.camera);
    f.setParams(p);
    f.setIgnition(false);

    // Perf: fixed profile (skip some CPU deformation work)
    f.isFixed = true;
    f.setPerfProfile?.({ distance: 220, every: 3, disableLight: false });

    this.fixedFX.push(f);
    this.effects.push(f);
    this.activeFixedIndex = this.fixedFX.length - 1;
    return this.activeFixedIndex;
  }
  setActiveFixed(idx){ if (idx>=0 && idx<this.fixedFX.length){ this.activeFixedIndex=idx; return true; } this.activeFixedIndex=-1; return false; }
  getFixedList(){ return this.fixedFX.map((f,i)=>{ const p=f.getParams(); return { index:i,
    groupOffsetX:+p.groupOffsetX.toFixed(3), groupOffsetY:+p.groupOffsetY.toFixed(3), groupOffsetZ:+p.groupOffsetZ.toFixed(3) }; }); }
  setMoveMode(on){ this.flameMoveMode=!!on; if (!on){ this._dragActive=false; this._dragTarget=null; } }

  // ---- pick/drag code (unchanged) ----
  _clientToNDC(x,y){
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 };
  }
  _pickFlameAt(x,y){
    const targets = [];
    if (this.fx) targets.push(...this.fx.getRaycastTargets());
    for (const f of this.fixedFX) targets.push(...f.getRaycastTargets());
    if (!targets.length) return null;

    const ndc = this._clientToNDC(x,y);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    const m = hits[0].object;
    return m.userData.__engineFX || null;
  }
  _bindMoveHandlers(){
    const start = (x,y)=>{
      if (!this.flameMoveMode) return;
      const fx = this._pickFlameAt(x,y);
      if (!fx) return;
      this._dragTarget = fx; this._dragActive = true;
      this._dragStart = { x, y };
      const p = fx.getParams();
      this._dragBase = { x: p.groupOffsetX, z: p.groupOffsetZ };
    };
    const move = (x,y,e)=>{
      if (!this._dragActive || !this._dragTarget) return;
      if (e) e.preventDefault();
      const dx = x - this._dragStart.x;
      const dy = y - this._dragStart.y;
      const SCALE = 0.03;
      this._dragTarget.setParams({ groupOffsetX: this._dragBase.x + dx*SCALE, groupOffsetZ: this._dragBase.z + dy*SCALE });
    };
    const end = ()=>{ this._dragActive=false; this._dragTarget=null; };
    this.canvas.addEventListener('pointerdown', e=>start(e.clientX,e.clientY), { passive:true });
    this.canvas.addEventListener('pointermove', e=>move(e.clientX,e.clientY,e), { passive:false });
    window.addEventListener('pointerup', end, { passive:true });
    this.canvas.addEventListener('touchstart', e=>{ const t=e.changedTouches[0]; if(t) start(t.clientX,t.clientY); }, { passive:true });
    this.canvas.addEventListener('touchmove',  e=>{ const t=e.changedTouches[0]; if(t) move(t.clientX,t.clientY,e); }, { passive:false });
    window.addEventListener('touchend', end, { passive:true });
    window.addEventListener('touchcancel', end, { passive:true });
  }

  loadStaticModels(){
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj=>{
      loadModel(obj.path,(model)=>{
        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model); this.rocketModel = model;
        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          // 1) Editable flame (starts OFF)
          this.fx = new EngineFX(model,this.scene,this.camera);
          this.fx.setParams(this.defaultFXParams());
          this.fx.setIgnition(false);
          this.effects.push(this.fx);
          this.enginePanel.setReady(true);

          // 2) Baked flames from Mapping.js (start OFF; controlled by panel)
          if (Array.isArray(bakedFlames)) {
            bakedFlames.forEach((item, idx) => {
              const f = new EngineFX(model, this.scene, this.camera);
              f.setParams({
                ...this.defaultFXParams(),
                groupOffsetX: item.groupOffsetX,
                groupOffsetY: item.groupOffsetY,
                groupOffsetZ: item.groupOffsetZ
              });
              f.setIgnition(false);

              // Perf: light throttle for fixed flames
              f.isFixed = true;
              f.setPerfProfile?.({ distance: 220, every: 3, disableLight: false });

              this.fixedFX.push(f);
              this.effects.push(f);
            });
            this.debugger?.log(`Baked flames spawned: ${this.fixedFX.length}`);
          }
        }
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), t = this.clock.elapsedTime;
    if (dt>0) this.updatePlayer(dt);
    for (const fx of this.effects) fx.update(dt,t);
    if (this.highlighter?.update) this.highlighter.update(dt);
    this.renderer.render(this.scene,this.camera);
    this.frameCount++;
  }

  updatePlayer(deltaTime){
    if (this.controlsPaused) return;
    const moveSpeed = 5.0*deltaTime, mv=this.controls.moveVector, lv=this.controls.lookVector;
    if (lv.length()>0){ this.camera.rotation.y -= lv.x*this.lookSpeed; this.camera.rotation.x -= lv.y*this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0); }
    this.playerVelocity.z = mv.y*moveSpeed; this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x); this.camera.translateZ(this.playerVelocity.z);
    const rayOrigin = new THREE.Vector3(this.camera.position.x,80,this.camera.position.z);
    this.raycaster.set(rayOrigin,this.rayDown);
    const terrainMeshes=[]; this.terrain.traverse(o=>{ if (o.isMesh) terrainMeshes.push(o); });
    const hits = this.raycaster.intersectObjects(terrainMeshes,true);
    if (hits.length>0) this.camera.position.y = hits[0].point.y + this.playerHeight;
  }

  onWindowResize(){ this.camera.aspect = window.innerWidth/window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth,window.innerHeight); }
  initPerformanceMonitor(){ setInterval(()=>{ if (this.frameCount>0 && this.frameCount<30) this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`,'Performance'); this.frameCount=0; },1000); }
}