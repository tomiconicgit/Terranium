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

    // ---------- Launch rig & timings (ABSOLUTE from "press Ignite") ----------
    this.launchGroup = null;
    this.originalTransform = null;
    this.launchTimers = [];
    this.launchActive = false;

    // Timeline (sec since sound start)
    this.S_FLAME_ON   = 10.5; // flames visible + jolt + minor vibration start
    this.S_LIFTOFF    = 13.5; // liftoff
    this.S_TILT_ABS   = 45.0; // start tilt
    this.S_DISAPPEAR  = 80.0; // disappear (1m20s)

    // Motion tuning
    this.ascentHeight = 6500;
    this.maxTiltDeg   = 5.0;
    this.tiltRampSeconds = 10.0;

    // Camera shake (feel from the version you liked)
    this.shake = {
      joltActive: false,
      joltStart: 0,
      joltDuration: 0.6,
      joltAmpPos: 0.28,
      joltAmpRot: THREE.MathUtils.degToRad(0.55),

      minorActive: false,
      minorSeed: Math.random() * 1000,
      minorAmpPos: 0.022,
      minorAmpRot: THREE.MathUtils.degToRad(0.08),
      minorFreq: 23.0,
      stopAfterLiftoffSec: 20.0
    };
    this._camSavedPos = new THREE.Vector3();
    this._camSavedRot = new THREE.Euler(0,0,0,'YXZ');
    this._pendingShake = null;

    this.soundStartTime = null;   // absolute reference when you press Ignite

    // --- builder systems ---
    this.craft = new CraftSystem({
      scene:this.scene, camera:this.camera, renderer:this.renderer, debuggerInstance:this.debugger
    });
    this.builder = new BuilderController({ camera:this.camera, craft:this.craft });

    // --- clock / perf ---
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // --- UIs ---
    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene,
        camera: this.camera,
        terrainGroup: this.terrain,
        debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    // Reset button for rocket
    this.makeResetButton();

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

    // Engine panel triggers the SAME launch sequence we agreed on
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

  /* ---------------- Rocket load ---------------- */
  loadStaticModels(){
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj=>{
      loadModel(
        obj.path,
        (model)=>{
          // Create the launch group once so rocket + flames move together
          if (!this.launchGroup) {
            this.launchGroup = new THREE.Group();
            this.launchGroup.name = 'LaunchGroup';
            this.scene.add(this.launchGroup);
          }

          // place model at authored transform
          model.position.set(obj.position.x,obj.position.y,obj.position.z);
          model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
          model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
          this.scene.add(model);
          this.launchGroup.attach(model); // keep world pose but parent under launchGroup
          this.debugger?.log(`Loaded static model: ${obj.name}`);

          if (obj.name === 'SuperHeavy') {
            this.rocketModel = model;

            // Flames attach; we still control ignition from Main timing
            this.instanced = new InstancedFlames(
              this.rocketModel,
              bakedFlameOffsets,
              cloneDefaults(),
              this.camera,
              { ignite: 'src/assets/RocketIgnition.wav' }
            );
            this.instanced.setIgnition(false);
            this.effects.push(this.instanced);

            // Save base transform to reset
            this.originalTransform = this.captureWorld(this.launchGroup);

            this.enginePanel.setReady(true);
          }
        },
        (error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); }
      );
    });
  }

  /* ---------------- Launch Sequencer ---------------- */
  onIgnitionToggle(on){
    if (!this.instanced) return;

    // Clear any pending sequence timers
    this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;
    this.launchActive = false;
    this.stopAllShake();

    if (on) {
      // Start absolute clock NOW. Sound must start immediately.
      this.soundStartTime = this.clock.getElapsedTime();

      // Play the ignition audio immediately (support both helper names if they exist)
      (this.instanced.playIgnitionSound?.() ?? this.instanced._playIgnite?.());

      // Restore to ground before each new sequence
      if (this.originalTransform) this.applyWorld(this.launchGroup, this.originalTransform);
      this.launchGroup.visible = true;

      // Schedule flames to APPEAR exactly at 10.5s absolute.
      // InstancedFlames visuals show ~2.8s AFTER setIgnition(true)
      const internalDelay = 2.8;
      const tCall = Math.max(0, this.S_FLAME_ON - internalDelay); // 7.7s
      this.launchTimers.push(setTimeout(()=>{
        this.instanced.setIgnition(true);
      }, tCall*1000));

      // Camera jolt + minor vibration right at 10.5s
      this.launchTimers.push(setTimeout(()=>{
        this.startIgnitionShake();
      }, this.S_FLAME_ON*1000));

      // Liftoff at 13.5s absolute
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = true;
      }, this.S_LIFTOFF*1000));

      // Disappear at 80s absolute
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = false;
        if (this.launchGroup) this.launchGroup.visible = false;
        this.instanced.setIgnition(false);
        this.stopAllShake();
      }, this.S_DISAPPEAR*1000));

    } else {
      // Hard cutoff
      this.instanced.setIgnition(false);
      this.soundStartTime = null;
      this.launchActive = false;
      this.stopAllShake();
    }
  }

  updateLaunch(dt, nowSec){
    if (!this.launchActive || !this.launchGroup) return;

    // Absolute seconds since "press Ignite"
    const tAbs = nowSec - (this.soundStartTime ?? 0);
    const tSinceLiftoff = Math.max(0, tAbs - this.S_LIFTOFF);

    // Total climb window (liftoff -> disappear)
    const climbDuration = Math.max(0.0001, this.S_DISAPPEAR - this.S_LIFTOFF);
    const u = Math.min(1, tSinceLiftoff / climbDuration);

    // Faster lift and acceleration (ease-out expo)
    const easeOutExpo = x => (x === 1) ? 1 : 1 - Math.pow(2, -10 * x);
    const yOffset = easeOutExpo(u) * this.ascentHeight;

    // Tilt begins at S_TILT_ABS; ramp over tiltRampSeconds
    const tSinceTiltStart = Math.max(0, tAbs - this.S_TILT_ABS);
    const tiltRamp = Math.min(1, tSinceTiltStart / Math.max(0.0001, this.tiltRampSeconds));
    const easeInOut = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
    const tiltRad = THREE.MathUtils.degToRad(this.maxTiltDeg) * easeInOut(tiltRamp);

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

    // Stop minor vibration 20s into flight
    if (tSinceLiftoff >= this.shake.stopAfterLiftoffSec) this.shake.minorActive = false;
  }

  /* ---------------- Camera shake ---------------- */
  startIgnitionShake(){
    const now = this.clock.getElapsedTime();
    this.shake.joltActive  = true;
    this.shake.joltStart   = now;
    this.shake.minorActive = true;
    this.shake.minorSeed   = Math.random() * 1000;
  }
  stopAllShake(){
    this.shake.joltActive  = false;
    this.shake.minorActive = false;
  }
  updateShake(now){
    if (!this.shake.joltActive && !this.shake.minorActive) { this._pendingShake = null; return; }

    // Save current transform
    this._camSavedPos.copy(this.camera.position);
    this._camSavedRot.copy(this.camera.rotation);

    // Jolt (decays quickly)
    let jPosX=0, jPosY=0, jPosZ=0, jRotX=0, jRotY=0, jRotZ=0;
    if (this.shake.joltActive) {
      const t = now - this.shake.joltStart;
      if (t >= this.shake.joltDuration) {
        this.shake.joltActive = false;
      } else {
        const q = 1.0 - (t / this.shake.joltDuration);
        const ampPos = this.shake.joltAmpPos * q * q;
        const ampRot = this.shake.joltAmpRot * q * q;
        jPosX = ampPos * (Math.sin(61*now) + 0.5*Math.sin(89*now));
        jPosY = ampPos * (Math.sin(73*now) + 0.5*Math.sin(97*now));
        jPosZ = ampPos * (Math.sin(67*now) + 0.5*Math.sin(83*now));
        jRotX = ampRot * (Math.sin(71*now));
        jRotY = ampRot * (Math.sin(79*now));
        jRotZ = ampRot * (Math.sin(101*now));
      }
    }

    // Minor rumble
    let mPosX=0, mPosY=0, mPosZ=0, mRotX=0, mRotY=0, mRotZ=0;
    if (this.shake.minorActive) {
      const t = now + this.shake.minorSeed;
      const f = this.shake.minorFreq;
      const f2 = f * 0.37;
      const f3 = f * 0.61;
      const ampPos = this.shake.minorAmpPos;
      const ampRot = this.shake.minorAmpRot;
      mPosX = ampPos * (Math.sin(f*t)   * 0.6 + Math.sin(f2*t) * 0.4);
      mPosY = ampPos * (Math.sin(f2*t)  * 0.7 + Math.sin(f3*t) * 0.3);
      mPosZ = ampPos * (Math.sin(f3*t)  * 0.5 + Math.sin(f*t)  * 0.5);
      mRotX = ampRot * Math.sin(f2*t);
      mRotY = ampRot * Math.sin(f3*t);
      mRotZ = ampRot * Math.sin(f*t);
    }

    this._pendingShake = {
      pos: new THREE.Vector3(jPosX + mPosX, jPosY + mPosY, jPosZ + mPosZ),
      rot: new THREE.Euler(
        this._camSavedRot.x + jRotX + mRotX,
        this._camSavedRot.y + jRotY + mRotY,
        this._camSavedRot.z + jRotZ + mRotZ,
        'YXZ'
      )
    };
  }
  applyPendingShakeAndRender(){
    if (this._pendingShake) {
      const p = this._pendingShake.pos, r = this._pendingShake.rot;
      this.camera.position.add(p);
      this.camera.rotation.set(r.x, r.y, r.z, 'YXZ');
    }
    this.renderer.render(this.scene, this.camera);
    if (this._pendingShake) {
      this.camera.position.copy(this._camSavedPos);
      this.camera.rotation.copy(this._camSavedRot);
      this._pendingShake = null;
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
    btn.onclick = () => this.resetLaunch();
  }
  resetLaunch(){
    try{
      this.launchActive = false;
      this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;
      this.instanced?.setIgnition(false);
      this.stopAllShake();
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
    return { pos:p.clone(), rot:new THREE.Euler().setFromQuaternion(q, 'YXZ'), scl:s.clone() };
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

  /* ---------------- Main loop ---------------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), now = this.clock.getElapsedTime();

    if (!this.controlsPaused) this.updatePlayer(dt);

    // Builder input + preview
    this.builder.update(dt);
    this.craft.update(dt);

    // Rocket motion + shake
    this.updateLaunch(dt, now);
    this.updateShake(now);

    // FX updates (flames, etc.)
    for (const fx of this.effects) fx.update?.(dt, now, this.camera);

    if (this.highlighter?.update) this.highlighter.update(dt);

    // Render with temporary shake offsets then restore
    this.applyPendingShakeAndRender();

    this.frameCount++;
  }

  updatePlayer(deltaTime){
    const moveSpeed = 5.0*deltaTime, mv=this.controls.moveVector, lv=this.controls.lookVector;
    if (lv.length()>0){
      this.camera.rotation.y -= lv.x*this.lookSpeed;
      this.camera.rotation.x -= lv.y*this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0,0);
    }
    this.playerVelocity.z = mv.y*moveSpeed; this.playerVelocity.x = mv.x*moveSpeed;
    this.camera.translateX(this.playerVelocity.x); this.camera.translateZ(this.playerVelocity.z);

    // keep camera at least slightly above ground
    const rayOrigin = new THREE.Vector3(this.camera.position.x,80,this.camera.position.z);
    this.raycaster.set(rayOrigin,this.rayDown);
    const terrainMeshes=[]; this.terrain.traverse(o=>{ if (o.isMesh) terrainMeshes.push(o); });
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