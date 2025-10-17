// src/Main.js — core app bootstrap

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// Scene bits
import { createTerrain }  from './scene/Terrain.js';
import { createSkyDome }  from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera }   from './scene/Camera.js';

// Controls + UI
import { TouchPad }       from './controls/TouchPad.js';
import { ImportModelUI }  from './ui/ImportModel.js';
import { ModelSlidersUI } from './ui/ModelSliders.js';
import { EnginePanelUI }  from './ui/EnginePanel.js';
import { HighlighterUI }  from './ui/Highlighter.js';

// Assets + FX
import { worldObjects }   from './world/Mapping.js';
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

    this.scene  = new THREE.Scene();
    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const { ambientLight, sunLight } = createLighting();
    this.scene.add(ambientLight, sunLight, sunLight.target);

    this.terrain = createTerrain({ selection: window.EXCAVATION_SELECTION || null });
    this.scene.add(this.terrain);
    this.scene.add(createSkyDome());

    this.controls       = new TouchPad();
    this.controlsPaused = false;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed      = 0.004;
    this.playerHeight   = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown   = new THREE.Vector3(0, -1, 0);

    this.effects   = [];
    this.fx        = null;     // editable flame
    this.fixedFX   = [];       // placed/baked candidates
    this.activeFixedIndex = -1;

    // Move-mode drag state (XZ drag)
    this.flameMoveMode = false;
    this._dragActive = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragBase  = { x: 0, z: 0 };
    this._bindMoveHandlers();

    this.clock = new THREE.Clock();
    this.frameCount = 0;

    this.initModelSystems();
    this.loadStaticModels();

    try {
      this.highlighter = new HighlighterUI({
        scene: this.scene,
        camera: this.camera,
        terrainGroup: this.terrain,
        debugger: this.debugger
      });
    } catch (e) {
      this.debugger?.handleError(e, 'HighlighterInit');
    }

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
    this.start();
  }

  static getManifest() {
    return [
      { name: 'Core Engine (Three.js)',   path: 'three.module.js' },
      { name: 'World Terrain',            path: './scene/Terrain.js' },
      { name: 'Atmosphere & Sky',         path: './scene/SkyDome.js' },
      { name: 'Lighting Engine',          path: './scene/Lighting.js' },
      { name: 'Player Camera',            path: './scene/Camera.js' },
      { name: 'Control Systems',          path: './controls/TouchPad.js' },
      { name: 'Highlighter Tool',         path: './ui/Highlighter.js' },
      { name: 'Engine Panel',             path: './ui/EnginePanel.js' },
      { name: 'Engine FX (Jet)',          path: './effects/EngineFX.js' },
      { name: 'Finalizing...',            path: '...' },
    ];
  }

  // ---------- UI systems ----------
  initModelSystems() {
    this.importModelUI = new ImportModelUI(
      this.scene,
      (model) => { this.modelSliders.setActiveModel(model); },
      this.debugger
    );

    this.modelSliders = new ModelSlidersUI(this.debugger);

    // API for EnginePanel
    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : this.defaultFXParams()),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },

      setIgnition: (on) => {
        if (this.fx) this.fx.setIgnition(on);
        for (const f of this.fixedFX) f.setIgnition(on);
      },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false),

      // panel lifecycle → pause/resume camera & look controls
      onPanelOpen: () => { this.controlsPaused = true; this.controls.setPaused(true); },
      onPanelClose: () => { this.controlsPaused = false; this.controls.setPaused(false); this.setMoveMode(false); },

      // placement & move
      placeFlame: () => this.placeFixedFlame(),
      setMoveMode: (on) => this.setMoveMode(on),
      selectFixed: (idx) => this.setActiveFixed(idx),

      // expose fixed list / copy
      getFixedList: () => this.getFixedList(),
      copyFixedJSON: () => JSON.stringify(this.getFixedList(), null, 2),
    }, this.debugger);
  }

  // ---------- Defaults (synced with EngineFX) ----------
  defaultFXParams() {
    return {
      enginesOn: true,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,

      intensity: 1.5,
      taper: 0.0,
      bulge: 1.0,
      tear: 1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2,
      diamondsStrength: 0.9,
      diamondsFreq: 2.8,

      rimStrength: 0.0,
      rimSpeed: 4.1,

      colorCyan: 0.5,
      colorOrange: 3.0,
      colorWhite: 0.9,

      groupOffsetX: 3.1,
      groupOffsetY: -3.0,
      groupOffsetZ: 1.2,

      // TOP/tail fade
      tailFadeStart: 0.3,
      tailFeather: 4.0,
      tailNoise: 0.2,

      // BOTTOM/nozzle fade
      bottomFadeDepth: 0.12,
      bottomFadeFeather: 0.80,

      orangeShift: -0.2,
      lightIntensity: 50.0,
      lightDistance: 800.0,
      lightColor: '#ffb869'
    };
  }

  // ---------- Fixed flame helpers ----------
  placeFixedFlame() {
    if (!this.fx || !this.rocketModel) return -1;
    const params = this.fx.getParams(); // snapshot current settings/offsets
    const f = new EngineFX(this.rocketModel, this.scene, this.camera);
    f.setParams(params);
    f.setIgnition(false); // start off; panel Ignite controls all
    this.fixedFX.push(f);
    this.effects.push(f);
    this.activeFixedIndex = this.fixedFX.length - 1;
    return this.activeFixedIndex;
  }

  setActiveFixed(idx) {
    if (idx >= 0 && idx < this.fixedFX.length) {
      this.activeFixedIndex = idx;
      return true;
    }
    this.activeFixedIndex = -1;
    return false;
  }

  getFixedList() {
    return this.fixedFX.map((f, i) => {
      const p = f.getParams();
      return {
        index: i,
        groupOffsetX: +p.groupOffsetX.toFixed(3),
        groupOffsetY: +p.groupOffsetY.toFixed(3),
        groupOffsetZ: +p.groupOffsetZ.toFixed(3)
      };
    });
  }

  setMoveMode(on) {
    this.flameMoveMode = !!on;
    if (this.flameMoveMode && this.activeFixedIndex === -1 && this.fixedFX.length > 0) {
      this.activeFixedIndex = this.fixedFX.length - 1;
    }
    if (!this.flameMoveMode) this._dragActive = false;
  }

  _bindMoveHandlers() {
    // Decide which flame is being moved: selected fixed OR the single editable.
    const getTargetFlame = () => {
      if (this.activeFixedIndex >= 0) return this.fixedFX[this.activeFixedIndex];
      return this.fx; // fallback to editable flame
    };

    const start = (x, y) => {
      if (!this.flameMoveMode) return;
      const target = getTargetFlame(); if (!target) return;
      this._dragActive = true;
      this._dragStart.x = x; this._dragStart.y = y;
      const p = target.getParams();
      this._dragBase.x = p.groupOffsetX;
      this._dragBase.z = p.groupOffsetZ;
    };

    const move = (x, y, e) => {
      if (!this._dragActive) return;
      if (e) e.preventDefault();
      const target = getTargetFlame(); if (!target) return;

      const dx = x - this._dragStart.x;
      const dy = y - this._dragStart.y;

      const SCALE = 0.03; // meters per pixel
      const nx = this._dragBase.x + dx * SCALE;
      const nz = this._dragBase.z + dy * SCALE; // swipe up -> +Z

      target.setParams({ groupOffsetX: nx, groupOffsetZ: nz });
    };

    const end = () => { this._dragActive = false; };

    // Pointer
    this.canvas.addEventListener('pointerdown', (e)=> start(e.clientX, e.clientY), { passive: true });
    this.canvas.addEventListener('pointermove', (e)=> move(e.clientX, e.clientY, e), { passive: false });
    window.addEventListener('pointerup', end, { passive: true });

    // Touch
    this.canvas.addEventListener('touchstart', (e)=>{
      const t = e.changedTouches[0]; if (!t) return; start(t.clientX, t.clientY);
    }, { passive: true });
    this.canvas.addEventListener('touchmove', (e)=>{
      const t = e.changedTouches[0]; if (!t) return; move(t.clientX, t.clientY, e);
    }, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
  }

  // ---------- Model loading ----------
  loadStaticModels() {
    this.debugger?.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj => {
      loadModel(
        obj.path,
        (model) => {
          model.position.set(obj.position.x, obj.position.y, obj.position.z);
          model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
          model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
          this.scene.add(model);
          this.rocketModel = model;
          this.debugger?.log(`Loaded static model: ${obj.name}`);

          if (obj.name === 'SuperHeavy') {
            // One EDITABLE flame (starts OFF)
            this.fx = new EngineFX(model, this.scene, this.camera);
            this.fx.setParams(this.defaultFXParams());
            this.fx.setIgnition(false);
            this.effects.push(this.fx);

            this.enginePanel.setReady(true);
          }
        },
        (error) => {
          this.debugger?.handleError(error, `StaticModel: ${obj.name}`);
        }
      );
    });
  }

  // ---------- Game loop ----------
  start() { this.animate(); }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    const t  = this.clock.elapsedTime;

    if (dt > 0) this.updatePlayer(dt);

    for (const fx of this.effects) fx.update(dt, t);

    if (this.highlighter?.update) this.highlighter.update(dt);

    this.renderer.render(this.scene, this.camera);
    this.frameCount++;
  }

  // ---------- Movement & ground follow ----------
  updatePlayer(deltaTime) {
    if (this.controlsPaused) return; // panel open → pause camera movement

    const moveSpeed   = 5.0 * deltaTime;
    const moveVector  = this.controls.moveVector;
    const lookVector  = this.controls.lookVector;

    if (lookVector.length() > 0) {
      this.camera.rotation.y -= lookVector.x * this.lookSpeed;
      this.camera.rotation.x -= lookVector.y * this.lookSpeed;
      this.camera.rotation.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
      this.controls.lookVector.set(0, 0);
    }

    this.playerVelocity.z = moveVector.y * moveSpeed;
    this.playerVelocity.x = moveVector.x * moveSpeed;

    this.camera.translateX(this.playerVelocity.x);
    this.camera.translateZ(this.playerVelocity.z);

    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);

    // hit anything inside terrain_root
    const terrainMeshes = [];
    this.terrain.traverse(o => { if (o.isMesh) terrainMeshes.push(o); });
    const hits = this.raycaster.intersectObjects(terrainMeshes, true);
    if (hits.length > 0) {
      this.camera.position.y = hits[0].point.y + this.playerHeight;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  initPerformanceMonitor() {
    setInterval(() => {
      if (this.frameCount > 0 && this.frameCount < 30) {
        this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`, 'Performance');
      }
      this.frameCount = 0;
    }, 1000);
  }
}