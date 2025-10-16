// src/scene/Scene.js
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Lighting and Sky
    this.add(new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75));
    const sunLight = new THREE.DirectionalLight(0xfff9e8, 1.5);
    sunLight.position.set(1, 1, 1);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0005;
    this.sunLight = sunLight;
    this.add(sunLight);

    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    this.add(this.sky);

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
    const terrainSegments = 200;
    const launchpadSize = 50;

    // 1. Create the main grassy terrain with hills
    const grassGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const positions = grassGeo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i); // This is Z in world space after rotation
        
        // Only apply hills outside the launchpad area
        if (Math.abs(x) > launchpadSize / 2 || Math.abs(y) > launchpadSize / 2) {
            const z1 = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 8.0;
            const z2 = Math.sin(x * 0.01) * Math.sin(y * 0.015) * 12.0;
            const z3 = Math.cos((x + y) * 0.005) * 5.0;
            positions.setZ(i, z1 + z2 + z3);
        }
    }
    grassGeo.computeVertexNormals();
    
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(50, 50);

    const grassMat = new THREE.MeshStandardMaterial({
        map: grassTexture,
        roughness: 0.8,
        metalness: 0.1
    });

    const grassTerrain = new THREE.Mesh(grassGeo, grassMat);
    grassTerrain.rotation.x = -Math.PI / 2;
    grassTerrain.receiveShadow = true;
    grassTerrain.name = 'terrain';
    this.add(grassTerrain);

    // 2. Create the flat concrete launchpad on top
    const concreteGeo = new THREE.PlaneGeometry(launchpadSize, launchpadSize);
    const concreteTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/rockground.jpg');
    concreteTexture.wrapS = concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(10, 10);
    
    const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTexture });

    const launchpad = new THREE.Mesh(concreteGeo, concreteMat);
    launchpad.rotation.x = -Math.PI / 2;
    launchpad.position.y = 0.05; // Place slightly above grass to prevent visual glitches
    launchpad.receiveShadow = true;
    this.add(launchpad);
  }

  _loadBakedModels() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    // --- CORRECTED LOCAL FILE PATH ---
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
    undefined, // onProgress callback not needed here
    (error) => {
        console.error('An error happened while loading the baked model:', error);
        // You could add an on-screen error message here if you wanted
    });
  }

  updateSky(elevation) {
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(180);
      this.sun.setFromSphericalCoords(1, phi, theta);

      this.sky.material.uniforms['sunPosition'].value.copy(this.sun);
      this.sunLight.position.copy(this.sun).multiplyScalar(100);
      
      this.background = new THREE.Color().setHSL(0.58, 0.4, 0.8 - (elevation/180));
      if(this.fog) this.fog.color.copy(this.background);
  }

  update(renderer, camera) {
    // Future animations can go here
  }
}


