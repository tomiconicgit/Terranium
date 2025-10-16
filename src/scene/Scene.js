// src/scene/Scene.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createLighting } from './Lighting.js';
import { createSkyDome } from './SkyDome.js';
import { createTerrain } from './Terrain.js';
import { Debugger } from '../../Debugger.js';

export class Scene extends THREE.Scene {
  constructor(manager) {
    super();
    this.background = new THREE.Color(0x1d2430);
    this.fog = new THREE.Fog(0x8894ab, 150, 1500);

    createLighting(this);
    this.add(createSkyDome());
    this.add(createTerrain());
    
    this.loadModels(manager);
  }

  loadModels(manager) {
    const gltfLoader = new GLTFLoader(manager);
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    const modelPath = './assets/SuperHeavy.glb';
    gltfLoader.load(modelPath, 
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(0.13);
        model.position.set(0, 5, 0);
        model.traverse(node => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        this.add(model);
      },
      undefined,
      (error) => {
        Debugger.report(error, `Loading ${modelPath}`);
      }
    );
  }
}
