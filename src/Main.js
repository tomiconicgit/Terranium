// src/Main.js
// App bootstrap. No terrain generation lives here — handled entirely by src/scene/Terrain.js.

import * as THREE from 'three';
import { createTerrain } from './scene/Terrain.js';

// Optional UI helper (if you have it). It should accept an options object.
import { HighlighterUI } from './ui/HighlighterUI.js'; // safe to remove if not used

class MainApp {
  constructor() {
    // --- renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // --- scene ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d21);

    // --- camera ---
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(20, 28, 26);
    this.camera.lookAt(0, 0, 0);

    // --- lights ---
    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.7);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(30, 50, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const d = 120;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    dir.shadow.camera.far = 200;
    this.scene.add(dir);

    // --- terrain (delegated to Terrain.js) ---
    this.terrain = createTerrain(); // uses window.EXCAVATION_SELECTION if present
    this.scene.add(this.terrain);

    // --- simple sky dome (visual only, not terrain logic) ---
    this.scene.add(this.createSkyDome());

    // --- controls (very lightweight manual orbit) ---
    this._orbit = {
      target: new THREE.Vector3(0, 0, 0),
      phi: 0.9, // vertical angle
      theta: 0.7, // horizontal angle
      radius: 60
    };
    this.attachMouseControls();

    // --- optional: tile highlighter UI ---
    try {
      if (HighlighterUI) {
        this.highlighter = new HighlighterUI({
          scene: this.scene,
          camera: this.camera,
          terrainGroup: this.terrain,
          renderer: this.renderer
        });
      }
    } catch (e) {
      // no-op if you don't have the UI module
      console.warn('HighlighterUI not initialized:', e);
    }

    // --- resize ---
    window.addEventListener('resize', () => this.onResize());

    // --- go! ---
    this.clock = new THREE.Clock();
    this.animate();
  }

  createSkyDome() {
    // very cheap gradient dome to keep focus on the terrain
    const geo = new THREE.SphereGeometry(500, 24, 16);
    geo.scale(1, 1, -1); // invert normals

    const top = new THREE.Color(0x6688cc);
    const bottom = new THREE.Color(0x0d0f12);

    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = geo.attributes.position.getY(i);
      const t = THREE.MathUtils.clamp((y + 500) / 1000, 0, 1);
      const c = bottom.clone().lerp(top, t);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
    const dome = new THREE.Mesh(geo, mat);
    dome.name = 'sky_dome';
    return dome;
  }

  attachMouseControls() {
    const dom = this.renderer.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    dom.addEventListener('mousedown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => (dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      this._orbit.theta -= dx * 0.005;
      this._orbit.phi = THREE.MathUtils.clamp(this._orbit.phi - dy * 0.005, 0.1, Math.PI / 2.1);
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const s = Math.exp(-e.deltaY * 0.0015);
      this._orbit.radius = THREE.MathUtils.clamp(this._orbit.radius * s, 10, 200);
    }, { passive: false });
  }

  updateCameraOrbit() {
    const { target, phi, theta, radius } = this._orbit;
    const x = target.x + radius * Math.sin(phi) * Math.cos(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.sin(theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(target);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();

    // per-frame updates
    this.updateCameraOrbit();

    // optional helper UI update
    if (this.highlighter?.update) this.highlighter.update(dt);

    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  // You can expose a selection before boot to override the default in Terrain.js:
  // window.EXCAVATION_SELECTION = { tileSize: 1, tiles: [ {i:0,j:0,y:0}, ... ] };
  new MainApp();
});