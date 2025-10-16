// src/Main.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Debugger } from '../Debugger.js';
import { Scene } from './scene/Scene.js';
import { CameraRig } from './Camera.js';
import { GamepadController } from './controls/GamePad.js';

export class Main {
  constructor(loader) {
    this.loader = loader;
    this.clock = new THREE.Clock();
    
    // Core components are initialized but not started
    this.renderer = this.setupRenderer();
    this.cameraRig = new CameraRig();
    this.controller = new GamepadController(this.cameraRig);

    // Setup Loading Manager to bridge Three.js loading with our UI loader
    this.loadingManager = new THREE.LoadingManager();
    this.setupLoadingManager();

    // Scene setup depends on the loading manager
    this.scene = new Scene(this.loadingManager);
  }

  setupRenderer() {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      canvas: document.querySelector('#app canvas') // Attach to a canvas if it exists
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    document.getElementById('app').appendChild(renderer.domElement);
    this.onResize = () => {
        const { innerWidth: w, innerHeight: h } = window;
        this.cameraRig.updateAspectRatio(w / h);
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.onResize);
    this.onResize(); // Initial call
    return renderer;
  }
  
  setupLoadingManager() {
    this.loadingManager.onProgress = (url, loaded, total) => {
      const progress = loaded / total;
      this.loader.updateProgress(progress);
      this.loader.updateStatus(`Loading asset: ${url.split('/').pop()}`);
    };
    
    this.loadingManager.onLoad = () => {
      this.loader.showStartButton();
    };

    this.loadingManager.onError = (url) => {
      Debugger.report(`Failed to load a critical asset: ${url}`, 'Asset Loader');
    };
  }

  start() {
    this.controller.connect(); // Activate controls
    this.onResize(); // Ensure size is correct
    this.animate(); // Start the render loop
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const deltaTime = this.clock.getDelta();
    this.controller.update(deltaTime);
    this.renderer.render(this.scene, this.cameraRig.camera);
  }
}
