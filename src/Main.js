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

    this.controls = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown = new THREE.Vector3(0, -1, 0);

    this.effects = [];
    this.instanced = null;
    this.rocketModel = null;

    // === Launch group handles rocket + flames ===
    this.launchGroup = new THREE.Group();
    this.launchGroup.name = 'LaunchGroup';
    this.scene.add(this.launchGroup);

    // === Launch state ===
    this.launch = {
      enginesWereOn: false,
      liftoffDelay:  5.0,      // seconds after flames start
      liftoffT0:     null,
      duration:      48.0,
      maxAltitude:   9000,     // 9 km (SkyDome radius = 10 km)
      maxTiltDeg:    8.0,
      active:        false,
      finished:      false
    };

    this.clock = new THREE.Clock();
    this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene, camera: this.camera, terrainGroup: this.terrain, debugger: this.debugger
      });
    } catch (e) { this.debugger?.handleError(e, 'HighlighterInit'); }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  initModelSystems() {
    this.importModelUI = new ImportModelUI(this.scene, (m) => { this.modelSliders.setActiveModel(m); }, this.debugger);
    this.modelSliders = new ModelSlidersUI(this.debugger);

    this.enginePanel = new EnginePanelUI({
      get: () => (this.instanced ? { ...this.instanced.params } : cloneDefaults()),
      set: (patch) => { if (this.instanced) this.instanced.setParams(patch); },
      setIgnition: (on) => { if (this.instanced) this.instanced.setIgnition(on); },
      getIgnition: () => (this.instanced ? !!this.instanced.params.enginesOn : false),
      onPanelOpen:  () => { this.controlsPaused = true; this.controls.setPaused(true); },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); },
      placeFlame: () => -1, setMoveMode: (_on) => {}, selectFixed: (_i) => false, getFixedList: () => [], copyFixedJSON: () => '[]',
    }, this.debugger);
  }

  loadStaticModels() {
    worldObjects.forEach(obj => {
      loadModel(obj.path, (model) => {
        model.position.set(obj.position.x, obj.position.y, obj.position.z);
        model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
        model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);

        if (obj.name === 'SuperHeavy') {
          this.rocketModel = model;
          this.launchGroup.add(model); // attach to launch group

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
          this.debugger?.log('Rocket + flames loaded into launch group.');
        } else {
          this.scene.add(model);
        }
      });
    });
  }

  /* ---------- Launch logic ---------- */
  updateLaunch(dt, t) {
    if (!this.instanced || !this.rocketModel || this.launch.finished) return;
    const enginesOn = !!this.instanced.params.enginesOn;

    // detect ignition moment
    if (enginesOn && !this.launch.enginesWereOn && !this.launch.active) {
      this.launch.liftoffT0 = t + this.launch.liftoffDelay;
      this.launch.active = true;
      this.debugger?.log('Liftoff scheduled in 5s after flame ignition');
    }
    this.launch.enginesWereOn = enginesOn;
    if (!this.launch.active) return;
    if (t < this.launch.liftoffT0) return;

    const ta = t - this.launch.liftoffT0;
    const s = THREE.MathUtils.clamp(ta / this.launch.duration, 0, 1);
    const ease = s * s * s; // cubic ease-in
    const altitude = ease * this.launch.maxAltitude;
    const tilt = THREE.MathUtils.degToRad(this.launch.maxTiltDeg) * s;

    this.launchGroup.position.y = altitude;
    this.launchGroup.rotation.x = tilt * 0.3;
    this.launchGroup.rotation.z = tilt;

    if (s >= 1) {
      this.launch.finished = true;
      this.launchGroup.visible = false;
      this.instanced.setIgnition(false);
      this.debugger?.log('Rocket cleared sky — hidden.');
    }
  }

  /* ---------- Main loop ---------- */
  start(){ this.animate(); }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt = this.clock.getDelta(), t = this.clock.elapsedTime;
    if (dt>0) this.updatePlayer(dt);
    this.updateLaunch(dt, t);
    for (const fx of this.effects) fx.update?.(dt, t, this.camera);
    if (this.highlighter?.update) this.highlighter.update(dt);
    this.renderer.render(this.scene,this.camera);
    this.frameCount++;
  }

  /* ---------- Player movement ---------- */
  updatePlayer(deltaTime){
    if (this.controlsPaused) return;
    const moveSpeed = 5.0 * deltaTime;
    const mv = this.controls.moveVector, lv = this.controls.lookVector;
    if (lv.length() > 0) {
      this.camera.rotation.y -= lv.x * this.lookSpeed;
      this.camera.rotation.x -= lv.y * this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
      this.controls.lookVector.set(0, 0);
    }
    this.playerVelocity.z = mv.y * moveSpeed;
    this.playerVelocity.x = mv.x * moveSpeed;
    this.camera.translateX(this.playerVelocity.x);
    this.camera.translateZ(this.playerVelocity.z);

    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);
    const meshes=[]; this.terrain.traverse(o=>{ if(o.isMesh) meshes.push(o); });
    const hits=this.raycaster.intersectObjects(meshes,true);
    if (hits.length>0) this.camera.position.y = hits[0].point.y + this.playerHeight;
  }

  onWindowResize(){
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  initPerformanceMonitor(){
    setInterval(()=>{
      if (this.frameCount>0 && this.frameCount<30)
        this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`,'Performance');
      this.frameCount=0;
    },1000);
  }
}