// src/scene/Scene.js
import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class Scene extends THREE.Scene {
  constructor(manager) {
    super();

    this.background = new THREE.Color(0x1d2430); 
    
    this.add(new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75));
    const sunLight = new THREE.DirectionalLight(0xfff9e8, 1.5);
    sunLight.position.set(100, 100, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    this.sunLight = sunLight;
    this.add(sunLight);
    
    const skyDome = createSkyDome();
    this.add(skyDome);
    
    this.sun = new THREE.Vector3();
    this.fog = new THREE.Fog(0x8894ab, 150, 1500);
    this.updateSky(75);
    
    this._createProceduralTerrain();
    
    // The line below is now commented out to prevent the model from loading.
    // this._loadBakedModels(manager); 
  }

  _createProceduralTerrain() {
    const plateauSize = 50;
    const worldSize = 250;
    const slopeHeight = 20;

    const geometry = new THREE.PlaneGeometry(worldSize, worldSize, 100, 100);
    const positionAttribute = geometry.getAttribute('position');

    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const z = positionAttribute.getZ(i);
        const isOutsidePlateau = Math.abs(x) > plateauSize / 2 || Math.abs(z) > plateauSize / 2;

        if (isOutsidePlateau) {
            const distX = Math.max(0, Math.abs(x) - plateauSize / 2);
            const distZ = Math.max(0, Math.abs(z) - plateauSize / 2);
            const distance = Math.sqrt(distX * distX + distZ * distZ);
            const slopeRun = (worldSize - plateauSize) / 2;
            const progress = Math.min(distance / slopeRun, 1.0);
            const smoothedProgress = progress * progress;
            positionAttribute.setY(i, -smoothedProgress * slopeHeight);
        }
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x6a6a6a,
        roughness: 0.9,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.add(terrain);
  }

  _loadBakedModels(manager) {
    const gltfLoader = new GLTFLoader(manager);
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const modelPath = './assets/SuperHeavy.glb'; 
    const modelData = {
      scale: 0.13,
      position: { x: 0, y: 5, z: 0 }
    };
    
    gltfLoader.load(modelPath, (gltf) => {
      const model = gltf.scene;
      
      model.scale.setScalar(modelData.scale);
      model.position.set(modelData.position.x, modelData.position.y, modelData.position.z);

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
        console.error('An error occurred loading the model:', error);
    });
  }

  updateSky(elevation) {
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(180);
      this.sun.setFromSphericalCoords(1, phi, theta);
      this.sunLight.position.copy(this.sun).multiplyScalar(100);
      const bgColor = new THREE.Color().setHSL(0.58, 0.4, 0.8 - (elevation/180));
      this.background = bgColor;
      if(this.fog) this.fog.color.copy(bgColor);
  }

  update(renderer, camera) {
    // Future animations can go here
  }
}
