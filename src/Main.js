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

    const lights = createLighting();
    this.ambientLight = lights.ambientLight;
    this.sunLight     = lights.sunLight;
    this.scene.add(this.ambientLight, this.sunLight, this.sunLight.target);

    this.sky = createSkyDome();
    this.terrain = createTerrain({ selection: window.EXCAVATION_SELECTION || null });
    this.scene.add(this.terrain);
    this.scene.add(this.sky);

    this.controls = new TouchPad(); this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3(); this.lookSpeed = 0.004; this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster(); this.rayDown = new THREE.Vector3(0, -1, 0);

    this.effects = [];
    this.instanced = null;
    this.rocketModel = null;

    // launch/restore state
    this.originalTransform = null;  // filled after rocket loads
    this.launchGroup = null;        // if you already use one, we’ll honor it
    this._launchTimers = [];        // if you use timeouts elsewhere, we’ll clear them
    this._launchActive = false;

    this.clock = new THREE.Clock(); this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    // === Reset button ===
    this.makeResetButton();

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor(); this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

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

  loadStaticModels(){
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj=>{
      loadModel(obj.path,(model)=>{
        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model);
        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;

          // Capture original transform (world-space safe)
          this.originalTransform = this.captureTransform(this.rocketModel);

          // If your launch sequence already uses a group, keep it.
          // Otherwise leave model as-is; reset() works with or without a group.

          // Instanced flames (with ignite SFX)
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
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  /* ---------- Reset Launch ---------- */
  makeResetButton(){
    const btn = document.createElement('button');
    btn.id = 'reset-launch-btn';
    btn.textContent = 'Reset Launch';
    btn.style.cssText = `
      position:fixed; z-index:11; padding:8px 12px;
      border-radius:8px; border:1px solid rgba(255,255,255,0.25);
      background:rgba(30,30,36,0.9); color:#fff; cursor:pointer; top:20px; left:20px;
    `;
    document.body.appendChild(btn);

    // place it to the right of the Highlight button if present
    const place = () => {
      const hi = document.querySelector('#highlighter-btn, #highlight-btn');
      if (hi) {
        const r = hi.getBoundingClientRect();
        btn.style.left = `${Math.round(r.right + 10)}px`;
        btn.style.top  = `${Math.round(r.top)}px`;
      } else {
        btn.style.left = '20px';
        btn.style.top  = '20px';
      }
    };
    place();
    window.addEventListener('resize', place);

    btn.onclick = () => this.resetLaunch();
  }

  captureTransform(obj) {
    // World-space snapshot so we can restore regardless of parenting
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    obj.matrixWorld.decompose(p, q, s);
    return {
      pos: p.clone(),
      rot: new THREE.Euler().setFromQuaternion(q.clone()),
      scl: s.clone()
    };
  }

  applyTransformWorld(obj, tr) {
    // Apply world transform even if parented
    const parent = obj.parent;
    const parentInv = new THREE.Matrix4();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();

    if (parent) {
      parent.updateMatrixWorld(true);
      parentInv.copy(parent.matrixWorld).invert();
    } else {
      parentInv.identity();
    }

    const mw = new THREE.Matrix4()
      .compose(tr.pos, new THREE.Quaternion().setFromEuler(tr.rot), tr.scl);

    m.multiplyMatrices(parentInv, mw);
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    m.decompose(p, q, s);

    obj.position.copy(p);
    obj.quaternion.copy(q);
    obj.scale.copy(s);
    obj.updateMatrixWorld(true);
  }

  resetLaunch() {
    try {
      // 1) stop flames & any pending ignition timer
      this.instanced?.setIgnition(false);

      // 2) clear any timers you might be using for the launch sequence
      for (const t of this._launchTimers) clearTimeout(t);
      this._launchTimers.length = 0;
      this._launchActive = false;

      // 3) put the rocket back exactly where it started
      const target = this.launchGroup || this.rocketModel;
      if (target && this.originalTransform) {
        this.applyTransformWorld(target, this.originalTransform);
      }

      // 4) done — user can press IGNITE again
      this.debugger?.log('Launch reset complete.');
    } catch (e) {
      this.debugger?.handleError(e, 'ResetLaunch');
    }
  }

  // Presets (kept for completeness)
  applyDayPreset() {
    this.ambientLight.color.setHex(0xffffff);
    this.ambientLight.intensity = 0.45;
    this.sunLight.color.setHex(0xffffff);
    this.sunLight.intensity = 1.4;

    const az = THREE.MathUtils.degToRad(45);
    const el = THREE.MathUtils.degToRad(65);
    const R  = 600;
    this.sunLight.position.set(
      Math.sin(az)*Math.cos(el)*R, Math.sin(el)*R, Math.cos(az)*Math.cos(el)*R
    );

    const mat = this.sky.material;
    if (mat?.uniforms) {
      mat.uniforms.topColor.value.set(0x4fa8ff);
      mat.uniforms.bottomColor.value.set(0xdfeaff);
      mat.uniforms.offset.value = 20.0;
      mat.uniforms.exponent.value = 0.45;
    }
  }

  applyDuskPreset() {
    this.ambientLight.color.setHex(0x243760);
    this.ambientLight.intensity = 0.28;
    this.sunLight.color.setHex(0xffb07a);
    this.sunLight.intensity = 0.95;

    const az = THREE.MathUtils.degToRad(80);
    const el = THREE.MathUtils.degToRad(6);
    const R  = 600;
    this.sunLight.position.set(
      Math.sin(az)*Math.cos(el)*R, Math.sin(el)*R, Math.cos(az)*Math.cos(el)*R
    );

    const mat = this.sky.material;
    if (mat?.uniforms) {
      mat.uniforms.topColor.value.set(0x0e203a);
      mat.uniforms.bottomColor.value.set(0xf2a15a);
      mat.uniforms.offset.value = 6.0;
      mat.uniforms.exponent.value = 0.45;
    }
  }

  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), t = this.clock.elapsedTime;
    if (dt>0) this.updatePlayer(dt);

    // forward ticks to FX
    for (const fx of this.effects) fx.update?.(dt, t, this.camera);

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
    this.playerVelocity.z = mv.y*moveSpeed; this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x); this.camera.translateZ(this.playerVelocity.z);

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