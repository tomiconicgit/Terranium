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

    // ---------- Timeline (ABSOLUTE seconds from Ignite/sound start) ----------
    this.S_FLAME_ON  = 10.5;                 // flames + jolt + vibration start
    this.S_LIFTOFF   = this.S_FLAME_ON + 3;  // quicker liftoff (13.5s)
    this.S_TILT_ABS  = 45.0;                 // tilt begins at 45s (abs)
    this.S_DISAPPEAR = 80.0;                 // rocket disappears at 80s (abs)

    // ---------- Motion tuning ----------
    this.ascentHeight = 8000;   // higher apogee before disappearing
    this.maxTiltDeg   = 5.0;    // gentle pitch
    this.tiltRampSeconds = 10.0;

    // ---------- State for sequencing ----------
    this.launchGroup = null;        // parent for rocket + flames
    this.originalTransform = null;  // world-space snapshot for reset
    this.launchTimers = [];
    this.launchActive = false;

    // absolute time the sound/timeline started (set on Ignite)
    this.soundStartTime = null;

    // ---------- Camera shake ----------
    this.shakeActive   = false;
    this.shakeEndAbs   = Infinity;
    this.shakeJoltDone = false;
    this.shakeSeed     = Math.random() * 1000;

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

    // Wrap ignition to arm the absolute timeline
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
        // Launch group to move stack
        if (!this.launchGroup) {
          this.launchGroup = new THREE.Group();
          this.launchGroup.name = 'LaunchGroup';
          this.scene.add(this.launchGroup);
        }
        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model);
        this.launchGroup.attach(model); // keep world pose
        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;

          // Flames attach under the same moving parent
          this.instanced = new InstancedFlames(
            this.rocketModel,
            bakedFlameOffsets,
            cloneDefaults(),
            this.camera,
            { ignite: 'src/assets/RocketIgnition.wav' } // your upgraded audio goes here
          );
          this.instanced.setIgnition(false);
          this.effects.push(this.instanced);

          // Save base transform for reset
          this.originalTransform = this.captureWorld(this.launchGroup);

          this.enginePanel.setReady(true);
        }
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  /* ---------------- Ignite / Timeline ---------------- */
  onIgnitionToggle(on){
    if (!this.instanced) return;

    // stop previous sequence
    this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;
    this.launchActive = false;
    this.shakeActive = false;
    this.shakeJoltDone = false;

    if (on) {
      // Start absolute clock from "now"
      this.soundStartTime = this.clock.getElapsedTime();

      // Reset to ground state & show
      if (this.originalTransform) this.applyWorld(this.launchGroup, this.originalTransform);
      this.launchGroup.visible = true;

      // Schedule flames to appear exactly at S_FLAME_ON (respecting the 2.8s shader delay)
      const flameLead = 2.8; // internal InstancedFlames delay
      const tFlameCall = Math.max(0, this.S_FLAME_ON - flameLead);
      this.launchTimers.push(setTimeout(()=> this.instanced.setIgnition(true), tFlameCall*1000));

      // Camera shake: jolt + vib start exactly at S_FLAME_ON; stop 20s into flight
      const vibStopAtAbs = this.S_LIFTOFF + 20.0;
      this.launchTimers.push(setTimeout(()=>{
        this.shakeActive   = true;
        this.shakeJoltDone = false; // one-shot handled in updateCameraShake
        this.shakeEndAbs   = vibStopAtAbs;
      }, this.S_FLAME_ON*1000));

      // Begin liftoff at S_LIFTOFF (quicker)
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = true;
      }, this.S_LIFTOFF*1000));

      // Auto-hide stack at S_DISAPPEAR (and cut flames)
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = false;
        if (this.launchGroup) this.launchGroup.visible = false;
        this.instanced.setIgnition(false);
      }, this.S_DISAPPEAR*1000));
    } else {
      // Hard cutoff
      this.instanced.setIgnition(false);
      this.soundStartTime = null;
      this.launchActive = false;
      this.shakeActive = false;
    }
  }

  /* ---------------- Per-frame updates ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt  = this.clock.getDelta();
    const now = this.clock.getElapsedTime();

    if (dt>0) this.updatePlayer(dt);

    // Camera vibration (if armed)
    this.updateCameraShake(dt, now);

    // Launch motion
    this.updateLaunch(now);

    // FX
    for (const fx of this.effects) fx.update?.(dt, now, this.camera);

    if (this.highlighter?.update) this.highlighter.update(dt);
    this.renderer.render(this.scene,this.camera);
    this.frameCount++;
  }

  updateLaunch(nowSec){
    if (!this.launchActive || !this.launchGroup || this.soundStartTime === null) return;

    // Absolute timeline positions
    const abs = nowSec - this.soundStartTime;

    // Normalized ascent progress from liftoff to disappear
    const denom = Math.max(0.001, this.S_DISAPPEAR - this.S_LIFTOFF);
    const u = THREE.MathUtils.clamp((abs - this.S_LIFTOFF) / denom, 0, 1);

    // Faster early acceleration
    const easeFast = (x)=> Math.pow(x, 2.2); // quicker than cubic at start
    const yOffset = easeFast(u) * this.ascentHeight;

    // Tilt begins at absolute S_TILT_ABS, ramps over tiltRampSeconds
    const tiltPhase = Math.max(0, abs - this.S_TILT_ABS);
    const tiltRamp  = THREE.MathUtils.clamp(tiltPhase / Math.max(0.0001, this.tiltRampSeconds), 0, 1);
    const easeInOut = (x)=> 0.5 - 0.5 * Math.cos(Math.PI * x);
    const tiltRad   = THREE.MathUtils.degToRad(this.maxTiltDeg) * easeInOut(tiltRamp);

    // Apply transform relative to original
    if (this.originalTransform) {
      this.launchGroup.position.set(
        this.originalTransform.pos.x,
        this.originalTransform.pos.y + yOffset,
        this.originalTransform.pos.z
      );
      this.launchGroup.rotation.set(
        this.originalTransform.rot.x + tiltRad,
        this.originalTransform.rot.y,
        this.originalTransform.rot.z
      );
    } else {
      this.launchGroup.position.y = yOffset;
      this.launchGroup.rotation.x = tiltRad;
    }
  }

  /* ---------------- Camera shake ---------------- */
  updateCameraShake(dt, now){
    if (!this.shakeActive || this.soundStartTime === null) return;

    const abs = now - this.soundStartTime;

    // End condition
    if (abs >= this.shakeEndAbs) {
      this.shakeActive = false;
      this.camera.position.sub(this._shakeOffset ?? new THREE.Vector3());
      this._shakeOffset = new THREE.Vector3(0,0,0);
      return;
    }

    // One-shot jolt exactly at flame instant
    if (!this.shakeJoltDone && abs >= this.S_FLAME_ON) {
      this._shakeOffset = this._shakeOffset || new THREE.Vector3();
      this.camera.position.sub(this._shakeOffset);
      this._shakeOffset.set(0,0,0);

      // quick impulse
      const dir = new THREE.Vector3(
        (Math.random()*2-1), (Math.random()*2-1)*0.5, (Math.random()*2-1)
      ).normalize().multiplyScalar(0.25);
      this.camera.position.add(dir);
      this._shakeOffset.copy(dir);
      this.shakeJoltDone = true;
      return;
    }

    // Gentle ongoing vibration after jolt
    const t = abs - this.S_FLAME_ON;
    if (t <= 0) return;

    // remove previous frame's offset
    this._shakeOffset = this._shakeOffset || new THREE.Vector3();
    this.camera.position.sub(this._shakeOffset);

    // low-amplitude noise
    const amp = 0.05;               // gentle
    const f1  = 7.0, f2 = 11.0;     // two frequencies for richness
    const n1 = Math.sin((this.shakeSeed + t) * f1);
    const n2 = Math.cos((this.shakeSeed*1.37 + t) * f2);
    const xo = n1 * amp * 0.6;
    const yo = n2 * amp * 0.4;
    const zo = (n1+n2) * amp * 0.3;

    this._shakeOffset.set(xo, yo, zo);
    this.camera.position.add(this._shakeOffset);
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
      this.launchActive = false;
      this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;

      // stop camera shake + remove any residual offset
      if (this._shakeOffset) { this.camera.position.sub(this._shakeOffset); }
      this._shakeOffset = new THREE.Vector3(0,0,0);
      this.shakeActive = false;
      this.shakeJoltDone = false;

      // stop flames and restore base transform
      this.instanced?.setIgnition(false);
      if (this.launchGroup && this.originalTransform) {
        this.applyWorld(this.launchGroup, this.originalTransform);
        this.launchGroup.visible = true;
      }
      this.soundStartTime = null;

      this.debugger?.log('Launch reset complete.');
    }catch(e){ this.debugger?.handleError(e,'ResetLaunch'); }
  }

  /* ---------------- Transform helpers ---------------- */
  captureWorld(obj){
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    obj.matrixWorld.decompose(p,q,s);
    return { pos:p.clone(), rot:new THREE.Euler().setFromQuaternion(q), scl:s.clone() };
  }
  applyWorld(obj, tr){
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

  /* ---------------- Player move/look ---------------- */
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