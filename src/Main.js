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

    // ---------- Launch rig & timings ----------
    this.launchGroup = null;          // parent that moves rocket + flames together
    this.originalTransform = null;    // world-space snapshot for reset
    this.launchTimers = [];
    this.launchActive = false;

    // Absolute times (seconds) relative to "press Ignite" (sound start)
    this.S_FLAME_ON   = 10.5;   // flames *visible* + jolt + vibration start
    this.S_LIFTOFF    = 13.5;   // liftoff shortly after flames
    this.S_TILT_ABS   = 45.0;   // start tilt
    this.S_DISAPPEAR  = 80.0;   // rocket disappears (1m20s after sound start)

    // Motion tuning
    this.ascentHeight = 6000;   // climb before disappear
    this.maxTiltDeg   = 5.0;    // gentle pitch
    this.tiltRampSeconds = 10.0; // ramp tilt in over 10s once it begins

    // Camera shake state
    this.shakeActive = false;
    this.shakeJoltDone = false;
    this.shakeEndAbs = 0;         // absolute seconds when shake ends
    this.soundStartTime = null;   // absolute clock reference (press Ignite)

    this.clock = new THREE.Clock(); this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch(e){ this.debugger?.handleError(e,'HighlighterInit'); }

    // Reset button
    this.makeResetButton();

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor(); this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene,(m)=>{ this.modelSliders.setActiveModel(m); },this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Wrap ignition to orchestrate full sequence
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
            { ignite: 'src/assets/RocketIgnition.wav' } // plays on click via playIgnitionSound()
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

  /* ---------------- Launch Sequencer ---------------- */
  onIgnitionToggle(on){
    if (!this.instanced) return;

    // Clear any pending sequence timers
    this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;
    this.launchActive = false;
    this.shakeActive = false;
    this.shakeJoltDone = false;

    if (on) {
      // Start absolute clock from NOW (sound must start immediately)
      this.soundStartTime = this.clock.getElapsedTime();

      // >>> Play the audio immediately on click (queues if buffer not yet loaded)
      this.instanced.playIgnitionSound?.();

      // Restore to ground before each new sequence
      if (this.originalTransform) this.applyWorld(this.launchGroup, this.originalTransform);
      this.launchGroup.visible = true;

      // Schedule flames to APPEAR at 10.5s absolute.
      // InstancedFlames shows visuals ~2.8s AFTER setIgnition(true),
      // so call setIgnition at (10.5 - 2.8) = 7.7s.
      const internalDelay = 2.8;
      const tCall = Math.max(0, this.S_FLAME_ON - internalDelay); // 7.7
      this.launchTimers.push(setTimeout(()=>{
        this.instanced.setIgnition(true);
      }, tCall*1000));

      // Camera shake (starts exactly at 10.5s, ends 20s after liftoff => 33.5s absolute)
      const vibStopAbs = this.S_LIFTOFF + 20.0;
      this.launchTimers.push(setTimeout(()=>{
        this.shakeActive   = true;
        this.shakeJoltDone = false; // do one jolt on first frames
        this.shakeEndAbs   = vibStopAbs;
      }, this.S_FLAME_ON*1000));

      // Liftoff at 13.5s absolute
      this.launchTimers.push(setTimeout(()=>{
        this.launchActive = true;
        this.liftoffStartAbs = this.S_LIFTOFF;
      }, this.S_LIFTOFF*1000));

      // Disappear at 80s absolute
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

  updateLaunch(dt, nowSec){
    if (!this.launchActive || !this.launchGroup) return;

    // t since liftoff (absolute)
    const tAbs = nowSec - (this.soundStartTime ?? 0);
    const tSinceLiftoff = Math.max(0, tAbs - this.S_LIFTOFF);

    // Duration available for climb (liftoff -> disappear)
    const climbDuration = Math.max(0.0001, this.S_DISAPPEAR - this.S_LIFTOFF);
    const u = Math.min(1, tSinceLiftoff / climbDuration);

    // Vertical motion: faster ease (ease-out expo)
    const easeOutExpo = x => (x === 1) ? 1 : 1 - Math.pow(2, -10 * x);
    const yOffset = easeOutExpo(u) * this.ascentHeight;

    // Tilt begins at S_TILT_ABS; ramp in over tiltRampSeconds
    const tSinceTiltStart = Math.max(0, tAbs - this.S_TILT_ABS);
    const tiltRamp = Math.min(1, tSinceTiltStart / Math.max(0.0001, this.tiltRampSeconds));
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
  }

  /* ---------------- Camera Shake ---------------- */
  updateCameraShake(dt, nowSec){
    if (!this.shakeActive) return;

    const abs = nowSec - (this.soundStartTime ?? 0);

    // Stop at scheduled absolute time
    if (abs >= this.shakeEndAbs) {
      this.shakeActive = false;
      return;
    }

    // First few frames after start: a single strong jolt
    if (!this.shakeJoltDone) {
      this.shakeJoltDone = true;
      this.camera.rotation.x += THREE.MathUtils.degToRad(0.6);
      this.camera.rotation.y += THREE.MathUtils.degToRad(0.4);
      this.camera.position.y -= 0.03;
      return;
    }

    // Minor continuous vibration
    const f = 35; // wiggle speed
    const aRot = 0.0035;     // radians
    const aPos = 0.015;      // meters
    const s = Math.sin(abs * f), c = Math.cos(abs * (f * 1.37));

    this.camera.rotation.x += s * aRot * dt;
    this.camera.rotation.y += c * aRot * dt;
    this.camera.position.x += s * aPos * dt;
    this.camera.position.y += c * aPos * dt;
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
      this.shakeActive = false;
      this.shakeJoltDone = false;
      this.launchTimers.forEach(t=>clearTimeout(t)); this.launchTimers.length=0;
      this.instanced?.setIgnition(false);

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

    // Launch motion & camera shake
    this.updateLaunch(dt, now);
    this.updateCameraShake(dt, now);

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