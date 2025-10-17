// src/Main.js — loads bakedFlames from Mapping.js and spawns permanent EngineFX.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';
import { TouchPad }       from './controls/TouchPad.js';
import { ImportModelUI }  from './ui/ImportModel.js';
import { ModelSlidersUI } from './ui/ModelSliders.js';
import { EnginePanelUI }  from './ui/EnginePanel.js';
import { HighlighterUI }  from './ui/Highlighter.js';
import { worldObjects, bakedFlames }   from './world/Mapping.js';
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

    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const { ambientLight, sunLight } = createLighting();
    this.scene.add(ambientLight, sunLight, sunLight.target);

    this.terrain = createTerrain({ selection: window.EXCAVATION_SELECTION || null });
    this.scene.add(this.terrain);
    this.scene.add(createSkyDome());

    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    // Effects containers
    this.effects = [];
    this.fx = null;          // editable flame
    this.fixedFX = [];       // user-placed flames (individual)
    this.bakedFX = [];       // permanent baked flames
    this.activeFixedIndex = -1;

    // Move mode (drag X/Z by touch)
    this.flameMoveMode = false;
    this._dragActive = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragBase  = { x: 0, z: 0 };
    this._dragTarget = null;
    this._bindMoveHandlers();

    this.clock = new THREE.Clock();
    this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(
      this.scene,
      (m)=>{ this.modelSliders.setActiveModel(m); },
      this.debugger
    );
    this.modelSliders = new ModelSlidersUI(this.debugger);

    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : this.defaultFXParams()),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => {
        if (this.fx) this.fx.setIgnition(on);
        for (const f of this.fixedFX) f.setIgnition(on);
        for (const f of this.bakedFX) f.setIgnition(on);
      },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false),

      onPanelOpen: () => { this.controlsPaused = true; this.controls.setPaused(true); },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); this.setMoveMode(false); },

      placeFlame: () => this.placeFixedFlame(),
      setMoveMode: (on) => this.setMoveMode(on),
      selectFixed: (idx) => this.setActiveFixed(idx),

      getFixedList: () => this.getFixedList(),
      copyFixedJSON: () => JSON.stringify(this.getFixedList(), null, 2),

      exportAllFlamesJSON: () => this.exportAllFlamesJSON(),
      exportAnimatedGLB: (opts) => this.exportAnimatedGLB(opts),
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

  placeFixedFlame(){
    if (!this.fx || !this.rocketModel) return -1;
    const p = this.fx.getParams();
    const f = new EngineFX(this.rocketModel, this.scene, this.camera);
    f.setParams(p);
    f.setIgnition(false);
    this.fixedFX.push(f); this.effects.push(f);
    this.activeFixedIndex = this.fixedFX.length - 1;
    return this.activeFixedIndex;
  }
  setActiveFixed(idx){ if (idx>=0 && idx<this.fixedFX.length){ this.activeFixedIndex=idx; return true; } this.activeFixedIndex=-1; return false; }
  getFixedList(){ return this.fixedFX.map((f,i)=>{ const p=f.getParams(); return { index:i,
    groupOffsetX:+p.groupOffsetX.toFixed(3), groupOffsetY:+p.groupOffsetY.toFixed(3), groupOffsetZ:+p.groupOffsetZ.toFixed(3) }; }); }
  setMoveMode(on){ this.flameMoveMode=!!on; if (!on){ this._dragActive=false; this._dragTarget=null; } }

  // ---- picking helpers ----
  _clientToNDC(x,y){
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 };
  }
  _pickFlameAt(x,y){
    const targets = [];
    if (this.fx) targets.push(...this.fx.getRaycastTargets());
    for (const f of this.fixedFX) targets.push(...f.getRaycastTargets());
    for (const f of this.bakedFX) targets.push(...f.getRaycastTargets());
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
      this._dragTarget = fx;
      this._dragActive = true;
      this._dragStart.x = x; this._dragStart.y = y;
      const p = fx.getParams();
      this._dragBase.x = p.groupOffsetX; this._dragBase.z = p.groupOffsetZ;
    };
    const move = (x,y,e)=>{
      if (!this._dragActive || !this._dragTarget) return;
      if (e) e.preventDefault();
      const dx = x - this._dragStart.x;
      const dy = y - this._dragStart.y;
      const SCALE = 0.03;
      const nx = this._dragBase.x + dx * SCALE;
      const nz = this._dragBase.z + dy * SCALE;
      this._dragTarget.setParams({ groupOffsetX:nx, groupOffsetZ:nz });
    };
    const end = ()=>{ this._dragActive=false; this._dragTarget=null; };

    this.canvas.addEventListener('pointerdown', (e)=> start(e.clientX,e.clientY), { passive:true });
    this.canvas.addEventListener('pointermove', (e)=> move(e.clientX,e.clientY,e), { passive:false });
    window.addEventListener('pointerup', end, { passive:true });

    this.canvas.addEventListener('touchstart', (e)=>{ const t=e.changedTouches[0]; if(!t) return; start(t.clientX,t.clientY); }, { passive:true });
    this.canvas.addEventListener('touchmove',  (e)=>{ const t=e.changedTouches[0]; if(!t) return; move(t.clientX,t.clientY,e); }, { passive:false });
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
          // Editable flame
          this.fx = new EngineFX(model,this.scene,this.camera);
          this.fx.setParams(this.defaultFXParams());
          this.fx.setIgnition(false); // start OFF
          this.effects.push(this.fx);
          this.enginePanel.setReady(true);

          // === Create baked flames from Mapping.js ===
          if (Array.isArray(bakedFlames) && bakedFlames.length) {
            bakedFlames.forEach(entry => {
              const f = new EngineFX(model, this.scene, this.camera);
              // start with the same look as the editable default, then override offsets
              const p = this.defaultFXParams();
              f.setParams({
                ...p,
                groupOffsetX: entry.groupOffsetX,
                groupOffsetY: entry.groupOffsetY,
                groupOffsetZ: entry.groupOffsetZ
              });
              f.setIgnition(false);
              this.bakedFX.push(f);
              this.effects.push(f);
            });
            this.debugger?.log(`Spawned ${this.bakedFX.length} baked flames from Mapping.js`);
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

  // ===== Animated GLB Export (morph cache) =====
  async exportAnimatedGLB({ durationSec = 2.0, fps = 24, include = 'all' } = {}) {
    const src = [];
    if (include === 'all' || include === 'editable') { if (this.fx) src.push(this.fx); }
    if (include === 'all' || include === 'placed')   { src.push(...this.fixedFX); }
    if (include === 'all' || include === 'baked')    { src.push(...this.bakedFX); }
    if (src.length === 0) throw new Error('No flames to export.');

    for (const f of src) f.setIgnition(true);

    const frames = Math.max(2, Math.round(durationSec * fps));
    const group = new THREE.Group();
    group.name = 'BakedFlames';

    const clonePositions = (geom) => {
      const arr = geom.attributes.position.array;
      return new THREE.Float32BufferAttribute(new Float32Array(arr), 3);
    };

    const allTracks = [];
    let clipTimeMax = 0;

    for (let i = 0; i < src.length; i++) {
      const fx = src[i];
      const baseGeo = fx.mesh.geometry.clone();
      baseGeo.morphAttributes = {}; baseGeo.morphAttributes.position = [];

      for (let f = 0; f < frames; f++) {
        const t = f / fps;
        fx.update(0, t);
        const posAttr = clonePositions(fx.mesh.geometry);
        baseGeo.morphAttributes.position.push(posAttr);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffb869,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(baseGeo, mat);
      mesh.name = `Flame_${i}`;
      mesh.position.copy(fx.group.position);
      mesh.position.y += fx.mesh.position.y;
      mesh.rotation.copy(fx.group.rotation);
      mesh.scale.copy(fx.group.scale);
      mesh.updateMatrixWorld();
      group.add(mesh);

      for (let f = 0; f < frames; f++) {
        const t0 = f / fps;
        const t1 = (f + 1) / fps;
        clipTimeMax = Math.max(clipTimeMax, t1);
        const track = new THREE.NumberKeyframeTrack(
          `.objects[${mesh.uuid}].morphTargetInfluences[${f}]`,
          [t0, t1],
          [1, 0]
        );
        allTracks.push(track);
      }
    }

    const clip = new THREE.AnimationClip('FlameLoop', clipTimeMax, allTracks);
    group.animations = [clip];

    group.traverse(o => {
      if (o.isMesh && o.geometry?.morphAttributes?.position) {
        o.morphTargetDictionary = {};
        const count = o.geometry.morphAttributes.position.length;
        for (let i = 0; i < count; i++) o.morphTargetDictionary[`F${i}`] = i;
      }
    });

    const exporter = new GLTFExporter();
    exporter.parse(group, (glb) => {
      const blob = new Blob([glb], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'flames_animated.glb'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 250);
      this.debugger?.log('Animated GLB exported.');
    }, { binary: true, includeCustomExtensions: false });

    for (const f of src) f.setIgnition(false);
  }

  exportAllFlamesJSON() {
    const out = [];
    const pushFX = (f, type, index=null) => {
      const p = f.getParams();
      out.push({
        type, index,
        groupOffsetX:+p.groupOffsetX.toFixed(3),
        groupOffsetY:+p.groupOffsetY.toFixed(3),
        groupOffsetZ:+p.groupOffsetZ.toFixed(3),
        flameWidthFactor:p.flameWidthFactor,
        flameHeightFactor:p.flameHeightFactor,
        flameYOffset:p.flameYOffset,
        intensity:p.intensity, taper:p.taper, bulge:p.bulge, tear:p.tear,
        turbulence:p.turbulence, noiseSpeed:p.noiseSpeed,
        diamondsStrength:p.diamondsStrength, diamondsFreq:p.diamondsFreq,
        rimStrength:p.rimStrength, rimSpeed:p.rimSpeed,
        colorCyan:p.colorCyan, colorOrange:p.colorOrange, colorWhite:p.colorWhite,
        tailFadeStart:p.tailFadeStart, tailFeather:p.tailFeather, tailNoise:p.tailNoise,
        bottomFadeDepth:p.bottomFadeDepth, bottomFadeFeather:p.bottomFadeFeather,
        orangeShift:p.orangeShift
      });
    };
    if (this.fx) pushFX(this.fx,'editable',0);
    this.fixedFX.forEach((f,i)=>pushFX(f,'placed',i));
    this.bakedFX .forEach((f,i)=>pushFX(f,'baked',i));
    return JSON.stringify(out, null, 2);
  }
}