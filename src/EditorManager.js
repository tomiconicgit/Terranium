// src/EditorManager.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { loadModel, loadFBXModel } from './ModelLoading.js';

export class EditorManager {
  constructor(mainApp) {
    this.main = mainApp; // Reference to Main.js class
    this.scene = mainApp.scene;
    this.camera = mainApp.camera;
    this.renderer = mainApp.renderer;
    
    this.state = 'EDITOR'; // 'EDITOR' or 'GAME'
    this.selectedObject = null;

    // --- Get New UI Elements ---
    this.appContainer = document.getElementById('app-container');
    this.playButton = document.getElementById('btn-play');
    this.endTestButton = document.getElementById('btn-end-test');
    this.toolbar = document.getElementById('editor-toolbar');

    // Tab UI
    this.tabBar = document.querySelector('.tab-bar');
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');

    // Scene Tab
    this.sunSlider = document.getElementById('sun-slider');
    this.gridToggle = document.getElementById('grid-toggle');
    
    // Asset Tab
    this.assetPanel = document.getElementById('asset-list');
    this.fileInput = document.getElementById('file-input');
    this.uploadButton = document.getElementById('btn-upload-asset');
    
    // Properties Tab
    this.propPanel = document.getElementById('props-content');


    // 1. Setup OrbitControls (Editor Camera)
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = true; // Start in editor mode
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    // 2. Setup TransformControls (Gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });
    this.scene.add(this.transformControls);

    // 3. Setup Raycaster (Object Selection)
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);

    // 4. Connect All UI Buttons
    this.connectUI();

    // *** MODIFIED: Set initial camera zoomed out ***
    this.camera.position.set(25, 25, 25);
    this.camera.lookAt(0, 0, 0);
    
