// src/scene/Scene.js
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Set a fallback background color immediately. If you see this, other things failed.
    this.background = new THREE.Color(0x1d2430); 

    // Lighting and Sky
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

    const sky = new Sky();
    sky.scale.setScalar(1000);
    this.add(sky);
    this.sky = sky;

    this.sun = new THREE.Vector3();
    this.updateSky(75); // Sun is higher in the sky

    this.fog = new THREE.Fog(0x8894ab, 150, 1500);

    // Create the world terrain
    this._createTerrain();
    
    // Load your baked-in model
    this._loadBakedModels();
  }

  _createTerrain() {
    const terrainSize = 1000;
    const launchpadRadius = 25; // A 50x50 area

    // 1. Create the main grassy terrain (it's completely flat under the launchpad)
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(50, 50);

    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
    const terrainMat = new THREE.MeshStandardMaterial({ map: grassTexture });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.add(terrain);

    // 2. Create a separate, flat concrete circle for the launchpad on top
    const concreteTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/rockground.jpg');
    concreteTexture.wrapS = concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(8, 8);

    const launchpadGeo = new THREE.CircleGeometry(launchpadRadius, 64);
    const launchpadMat = new THREE.MeshStandardMaterial({ map: concreteTexture });
    const launchpad = new THREE.Mesh(launchpadGeo, launchpadMat);
    launchpad.rotation.x = -Math.PI / 2;
    launchpad.position.y = 0.01; // Place slightly above grass to prevent visual glitches
    launchpad.receiveShadow = true;
    this.add(launchpad);
  }

  _loadBakedModels() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    // --- Loading your local model ---
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
        console.error('MODEL LOADING FAILED:', error);
        alert('Could not load the SuperHeavy.glb model. Check the console (F12) for details.');
    });
  }

  updateSky(elevation) {
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(180);
      this.sun.setFromSphericalCoords(1, phi, theta);

      this.sky.material.uniforms['sunPosition'].value.copy(this.sun);
      this.sunLight.position.copy(this.sun).multiplyScalar(100);
      
      const bgColor = new THREE.Color().setHSL(0.58, 0.4, 0.8 - (elevation/180));
      this.background = bgColor;
      if(this.fog) this.fog.color.copy(bgColor);
  }

  update(renderer, camera) {
    // Future animations can go here
  }
}
