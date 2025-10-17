// src/Main.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// Scene bits
import { createTerrain }    from './scene/Terrain.js';
import { createSkyDome }    from './scene/SkyDome.js';
import { createLighting }   from './scene/Lighting.js';
import { createCamera }     from './scene/Camera.js';

// Controls + UI
import { TouchPad }         from './controls/TouchPad.js';
import { ImportModelUI }    from './ui/ImportModel.js';
import { ModelSlidersUI }   from './ui/ModelSliders.js';
import { EnginePanelUI }    from './ui/EnginePanel.js';
import { HighlighterUI }    from './ui/Highlighter.js';

// Assets + FX
import { worldObjects }     from './world/Mapping.js';
import { loadModel }        from './ModelLoading.js';
import { EngineFX }         from './effects/EngineFX.js';

// (Optional) Simple dig-out pass. If you’re not using it, you can remove these two lines.
import { applySimpleExcavation } from './scene/Excavation.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;

    // DOM / renderer
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Core three.js
    this.scene  = new THREE.Scene();
    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const { ambientLight, sunLight } = createLighting();
    this.scene.add(ambientLight, sunLight, sunLight.target);

    // Terrain + sky
    this.terrain = createTerrain();
    this.scene.add(this.terrain, createSkyDome());

    // Controls
    this.controls       = new TouchPad();
    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed      = 0.004;
    this.playerHeight   = 2.0;

    // Raycast for ground-follow
    this.raycaster   = new THREE.Raycaster();
    this.rayDown     = new THREE.Vector3(0, -1, 0);

    // Effects
    this.effects = [];
    this.fx      = null;

    // Clock
    this.clock = new THREE.Clock();

    // UI systems
    this.initModelSystems();
    this.loadStaticModels();

    // Optional: apply a dig-out selection if provided on window (keeps Main.js short)
    // Example: window.EXCAVATION_SELECTION = { tileSize: 1, tiles: [{i:0,j:0},{i:1,j:0}, ...] }
    if (window.EXCAVATION_SELECTION) {
      try {
        applySimpleExcavation({
          scene: this.scene,
          terrainRoot: this.terrain,
          selection: window.EXCAVATION_SELECTION,
          depth: -15,
          ring: 1
        });
        this.debugger?.log('Excavation applied.');
      } catch (e) {
        this.debugger?.handleError(e, 'Excavation');
      }
    }

    // Highlighter tool (tile picking & JSON copy UX)
    try {
      this.highlighter = new HighlighterUI(this.scene, this.camera, this.terrain, this.debugger);
    } catch (e) {
      this.debugger?.handleError(e, 'HighlighterInit');
    }

    // Events & perf monitor
    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();

    // Go!
    this.start();
  }

  static getManifest() {
    return [
      { name: 'Debugger Systems',         path: './Debugger.js' },
      { name: 'Core Engine (Three.js)',   path: 'three.module.js' },
      { name: 'UI Systems',               path: './ui/' },
      { name: 'World Terrain',            path: './scene/Terrain.js' },
      { name: 'Atmosphere & Sky',         path: './scene/SkyDome.js' },
      { name: 'Lighting Engine',          path: './scene/Lighting.js' },
      { name: 'Player Camera',            path: './scene/Camera.js' },
      { name: 'Control Systems',          path: './controls/TouchPad.js' },
      { name: 'Engine FX (Jet)',          path: './effects/EngineFX.js' },
      { name: 'Highlighter Tool',         path: './ui/Highlighter.js' },
      { name: 'Engine Panel',             path: './ui/EnginePanel.js' },
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

    // Engine panel binds into EngineFX once SuperHeavy model is loaded
    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : this.defaultFXParams()),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => { if (this.fx) this.fx.setIgnition(on); },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false)
    }, this.debugger);
  }

  defaultFXParams() {
    // Your requested defaults, but ignition OFF by default.
    return {
      enginesOn: false,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,
      intensity: 1.0,
      taper: 0.2,
      bulge: 1.0,
      tear: 1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2,
      diamondsStrength: 0.9,
      diamondsFreq: 2.8,
      rimStrength: 0.0,
      rimSpeed: 4.1,
      colorCyan: 0.4,
      colorOrange: 3.0,
      colorWhite: 1.0,
      groupOffsetX: 3.1,
      groupOffsetY: -3.0,
      groupOffsetZ: 1.2
    };
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

          // Attach EngineFX to SuperHeavy when it appears
          if (obj.name === 'SuperHeavy') {
            this.fx = new EngineFX(model, this.scene, this.camera);

            // Apply your defaults & ensure ignition is OFF
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

    // tick effects
    for (const fx of this.effects) fx.update(dt, t);

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

    // Ground follow against terrain meshes (platform + sand planes)
    const rayOrigin = new THREE.Vector3(this.camera.position.x, 80, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDown);

    const terrainMeshes = this.terrain.children.filter(
      c => c.name === 'sand_terrain' || c.geometry?.type === 'PlaneGeometry'
    );
    const hits = this.raycaster.intersectObjects(terrainMeshes);
    if (hits.length > 0) {
      this.camera.position.y = hits[0].point.y + this.playerHeight;
    }
  }

  // ---------- Perf / window ----------
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  initPerformanceMonitor() {
    this.frameCount = 0;
    setInterval(() => {
      if (this.frameCount > 0 && this.frameCount < 30) {
        this.debugger?.warn(`Low framerate detected: ${this.frameCount} FPS`, 'Performance');
      }
      this.frameCount = 0;
    }, 1000);
  }
}