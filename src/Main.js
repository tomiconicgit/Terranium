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

    // ---------- Launch rig ----------
    this.launchGroup = null;          // parent that moves rocket + flames together
    this.originalTransform = null;    // world-space snapshot for reset
    this.launchTimers = [];
    this.launchActive = false;
    this.liftoffTime = 0;

    // ---------- New timing spec ----------
    // t=0  -> press Ignite (sound starts immediately)
    // t=11 -> flames ON + jolt + vibration start
    // t=16 -> liftoff (5s after flames)
    // t=80 -> rocket disappears (relative to sound start)
    this.S_FLAME_ON           = 10.0;
    this.S_AFTER_FLAME_TO_LIFTOFF = 5.0;
    this.S_DISAPPEAR_AFTER_SOUND  = 80.0;

    // Tilt timing (unchanged as requested)
    this.TILT_START = 30.0;     // seconds after liftoff
    this.tiltRampSeconds = 8.0; // ramp-in time for tilt

    // Motion tuning (kept same as recent pass, tweak if needed)
    this.ascentHeight = 2400;   // total climb by (approx) end of flight
    this.maxTiltDeg = 5.0;      // gentle pitch

    // Bookkeeping for “sound-start” absolute schedule
    this.soundStartTime = null; // clock seconds when Ignite was pressed

    // ---------- Camera shake ----------
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
      stopAfterLiftoffSec: 20.0 // vibration stops 20s after liftoff (unchanged)
    };
    this._camSavedPos = new THREE.Vector3();
    this._camSavedRot = new THREE.Euler(0,0,0,'YXZ');

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

  /* ---------------- UI + Systems ---------------- */
  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Wrap ignition to arm/cancel launch with your schedule
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
        // Place model then preserve world transform while reparenting
        model.position.set(obj.position.x,obj.position.y,obj.position.z);
        model.scale.set(obj.scale.x,obj.scale.y,obj.scale.z);
        model.rotation.set(obj.rotation.x,obj.rotation.y,obj.rotation.z);
        this.scene.add(model);
        this.launchGroup.attach(model); // keeps world pose
        this.debugger?.log(`Loaded static model: ${obj.name}`);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;

          // Instanced flames attach to same parent as rocket (our launchGroup)
          this.instanced = new InstancedFlames(
            this.rocketModel,
            bakedFlameOffsets,
            cloneDefaults(),
            this.camera,
            { ignite: 'src/assets/RocketIgnition.wav' }  // upgraded WAV will play at Ignite press
          );
          // Start with flames off
          this.instanced.setIgnition(false);
          // We will override the visual ignition delay each time based on S_FLAME_ON
          this.effects.push(this.instanced);

          // Save base transform for reset
          this.originalTransform = this.captureWorld(this.launchGroup);

          this.enginePanel.setReady(true);
        }
      },(error)=>{ this.debugger?.handleError(error, `StaticModel: ${obj.name}`); });
    });
  }

  /* ---------------- Launch Sequencer ---------------- */
  onIgnitionToggle(on){
    if (!this.instanced) return;

    // Clear any pending sequence timers
    this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;

    if (on) {
      // Mark when the sound starts (press time)
      this.soundStartTime = this.clock.getElapsedTime();

      // Restore to ground before each new sequence
      if (this.originalTransform) this.applyWorld(this.launchGroup, this.originalTransform);
      this.launchGroup.visible = true;

      // Ensure InstancedFlames visual delay matches "flames at +11s"
      this.instanced.ignitionDelayMs = Math.max(0, this.S_FLAME_ON * 1000);

      // Calling setIgnition(true) will: play sound NOW, and show flames after ignitionDelayMs
      this.instanced.setIgnition(true);

      // Schedule jolt + start subtle vibration at the same moment flames appear
      this.launchTimers.push(setTimeout(()=>{
        this.startIgnitionShake();
      }, this.S_FLAME_ON * 1000));

      // Liftoff exactly 5s after flames come on
      const liftoffDelayMs = (this.S_FLAME_ON + this.S_AFTER_FLAME_TO_LIFTOFF) * 1000;
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = true;
        this.liftoffTime = this.clock.getElapsedTime(); // seconds since app start
      }, liftoffDelayMs));

      // Auto-disappear exactly 80s after sound start
      this.launchTimers.push(setTimeout(()=>{
        this.forceDisappear();
      }, this.S_DISAPPEAR_AFTER_SOUND * 1000));
    } else {
      // User hit Cutoff
      this.launchActive = false;
      this.instanced.setIgnition(false);
      this.stopAllShake();
      this.soundStartTime = null;
    }
  }

  forceDisappear(){
    // Hide stack, stop engines + shake
    this.launchActive = false;
    this.launchGroup && (this.launchGroup.visible = false);
    this.instanced?.setIgnition(false);
    this.stopAllShake();
  }

  startIgnitionShake(){
    const now = this.clock.getElapsedTime();
    // Big kick -> fast decay
    this.shake.joltActive  = true;
    this.shake.joltStart   = now;

    // Subtle rumble on continuously; we’ll stop it 20s after liftoff
    this.shake.minorActive = true;
    this.shake.minorSeed   = Math.random() * 1000;
  }

  stopAllShake(){
    this.shake.joltActive  = false;
    this.shake.minorActive = false;
  }

  updateLaunch(dt, nowSec){
    // Even if not launched yet, we may be pre-liftoff shaking:
    this.updateShake(nowSec);

    if (!this.launchActive || !this.launchGroup) return;

    // Time since liftoff (not since sound)
    const t = Math.max(0, nowSec - this.liftoffTime);

    // Vertical motion: slow start then accelerating (ease-in cubic)
    const u = t / Math.max(1e-4, (this.S_DISAPPEAR_AFTER_SOUND - (this.S_FLAME_ON + this.S_AFTER_FLAME_TO_LIFTOFF)));
    const unclamped = Math.max(0, Math.min(1, u));
    const easeInCubic = x => x * x * x;
    const yOffset = easeInCubic(unclamped) * this.ascentHeight;

    // Tilt begins 30s after liftoff; ramp in over tiltRampSeconds
    const tiltPhase = Math.max(0, t - this.TILT_START);
    const tiltRamp = Math.min(1, tiltPhase / Math.max(0.0001, this.tiltRampSeconds));
    const easeInOut = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
    const tiltRad = THREE.MathUtils.degToRad(this.maxTiltDeg) * easeInOut(tiltRamp);

    // Apply to launchGroup while preserving base yaw/roll
    if (this.originalTransform) {
      this.launchGroup.position.set(
        this.originalTransform.pos.x,
        this.originalTransform.pos.y + yOffset,
        this.originalTransform.pos.z
      );
      this.launchGroup.rotation.set(
        this.originalTransform.rot.x + tiltRad, // pitch forward
        this.originalTransform.rot.y,
        this.originalTransform.rot.z
      );
    } else {
      this.launchGroup.position.y = yOffset;
      this.launchGroup.rotation.x = tiltRad;
    }

    // Stop minor vibration 20s into flight
    if (t >= this.shake.stopAfterLiftoffSec) this.shake.minorActive = false;
  }

  /* ---------------- Camera shake core ---------------- */
  updateShake(now){
    if (!this.shake.joltActive && !this.shake.minorActive) return;

    // Save camera transform to restore after render
    this._camSavedPos.copy(this.camera.position);
    this._camSavedRot.copy(this.camera.rotation);

    // Jolt (quick decay)
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

    // Stage offsets; they’ll be applied just before render and then restored
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
      this.instanced?.setIgnition(false);
      this.stopAllShake();
      this.soundStartTime = null;

      if (this.launchGroup && this.originalTransform) {
        this.applyWorld(this.launchGroup, this.originalTransform);
        this.launchGroup.visible = true;
      }
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

    // Launch motion (liftoff-relative)
    this.updateLaunch(dt, now);

    // FX updates
    for (const fx of this.effects) fx.update?.(dt, now, this.camera);

    // If the “disappear at +80s from sound” timer was cleared somehow, guard here:
    if (this.soundStartTime !== null && (now - this.soundStartTime) >= this.S_DISAPPEAR_AFTER_SOUND) {
      this.forceDisappear();
      this.soundStartTime = null; // prevent re-trigger
    }

    // Render with temporary camera shake, then restore
    if (this.highlighter?.update) this.highlighter.update(dt);
    this.applyPendingShakeAndRender();

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