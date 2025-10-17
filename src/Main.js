// src/Main.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// Game components
import { createTerrain } from './scene/Terrain.js';
import { createSkyDome } from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera } from './scene/Camera.js';
import { TouchPad } from './controls/TouchPad.js';

// Models & UI
import { worldObjects } from './world/Mapping.js';
import { loadModel } from './ModelLoading.js';
import { ImportModelUI } from './ui/ImportModel.js';
import { ModelSlidersUI } from './ui/ModelSliders.js';
import { EnginePanelUI } from './ui/EnginePanel.js';
import { HighlighterUI } from './ui/Highlighter.js';

// Effects
import { EngineFX } from './effects/EngineFX.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.effects = [];
    this.fx = null;

    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;
    this.raycaster = new THREE.Raycaster();
    this.rayDirection = new THREE.Vector3(0, -1, 0);

    this.init();
  }

  static getManifest() {
    return [
      { name: 'Debugger Systems', path: './Debugger.js' },
      { name: 'Core Engine (Three.js)', path: 'three.module.js' },
      { name: 'UI Systems', path: './ui/' },
      { name: 'World Terrain', path: './scene/Terrain.js' },
      { name: 'Atmosphere & Sky', path: './scene/SkyDome.js' },
      { name: 'Lighting Engine', path: './scene/Lighting.js' },
      { name: 'Player Camera', path: './scene/Camera.js' },
      { name: 'Control Systems', path: './controls/TouchPad.js' },
      { name: 'Engine FX (Jet)', path: './effects/EngineFX.js' },
      { name: 'Engine Panel', path: './ui/EnginePanel.js' },
      { name: 'Highlighter Tool', path: './ui/Highlighter.js' },
      { name: 'Finalizing...', path: '...' },
    ];
  }

  init() {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.camera = createCamera();
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const { ambientLight, sunLight } = createLighting();
    this.scene.add(ambientLight, sunLight, sunLight.target);

    this.terrain = createTerrain();
    this.scene.add(this.terrain, createSkyDome());

    this.controls = new TouchPad();

    this.initModelSystems();
    this.loadStaticModels();

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
  }

  initModelSystems() {
    // Creates #ui-container
    this.importModelUI = new ImportModelUI(this.scene, (model) => {
      this.modelSliders.setActiveModel(model);
    }, this.debugger);

    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Your default FX params (enginesOff)
    const defaultFX = {
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

    // Engine panel (seeds with defaults until FX attaches)
    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : { ...defaultFX }),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => { if (this.fx) this.fx.setIgnition(on); },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : defaultFX.enginesOn)
    }, this.debugger);

    // Highlighter tool (button next to Engine button)
    this.highlighter = new HighlighterUI({
      scene: this.scene,
      camera: this.camera,
      terrainGroup: this.terrain,
      debugger: this.debugger,
    });
  }

  loadStaticModels() {
    this.debugger.log(`Loading ${worldObjects.length} static models from Mapping.js...`);
    worldObjects.forEach(obj => {
      loadModel(
        obj.path,
        (model) => {
          model.position.set(obj.position.x, obj.position.y, obj.position.z);
          model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
          model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
          this.scene.add(model);
          this.debugger.log(`Loaded static model: ${obj.name}`);

          if (obj.name === 'SuperHeavy') {
            this.fx = new EngineFX(model, this.scene, this.camera);
            this.effects.push(this.fx);

            // Apply your defaults (already enginesOff)
            this.fx.setParams({
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
            });
            this.fx.setIgnition(false);

            this.enginePanel.setReady(true);
          }
        },
        (error) => {
          this.debugger.handleError(error, `StaticModel: ${obj.name}`);
        }
      );
    });
  }

  start() { this.animate(); }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updatePlayer(deltaTime) {
    const moveSpeed = 5.0 * deltaTime;
    const moveVector = this.controls.moveVector;
    const lookVector = this.controls.lookVector;

    if (lookVector.length() > 0) {
      this.camera.rotation.y -= lookVector.x * this.lookSpeed;
      this.camera.rotation.x -= lookVector.y * this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
      this.controls.lookVector.set(0, 0);
    }

    this.playerVelocity.z = moveVector.y * moveSpeed;
    this.playerVelocity.x = moveVector.x * moveSpeed;
    this.camera.translateX(this.playerVelocity.x);
    this.camera.translateZ(this.playerVelocity.z);

    const rayOrigin = new THREE.Vector3(this.camera.position.x, 50, this.camera.position.z);
    this.raycaster.set(rayOrigin, this.rayDirection);
    const terrainMeshes = this.terrain.children.filter(c => c.name === "sand_terrain" || c.geometry?.type === "PlaneGeometry");
    const intersects = this.raycaster.intersectObjects(terrainMeshes);
    if (intersects.length > 0) {
      this.camera.position.y = intersects[0].point.y + this.playerHeight;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    const t  = this.clock.elapsedTime;

    if (dt > 0) this.updatePlayer(dt);
    for (const fx of this.effects) fx.update(dt, t);
    this.highlighter?.update(); // <- update highlighter hover

    this.renderer.render(this.scene, this.camera);
    this.frameCount++;
  }

  initPerformanceMonitor() {
    this.frameCount = 0;
    setInterval(() => {
      if (this.frameCount > 0 && this.frameCount < 30) {
        this.debugger.warn(`Low framerate detected: ${this.frameCount} FPS`, 'Performance');
      }
      this.frameCount = 0;
    }, 1000);
  }
}