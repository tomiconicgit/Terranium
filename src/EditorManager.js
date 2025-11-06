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

    // Get UI elements
    this.editorUI = document.getElementById('editor-ui');
    this.playButton = document.getElementById('btn-play');
    this.toolbar = document.getElementById('editor-toolbar');
    this.assetPanel = document.getElementById('asset-panel');
    this.propPanel = document.getElementById('property-panel');
    this.fileInput = document.getElementById('file-input');
    this.uploadButton = document.getElementById('btn-upload-asset');

    // 1. Setup OrbitControls (Editor Camera)
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = true; // Start in editor mode
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    // 2. Setup TransformControls (Gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.addEventListener('dragging-changed', (event) => {
      // Disable orbit controls while dragging gizmo
      this.orbitControls.enabled = !event.value;
    });
    this.scene.add(this.transformControls);

    // 3. Setup Raycaster (Object Selection)
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    // Listen on the canvas for clicks
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);

    // 4. Connect UI Buttons
    this.playButton.addEventListener('click', () => this.toggleGameMode());
    this.toolbar.addEventListener('click', (e) => this.onToolClick(e));
    this.assetPanel.addEventListener('click', (e) => this.onAssetClick(e));
    this.uploadButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.onFileUpload(e));
    
    document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());

    // Set initial camera position for editor
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    
    // Set initial tool
    this.onToolClick({ target: document.getElementById('btn-select') });
  }

  toggleGameMode() {
    if (this.state === 'EDITOR') {
      this.enterGameMode();
    } else {
      this.enterEditorMode();
    }
  }

  enterGameMode() {
    this.state = 'GAME';
    this.playButton.textContent = '⏹️ Editor';
    
    // Disable editor controls
    this.orbitControls.enabled = false;
    this.transformControls.detach(); // Hide gizmo
    this.editorUI.style.display = 'none'; // Hide all editor UI

    // Enable game controls (from Main.js)
    this.main.controls.setPaused(false);
    
    // Reset player position (or use a dedicated spawn point)
    this.main.camera.position.set(0, this.main.playerHeight, 5);
    this.main.camera.rotation.set(0, 0, 0, 'YXZ');
  }

  enterEditorMode() {
    this.state = 'EDITOR';
    this.playButton.textContent = '▶️ Play';
    
    // Enable editor controls
    this.orbitControls.enabled = true;
    this.editorUI.style.display = 'block'; // Show editor UI
    if (this.selectedObject) {
      this.transformControls.attach(this.selectedObject);
    }

    // Disable game controls
    this.main.controls.setPaused(true);

    // Set camera to a good editor position
    this.camera.position.set(10, 10, 10);
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();
  }

  onToolClick(event) {
    const button = event.target.closest('button.tool');
    if (!button) return;

    // Handle tool mode
    const tool = button.dataset.tool;
    if (tool === 'select') {
      this.transformControls.setMode('translate'); // Use 'translate' for selection visual
      this.transformControls.showX = false;
      this.transformControls.showY = false;
      this.transformControls.showZ = false;
    } else if (['translate', 'rotate', 'scale'].includes(tool)) {
      this.transformControls.setMode(tool);
      this.transformControls.showX = true;
      this.transformControls.showY = true;
      this.transformControls.showZ = true;
    }

    // Update active button style
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
        model.position.set(0, 0.1, 0); // Place at camera target
        this.scene.add(model);
        this.selectObject(model); // Select the new model
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
    
    // Reset file input
    event.target.value = null;
  }

  onPointerDown(event) {
    if (this.state !== 'EDITOR') return;

    // Don't select if clicking on the gizmo
    if (this.transformControls.dragging) return;
    
    // Clicks on HTML (UI) are on a different layer and won't reach the canvas,
    // so we don't need to check for .no-look here.

    // Calculate pointer position in normalized device coordinates
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster
    this.raycaster.setFromCamera(this.pointer, this.camera);
    
    // Find intersections (only check models, not terrain or sky)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Find the first "selectable" object
    let hit = null;
    for (const i of intersects) {
      
      // *** FIX: Check if the intersected object is part of the TransformControls gizmo ***
      let isGizmo = false;
      i.object.traverseAncestors((parent) => {
        if (parent === this.transformControls) {
          isGizmo = true;
        }
      });
      if (isGizmo) continue; // Skip this intersection, it's the gizmo

      // Original logic
      if (i.object.isMesh && 
          i.object.name !== 'SkyDome_10km' && 
          !i.object.userData.__isTerrain) {
        
        // Traverse up to find the root model (the THREE.Group)
        let rootObject = i.object;
        while (rootObject.parent && rootObject.parent !== this.scene) {
          rootObject = rootObject.parent;
        }
        
        // Final check: don't select the root of the gizmo
        if (rootObject === this.transformControls) continue;

        hit = rootObject;
        break;
      }
    }

    if (hit) {
      this.selectObject(hit);
    } else {
      this.selectObject(null); // Deselect
    }
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
    
    // Remove from scene
    obj.removeFromParent();
    
    // Optional: Dispose geometry/material
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

    // A simple property editor
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
    
    // Add live-updating
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
