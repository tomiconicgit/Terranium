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

// Effects
import { EngineFX } from './effects/EngineFX.js';

export class Main {
  constructor(debuggerInstance) {
    this.debugger = debuggerInstance;
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();

    this.effects = [];
    this.fx = null; // reference to SuperHeavy FX

    this.init();
  }

  static getManifest() {
    return [
      { name: 'Debugger Systems', path: './Debugger.js' },
      { name: 'Core Engine (Three.js)', path: 'three.module.js' },
      { name: 'GLTF & Draco Loaders', path: 'three.js examples' },
      { name: 'UI Systems', path: './ui/' },
      { name: 'World Terrain', path: './scene/Terrain.js' },
      { name: 'Atmosphere & Sky', path: './scene/SkyDome.js' },
      { name: 'Lighting Engine', path: './scene/Lighting.js' },
      { name: 'Player Camera', path: './scene/Camera.js' },
      { name: 'Control Systems', path: './controls/TouchPad.js' },
      { name: 'Engine FX', path: './effects/EngineFX.js' },
      { name: 'Engine Panel', path: './ui/EnginePanel.js' },
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
    this.playerVelocity = new THREE.Vector3();
    this.lookSpeed = 0.004;
    this.playerHeight = 2.0;
    this.raycaster = new THREE.Raycaster();
    this.rayDirection = new THREE.Vector3(0, -1, 0);

    this.initModelSystems();
    this.loadStaticModels();

    window.addEventListener('resize', () => this.onWindowResize(), false);
    this.initPerformanceMonitor();
  }

  initModelSystems() {
    // Make sure UI container exists
    this.importModelUI = new ImportModelUI(this.scene, (model) => {
      this.modelSliders.setActiveModel(model);
    }, this.debugger);

    this.modelSliders = new ModelSlidersUI(this.debugger);

    // Engine Panel (uses live API into EngineFX once available)
    this.enginePanel = new EnginePanelUI({
      get: () => (this.fx ? this.fx.getParams() : {
        enginesOn: false,
        flameWidthFactor: 1, flameHeightFactor: 1,
        flameYOffset: 0, smokeSizeFactor: 1, smokeYOffset: 0
      }),
      set: (patch) => { if (this.fx) this.fx.setParams(patch); },
      setIgnition: (on) => { if (this.fx) this.fx.setIgnition(on); },
      getIgnition: () => (this.fx ? this.fx.getIgnition() : false)
    }, this.debugger);
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
            this.fx = new EngineFX(model, this.scene, this.camera, { rings: '33' });
            this.effects.push(this.fx);
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
    const deltaTime = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    if (deltaTime > 0) this.updatePlayer(deltaTime);
    for (const fx of this.effects) fx.update(deltaTime, elapsed);

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