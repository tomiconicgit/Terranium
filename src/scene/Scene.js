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
    sunLight.shadow.mapSize.width = 4096; // Increased shadow quality
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

    // Adjusted fog for a larger viewing distance
    this.fog = new THREE.Fog(0x8894ab, 150, 1500);

    // Terrain with Launchpad
    this._createTerrain();
    
    // Load the baked-in models
    this._loadBakedModels();
  }

  _createTerrain() {
    const terrainSize = 1000;
    const terrainSegments = 250;
    const launchpadSize = 25; // Half of the 50x50 area
    const transitionWidth = 10; // How wide the blend between concrete and grass is

    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const positions = terrainGeo.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i); // Corresponds to Z in world space after rotation

        // Procedural hills
        const z1 = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 8.0;
        const z2 = Math.sin(x * 0.01) * Math.sin(y * 0.015) * 12.0;
        const z3 = Math.cos((x + y) * 0.005) * 5.0;
        const hillHeight = z1 + z2 + z3;
        
        // Calculate blend factor for the launchpad
        const distFromCenter = Math.max(Math.abs(x), Math.abs(y));
        const blend = THREE.MathUtils.smoothstep(distFromCenter, launchpadSize, launchpadSize + transitionWidth);

        // Interpolate height and set vertex color for texture mixing
        positions.setZ(i, hillHeight * blend);
        colors.push(blend, 0, 0); // Use the red channel to store the blend factor
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    
    // Textures
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(50, 50);

    const concreteTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/rockground.jpg');
    concreteTexture.wrapS = concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(10, 10);

    // Material with custom shader logic
    const terrainMat = new THREE.MeshStandardMaterial({
        roughness: 0.8,
        metalness: 0.1,
        vertexColors: true,
    });

    terrainMat.onBeforeCompile = (shader) => {
        shader.uniforms.grassTexture = { value: grassTexture };
        shader.uniforms.concreteTexture = { value: concreteTexture };

        // Pass vertex color (our blend factor) to the fragment shader
        shader.vertexShader = 'varying vec3 vColor;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvColor = color;'
        );
        
        // In the fragment shader, mix the textures based on the blend factor
        shader.fragmentShader = 'uniform sampler2D grassTexture;\nuniform sampler2D concreteTexture;\nvarying vec3 vColor;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #ifdef USE_MAP
                float blend = vColor.r;
                vec4 grass = texture2D(grassTexture, vUv);
                vec4 concrete = texture2D(concreteTexture, vUv);
                vec4 blendedColor = mix(concrete, grass, blend);
                diffuseColor *= blendedColor;
            #endif
            `
        );
    };

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.add(terrain);
  }

  _loadBakedModels() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    // --- BAKE YOUR MODEL HERE ---
    // Replace the URL with your local 'assets/SuperHeavy.glb' path.
    // I'm using a placeholder URL so the demo runs.
    const modelPath = 'https://storage.googleapis.com/abern-portfolio-bucket/Starship-processed.glb';
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


