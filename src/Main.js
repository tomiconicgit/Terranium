// src/Main.js
// Boots the app. Terrain generation lives ONLY in src/scene/Terrain.js.

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
    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed      = 0.004;
    this.playerHeight   = 2.0;

    this.raycaster = new THREE.Raycaster();
    this.rayDown   = new THREE.Vector3(0, -1, 0);

    this.effects = [];
    this.fx      = null; // the single editable flame

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

    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : this.defaultFXParams()),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => { if (this.fx) this.fx.setIgnition(on); },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false)
    }, this.debugger);
  }

  // ----- CURRENT DEFAULTS (your latest) -----
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

      tailFadeStart: 0.3,
      tailFeather: 4.0,
      tailNoise: 0.2,

      orangeShift: -0.2,
      lightIntensity: 50.0,
      lightDistance: 800.0,
      lightColor: '#ffb869'
    };
  }

  // Helper: create a baked (fixed) flame instance
  _spawnBakedFlame(rocket, offX, offY, offZ) {
    const p = this.defaultFXParams();
    const fx = new EngineFX(rocket, this.scene, this.camera);
    fx.setParams({
      ...p,
      groupOffsetX: offX,
      groupOffsetY: offY,
      groupOffsetZ: offZ
    });
    // ignite immediately; mute so multiple flames don't layer audio
    try { fx.audio?.setVolume(0.0); } catch {}
    fx.setIgnition(true);
    this.effects.push(fx);
    return fx;
  }

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
          this.debugger?.log(`Loaded static model: ${obj.name}`);

          if (obj.name === 'SuperHeavy') {
            const base = this.defaultFXParams();

            // --------- 5 BAKED FLAMES ----------
            // 1) the existing baked (base offsets)
            this._spawnBakedFlame(model, base.groupOffsetX, base.groupOffsetY, base.groupOffsetZ);
            // 2–5) your requested extra coordinates (X, Y) using same Z
            this._spawnBakedFlame(model,  9.3,   0.5, base.groupOffsetZ);
            this._spawnBakedFlame(model, 11.6,   6.0, base.groupOffsetZ);
            this._spawnBakedFlame(model, 10.0,  12.5, base.groupOffsetZ);
            this._spawnBakedFlame(model, 14.2,  14.0, base.groupOffsetZ);

            // --------- 6th EDITABLE FLAME ----------
            this.fx = new EngineFX(model, this.scene, this.camera);
            this.fx.setParams(base);      // start from same defaults
            this.fx.setIgnition(false);   // wait for user via panel
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