    // Set initial tool
    this.onToolClick({ target: document.getElementById('btn-select') });
  }

  connectUI() {
    // Game Mode
    this.playButton.addEventListener('click', () => this.enterGameMode());
    this.endTestButton.addEventListener('click', () => this.enterEditorMode());

    // Transform Toolbar
    this.toolbar.addEventListener('click', (e) => this.onToolClick(e));
    
    // Tab Switching
    this.tabBar.addEventListener('click', (e) => this.onTabClick(e));

    // --- Scene Tab Listeners ---
    this.sunSlider.addEventListener('input', (e) => this.main.updateSun(e.target.value));
    this.main.updateSun(this.sunSlider.value); // Set initial
    
    this.gridToggle.addEventListener('change', (e) => {
      this.main.gridHelper.visible = e.target.checked;
    });

    // Texture Buttons
    document.getElementById('tex-grey').onclick = () => this.setTerrainColor(0x555555);
    document.getElementById('tex-grass').onclick = () => this.setTerrainColor(0x3d703a);
    document.getElementById('tex-sand').onclick = () => this.setTerrainColor(0xc2b280);
    document.getElementById('tex-concrete').onclick = () => this.setTerrainColor(0x808080);
    // TODO: Replace setTerrainColor with a texture loading function

    // --- Asset Tab Listeners ---
    this.assetPanel.addEventListener('click', (e) => this.onAssetClick(e));
    this.uploadButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.onFileUpload(e));
    
    // Delete button (in toolbar)
    document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());
  }

  // --- Game Mode Logic ---

  enterGameMode() {
    this.state = 'GAME';
    this.appContainer.classList.add('game-mode-active');
    
    this.orbitControls.enabled = false;
    this.transformControls.detach();
    this.main.controls.setPaused(false);
    this.main.gridHelper.visible = false; // Always hide grid in game mode

    this.main.camera.position.set(0, this.main.playerHeight, 5);
    this.main.camera.rotation.set(0, 0, 0, 'YXZ');
    
    // CRITICAL: Tell renderer to resize to new full-screen container
    this.main.onWindowResize();
  }

  enterEditorMode() {
    this.state = 'EDITOR';
    this.appContainer.classList.remove('game-mode-active');

    this.orbitControls.enabled = true;
    if (this.selectedObject) {
      this.transformControls.attach(this.selectedObject);
    }
    this.main.controls.setPaused(true);
    this.main.gridHelper.visible = this.gridToggle.checked; // Restore grid state

    this.camera.position.set(25, 25, 25);
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();
    
    // CRITICAL: Tell renderer to resize back to 50/50 container
    this.main.onWindowResize();
  }

  // --- UI Event Handlers ---

  onTabClick(event) {
    const button = event.target.closest('button.tab-button');
    if (!button) return;

    const tabId = button.dataset.tab;
    
    // Deactivate all
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));
    
    // Activate clicked
    button.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }

  onToolClick(event) {
    const button = event.target.closest('button.tool');
    if (!button) return;

    const tool = button.dataset.tool;
    if (tool === 'select') {
      this.transformControls.setMode('translate');
      this.transformControls.showX = false;
      this.transformControls.showY = false;
      this.transformControls.showZ = false;
    } else if (['translate', 'rotate', 'scale'].includes(tool)) {
      this.transformControls.setMode(tool);
      this.transformControls.showX = true;
      this.transformControls.showY = true;
      this.transformControls.showZ = true;
    }

    this.toolbar.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
  }
  
  onAssetClick(event) {
    const button = event.target.closest('button.asset-item');
    if (!button) return;
    
    const path = button.dataset.path;
    this.main.debugger.log(`Loading asset: ${path}`);
    
    loadModel(
      path, 
      (model) => {
        model.position.set(0, 0.1, 0);
        this.scene.add(model);
        this.selectObject(model);
      },
      (error) => this.main.debugger.handleError(error, 'AssetLoad')
    );
  }

  onFileUpload(event) {
    const files = event.target.files;
    if (!files) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const filename = file.name.toLowerCase();
        const loader = filename.endsWith('.fbx') ? loadFBXModel : loadModel;
        
        loader(
          buffer,
          (model) => {
            model.name = file.name;
            this.scene.add(model);
            this.selectObject(model);
          },
          (error) => this.main.debugger.handleError(error, `FileUpload: ${file.name}`)
        );
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = null;
  }

  // --- Scene / Object Logic ---

  setTerrainColor(color) {
    // This is a placeholder. You can swap this for texture loading.
    const mesh = this.main.terrainMesh;
    if (!mesh) return;
    
    mesh.material.map = null; // Remove any existing texture
    mesh.material.color.set(color);
    mesh.material.needsUpdate = true;
  }
  /*
  // Example of texture loading:
  setTerrainTexture(texturePath) {
    const mesh = this.main.terrainMesh;
    if (!mesh) return;
    
    const texture = this.main.textureLoader.load(texturePath);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20); // Repeat texture 20x20 times
    
    mesh.material.map = texture;
    mesh.material.color.set(0xffffff); // Set to white to not tint texture
    mesh.material.needsUpdate = true;
  }
  */

  onPointerDown(event) {
    if (this.state !== 'EDITOR') return;
    if (this.transformControls.dragging) return;
    
    // Calculate pointer position
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    let hit = null;
    for (const i of intersects) {
      
      // *** ERROR FIX: Check if the intersected object is part of the TransformControls gizmo ***
      let isGizmo = false;
      i.object.traverseAncestors((parent) => {
        if (parent === this.transformControls) {
          isGizmo = true;
        }
      });
      if (isGizmo) continue; // Skip this intersection, it's the gizmo

      // Check for selectable objects
      if (i.object.isMesh && 
          i.object.name !== 'SkyDome_10km' && 
          !i.object.userData.__isTerrain &&
          !i.object.isGridHelper) {
        
        let rootObject = i.object;
        while (rootObject.parent && rootObject.parent !== this.scene) {
          rootObject = rootObject.parent;
        }
        if (rootObject === this.transformControls) continue;

        hit = rootObject;
        break;
      }
    }

    this.selectObject(hit);
  }

  selectObject(obj) {
    if (this.selectedObject === obj) return;
    
    if (obj) {
      this.selectedObject = obj;
      this.transformControls.attach(obj);
      this.updatePropertyPanel(obj);
    } else {
      this.selectedObject = null;
      this.transformControls.detach();
      this.updatePropertyPanel(null);
    }
  }
  
  deleteSelected() {
    if (!this.selectedObject) return;
    
    const obj = this.selectedObject;
    this.selectObject(null); // Deselect first
    
    obj.removeFromParent();
    
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }

  updatePropertyPanel(obj) {
    const content = document.getElementById('props-content');
    if (!obj) {
      content.innerHTML = '<p>No object selected.</p>';
      return;
    }

    content.innerHTML = `
      <strong>${obj.name || 'Object'}</strong>
      <label>Pos X:</label>
      <input type="number" step="0.1" value="${obj.position.x.toFixed(2)}" data-prop="position.x">
      <label>Pos Y:</label>
      <input type="number" step="0.1" value="${obj.position.y.toFixed(2)}" data-prop="position.y">
      <label>Pos Z:</label>
      <input type="number" step="0.1" value="${obj.position.z.toFixed(2)}" data-prop="position.z">
      
      <label>Scale:</label>
      <input type="number" step="0.05" value="${obj.scale.x.toFixed(2)}" data-prop="scale.x">
    `;
    
    content.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const propPath = e.target.dataset.prop;
        const value = parseFloat(e.target.value);
        if (isNaN(value)) return;
        
        if (propPath === 'position.x') obj.position.x = value;
        if (propPath === 'position.y') obj.position.y = value;
        if (propPath === 'position.z') obj.position.z = value;
        
        if (propPath === 'scale.x') obj.scale.set(value, value, value);
      });
    });
  }
}
