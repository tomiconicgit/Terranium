// src/scene/Scene.js
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Lighting
    this.add(new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75));
    const sunLight = new THREE.DirectionalLight(0xfff9e8, 1.5);
    sunLight.position.set(1, 1, 1); // Will be updated by sky
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0005;
    this.sunLight = sunLight;
    this.add(sunLight);

    // Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    this.add(this.sky);

    this.sun = new THREE.Vector3();
    this.updateSky(115); // Initial sun angle

    this.fog = new THREE.Fog(0x7c8bab, 100, 800);

    // Terrain
    const terrainSize = 1000;
    const terrainSegments = 200;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    
    // Procedurally generate hills
    const positions = terrainGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        
        // Use a combination of sine waves for a natural, rolling look
        const z1 = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 8.0;
        const z2 = Math.sin(x * 0.01) * Math.sin(y * 0.015) * 12.0;
        const z3 = Math.cos((x + y) * 0.005) * 5.0;
        
        positions.setZ(i, z1 + z2 + z3);
    }
    terrainGeo.computeVertexNormals();
    
    // Grass Texture
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(25, 25);
    
    const terrainMat = new THREE.MeshStandardMaterial({
        map: grassTexture,
        roughness: 0.8,
        metalness: 0.1
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain'; // Name it so we can find it for raycasting
    this.add(terrain);
  }

  updateSky(elevation) {
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(180); // Azimuth
      this.sun.setFromSphericalCoords(1, phi, theta);

      this.sky.material.uniforms['sunPosition'].value.copy(this.sun);
      this.sunLight.position.copy(this.sun).multiplyScalar(100);

      // Update background and fog to match sky
      const topColor = new THREE.Color().setFromVector3(this.sky.material.uniforms['up'].value);
      this.background = topColor;
      if(this.fog) this.fog.color.copy(topColor);
  }

  update(renderer, camera) {
    // This could be used to animate the sun over time, for example.
  }
}

