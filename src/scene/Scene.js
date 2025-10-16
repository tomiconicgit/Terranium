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
    // Use the sky's horizon color for a seamless blend with fog
    const horizonColor = 0xF0F8FF;
    this.background = new THREE.Color(horizonColor); 
    this.fog = new THREE.Fog(horizonColor, 150, 1200);

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
