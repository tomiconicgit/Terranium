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
    this.scene.add(this.terrain, this.sky);

    this.controls = new TouchPad(); this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3(); this.lookSpeed = 0.004; this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster(); this.rayDown = new THREE.Vector3(0, -1, 0);

    this.effects = [];
    this.instanced = null;
    this.rocketModel = null;

    // Launch rig
    this.launchGroup = null;          // parent of rocket + flames
    this.originalTransform = null;    // world-space snapshot of launchGroup
    this.launchTimers = [];
    this.launchActive = false;
    this.liftoffTime = 0;             // seconds (clock time when lift starts)
    this.disappearAfter = 48.0;       // seconds after liftoff
    this.ascentHeight = 2000;         // world units to climb before hiding
    this.maxTiltDeg = 5.0;            // gentle pitch during ascent

    this.clock = new THREE.Clock(); this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    this.makeResetButton();

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor(); this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Wrap ignition so we can arm/cancel the launch sequence reliably
    this.enginePanel = new EnginePanelUI({
      get: () => (this.instanced ? { ...this.instanced.params } : cloneDefaults()),
      set: (patch) => { if (this.instanced) this.instanced.setParams(patch); },
      setIgnition: (on) => this.onIgnitionToggle(on),
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
        // Add a dedicated launch group that will be moved/tilted.
        if (!this.launchGroup) {
          this.launchGroup = new THREE.Group();
          this.launchGroup.name = 'LaunchGroup';
          this.scene.add(this.launchGroup);
        }
        // Place model in scene first
        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model);

        // Reparent into launchGroup while preserving world transform
        this.launchGroup.attach(model);

        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;

          // Instanced flames attach to (rocketRoot.parent || rocketRoot) -> our launchGroup
          this.instanced = new InstancedFlames(
            this.rocketModel,
            bakedFlameOffsets,
            cloneDefaults(),
            this.camera,
            { ignite: 'src/assets/RocketIgnition.wav' }
          );
          this.instanced.setIgnition(false);
          this.effects.push(this.instanced);

          // Capture the group's original world transform (so reset is exact)
          this.originalTransform = this.captureWorld(this.launchGroup);

          this.enginePanel.setReady(true);
        }
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  /* ---------------- Launch Sequencer ---------------- */
  onIgnitionToggle(on){
    if (!this.instanced) return;
    this.instanced.setIgnition(on);

    // Clear any previous schedule
    this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;

    if (on) {
      // Ensure launch group visible & at base before re-arming
      if (this.originalTransform) this.applyWorld(this.launchGroup, this.originalTransform);
      this.launchGroup.visible = true;

      // Arm sequence: after 2.8s flames appear; +5s = liftoff
      const liftoffDelayMs = 2800 + 5000;
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = true;
        this.liftoffTime = this.clock.getElapsedTime(); // seconds
      }, liftoffDelayMs));
    } else {
      // Cancel in-flight motion
      this.launchActive = false;
    }
  }

  updateLaunch(dt, nowSec){
    if (!this.launchActive || !this.launchGroup) return;

    const t = Math.max(0, nowSec - this.liftoffTime);       // seconds since liftoff
    const u = Math.min(1, t / this.disappearAfter);         // 0..1 over the ascent window

    // Ease-in height (cubic for gentle start)
    const easeInCubic = (x)=> x*x*x;
    const y = easeInCubic(u) * this.ascentHeight;

    // Small tilt over first ~12s, then hold
    const tiltU = Math.min(1, t / 12);
    const easeInOut = (x)=> 0.5 - 0.5*Math.cos(Math.PI*x);
    const tiltRad = THREE.MathUtils.degToRad(this.maxTiltDeg) * easeInOut(tiltU);

    // Apply to launchGroup
    this.launchGroup.position.y = this.originalTransform ? this.originalTransform.pos.y + y : y;
    // Pitch slightly forward (around X). Keep Y/Z from original.
    this.launchGroup.rotation.set(
      (this.originalTransform ? this.originalTransform.rot.x : 0) + tiltRad,
      this.originalTransform ? this.originalTransform.rot.y : 0,
      this.originalTransform ? this.originalTransform.rot.z : 0
    );

    if (u >= 1) {
      // Done: hide and cut engines
      this.launchActive = false;
      this.launchGroup.visible = false;
      this.instanced.setIgnition(false);
    }
  }

  /* ---------------- Reset ---------------- */
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

    const place = () => {
      const hi = document.querySelector('#highlighter-btn, #highlight-btn');
      if (hi) {
        const r = hi.getBoundingClientRect();
        btn.style.left = `${Math.round(r.right + 10)}px`;
        btn.style.top  = `${Math.round(r.top)}px`;
      } else { btn.style.left='20px'; btn.style.top='20px'; }
    };
    place(); window.addEventListener('resize', place);

    btn.onclick = () => this.resetLaunch();
  }

  resetLaunch(){
    try{
      // stop sequence + timers
      this.launchActive = false;
      this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;

      // flames off and pending ignition canceled inside InstancedFlames
      this.instanced?.setIgnition(false);

      // restore exact original transform to the whole launchGroup
      if (this.launchGroup && this.originalTransform) {
        this.applyWorld(this.launchGroup, this.originalTransform);
        this.launchGroup.visible = true;
      }

      this.debugger?.log('Launch reset complete.');
    }catch(e){ this.debugger?.handleError(e,'ResetLaunch'); }
  }

  /* ---------------- Transform helpers (world-space safe) ---------------- */
  captureWorld(obj){
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    obj.matrixWorld.decompose(p,q,s);
    return { pos:p.clone(), rot:new THREE.Euler().setFromQuaternion(q), scl:s.clone() };
  }
  applyWorld(obj, tr){
    // parent-aware application
    const parent = obj.parent;
    const parentInv = new THREE.Matrix4();
    if (parent) { parent.updateMatrixWorld(true); parentInv.copy(parent.matrixWorld).invert(); }
    else parentInv.identity();

    const mw = new THREE.Matrix4().compose(
      tr.pos, new THREE.Quaternion().setFromEuler(tr.rot), tr.scl
    );
    const mLocal = new THREE.Matrix4().multiplyMatrices(parentInv, mw);

    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    mLocal.decompose(p,q,s);
    obj.position.copy(p); obj.quaternion.copy(q); obj.scale.copy(s);
    obj.updateMatrixWorld(true);
  }

  /* ---------------- Presets (kept) ---------------- */
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

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), now = this.clock.getElapsedTime();
    if (dt>0) this.updatePlayer(dt);

    // Launch motion
    this.updateLaunch(dt, now);

    // FX updates
    for (const fx of this.effects) fx.update?.(dt, now, this.camera);

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