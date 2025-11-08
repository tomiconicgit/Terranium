// src/EditorManager.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { loadModel, loadFBXModel } from './ModelLoading.js';

export class EditorManager {
  constructor(mainApp) {
    this.main = mainApp;
    this.scene = mainApp.scene;
    this.camera = mainApp.camera;
    this.renderer = mainApp.renderer;
    this.world = this.main.world; 
    
    this.state = 'EDITOR';
    this.selectedObject = null;
    this.textureLoader = new THREE.TextureLoader();
    this.fileReader = new FileReader();
    
    // *** NEW: State for full-screen panels ***
    this.isPanelOpen = false; 

    this.parentingState = {
      isWaiting: false,
      childToMove: null
    };
    this.animCreatorState = { pos1: null, pos2: null };
    
    this.timeOfDay = 50; 
    this.isGridVisible = true;

    this.bindDOM();
    this.initControls();
    this.addEventListeners();
    this.buildSceneTree();
  }

  bindDOM() {
    this.appContainer = document.getElementById('app-container');
    this.playButton = document.getElementById('btn-play');
    this.endTestButton = document.getElementById('btn-end-test');
    
    // *** MODIFIED: Bind new toolbar and panels ***
    this.toolbar = document.getElementById('transform-tools');
    this.hud = document.getElementById('editor-hud');
    
    this.scenePanel = document.getElementById('panel-scene');
    this.propsPanel = document.getElementById('panel-properties');
    this.assetsPanel = document.getElementById('panel-assets');
    this.allPanels = [this.scenePanel, this.propsPanel, this.assetsPanel];

    this.sceneTreeView = document.getElementById('scene-tree-view');
    this.parentButton = document.getElementById('btn-child-to');
    
    this.propsContent = document.getElementById('props-content');
    this.assetList = document.getElementById('asset-list');
    this.modelFileInput = document.getElementById('file-input-model');
    this.uploadModelButton = document.getElementById('btn-upload-model');
    
    this.texInputMap = document.getElementById('texture-input-map');
    this.texInputNormal = document.getElementById('texture-input-normal');
    this.texInputMetal = document.getElementById('texture-input-metal');
    this.texInputRough = document.getElementById('texture-input-rough');
    this.texInputDisplacement = document.getElementById('texture-input-displacement');
    this.texInputEmissive = document.getElementById('texture-input-emissive');
    this.texInputAO = document.getElementById('texture-input-ao');
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = true;
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls);

    this.transformControls.addEventListener('dragging-changed', (event) => {
        // Only disable orbit controls if a panel isn't already disabling it
        if (!this.isPanelOpen) {
            this.orbitControls.enabled = !event.value;
        }
    });
    
    this.transformControls.addEventListener('objectChange', () => {
      if (this.selectedObject) {
        this.syncPropsFromGizmo();
      }
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  addEventListeners() {
    this.playButton.addEventListener('click', () => this.enterGameMode());
    this.endTestButton.addEventListener('click', () => this.enterEditorMode());
    this.toolbar.addEventListener('click', (e) => this.onToolClick(e));
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);
    
    this.parentButton.addEventListener('click', () => this.startChildingProcess());
    this.sceneTreeView.addEventListener('click', (e) => this.onSceneTreeClick(e));

    this.assetList.addEventListener('click', (e) => this.onAssetClick(e));
    this.uploadModelButton.addEventListener('click', () => this.modelFileInput.click());
    this.modelFileInput.addEventListener('change', (e) => this.onFileUpload(e));
    
    document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());

    // *** NEW: Panel Show/Hide Listeners ***
    document.getElementById('btn-show-scene').addEventListener('click', () => this.showPanel(this.scenePanel));
    document.getElementById('btn-show-props').addEventListener('click', () => this.showPanel(this.propsPanel));
    document.getElementById('btn-show-assets').addEventListener('click', () => this.showPanel(this.assetsPanel));

    this.allPanels.forEach(panel => {
      const closeButton = panel.querySelector('.btn-close-panel');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.hidePanel(panel));
      }
    });
  }
  
  // *** NEW: Panel Management Functions ***
  showPanel(panelToShow) {
    this.allPanels.forEach(p => {
      if (p === panelToShow) {
        p.classList.add('visible');
      } else {
        p.classList.remove('visible');
      }
    });
    this.setPaused(true); // Pause editor controls when a panel is open
  }

  hidePanel(panelToHide) {
    if (panelToHide) {
        panelToHide.classList.remove('visible');
    }
    this.setPaused(false); // Resume editor controls
  }

  hideAllPanels() {
    this.allPanels.forEach(p => p.classList.remove('visible'));
    this.setPaused(false);
  }
  
  // *** NEW: Paused state for panels ***
  setPaused(isPaused) {
    this.isPanelOpen = isPaused;
    this.orbitControls.enabled = !isPaused && this.state === 'EDITOR' && !this.transformControls.dragging;
    
    if (isPaused) {
        // Detach gizmo when panel is open
        this.transformControls.detach();
    } else if (this.state === 'EDITOR' && this.selectedObject) {
        // Re-attach gizmo when panel closes
        this.transformControls.attach(this.selectedObject);
    }
  }

  // --- Game Mode Logic (Updated) ---
  enterGameMode() {
    this.state = 'GAME';
    this.appContainer.classList.add('game-mode-active');
    this.hideAllPanels(); // Close any open panels
    this.orbitControls.enabled = false;
    this.transformControls.detach();
    this.main.controls.setPaused(false);
    this.main.gridHelper.visible = false;
    this.main.camera.position.set(0, this.main.playerHeight, 5);
    this.main.camera.rotation.set(0, 0, 0, 'YXZ');
    this.main.onWindowResize();
  }

  enterEditorMode() {
    this.state = 'EDITOR';
    this.appContainer.classList.remove('game-mode-active');
    this.setPaused(false); // This will enable orbit controls
    this.main.controls.setPaused(true);
    this.main.gridHelper.visible = this.isGridVisible;
    
    this.camera.position.set(25, 25, 25);
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();
    this.main.onWindowResize();
  }

  // --- UI Event Handlers (Updated) ---
  onTabClick(event) {
    // This function is no longer needed
  }

  onToolClick(event) {
    const button = event.target.closest('button.tool');
    if (!button) return;
    const tool = button.dataset.tool;
    if (tool === 'select') {
      this.transformControls.setMode('translate');
      this.transformControls.showX = false; this.transformControls.showY = false; this.transformControls.showZ = false;
    } else {
      this.transformControls.setMode(tool);
      this.transformControls.showX = true; this.transformControls.showY = true; this.transformControls.showZ = true;
    }
    this.toolbar.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
  }
  
  onAssetClick(event) {
    const button = event.target.closest('button.asset-item');
    if (!button) return;
    const path = button.dataset.path;
    loadModel(path, (model) => {
        model.position.set(0, 0.1, 0);
        this.world.add(model); 
        this.selectObject(model);
        this.buildSceneTree();
        this.hidePanel(this.assetsPanel); // Close panel on load
      }, (error) => this.main.debugger.handleError(error, 'AssetLoad')
    );
  }

  onFileUpload(event) {
    const files = event.target.files;
    if (!files) return;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const loader = file.name.toLowerCase().endsWith('.fbx') ? loadFBXModel : loadModel;
        loader(buffer, (model) => {
            model.name = file.name;
            this.world.add(model);
            this.selectObject(model);
            this.buildSceneTree();
            this.hidePanel(this.assetsPanel); // Close panel on load
          }, (error) => this.main.debugger.handleError(error, `FileUpload: ${file.name}`)
        );
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = null;
  }

  // --- Scene Hierarchy & Parenting ---

  createTreeCategory(name, isCollapsible = true) {
    const category = document.createElement('div');
    category.className = 'tree-category';
    
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    if (isCollapsible) arrow.textContent = 'âº';
    
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = name;
    
    category.appendChild(arrow);
    category.appendChild(label);
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    
    if (isCollapsible) {
        category.addEventListener('click', (e) => {
            if (e.target.closest('.label') || e.target.closest('.arrow')) {
                category.classList.toggle('expanded');
            }
        });
    }
    return { category, childrenContainer };
  }
  
  createTreeItem(name, iconClass, data) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    
    const itemIcon = document.createElement('span');
    itemIcon.className = 'icon ' + iconClass;
    
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = name;
    
    item.appendChild(itemIcon);
    item.appendChild(label);
    
    if (data instanceof THREE.Object3D) {
        item.dataset.uuid = data.uuid;
        if (this.selectedObject === data) item.classList.add('selected');
    } else {
        item.dataset.special = data;
        if (this.selectedObject === data) item.classList.add('selected');
    }
    return item;
  }

  buildSceneTree() {
    this.sceneTreeView.innerHTML = '';
    
    const { category: worldCat, childrenContainer: worldChildren } = this.createTreeCategory('World', true);
    worldCat.classList.add('expanded');
    
    const sky = this.scene.getObjectByName("SkySettings");
    if (sky) worldChildren.appendChild(this.createTreeItem("Sky", "icon-sky", "sky"));
    
    const light = this.scene.getObjectByName("LightingSettings");
    if (light) worldChildren.appendChild(this.createTreeItem("Lighting", "icon-light", "light"));
    
    const terrain = this.scene.getObjectByName("TerrainSettings");
    if (terrain) worldChildren.appendChild(this.createTreeItem("Terrain", "icon-terrain", "terrain"));

    this.sceneTreeView.appendChild(worldCat);
    this.sceneTreeView.appendChild(worldChildren);
    
    const { category: modelsCat, childrenContainer: modelsChildren } = this.createTreeCategory('Models', true);
    modelsCat.classList.add('expanded');
    
    // This recursive function was correct, but was being fed flat data.
    // It will now work as intended.
    const buildModelNode = (obj) => {
        // *** FIX: Check for animations on userData ***
        const hasAnims = obj.userData.animations && obj.userData.animations.length > 0;
        const hasChildren = obj.children.length > 0;
        const isCollapsible = hasChildren || hasAnims;
        
        const item = document.createElement('div');
        item.className = 'tree-item';
        if (isCollapsible) item.classList.add('collapsible');
        item.dataset.uuid = obj.uuid;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        if (isCollapsible) arrow.textContent = 'âº';
        
        const icon = document.createElement('span');
        icon.className = 'icon ' + (obj.isMesh ? 'icon-mesh' : 'icon-folder');
        
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = obj.name || obj.type;

        item.appendChild(arrow);
        item.appendChild(icon);
        item.appendChild(label);
        
        if (this.selectedObject === obj) {
            item.classList.add('selected');
        }
        
        item.addEventListener('click', (e) => {
            if (e.target.closest('.arrow')) {
                item.classList.toggle('expanded');
            }
        });
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';

        if (hasChildren) {
            obj.children.forEach(child => {
                // Filter out helper objects
                if (child.isCamera || child.isLight) return;
                childrenContainer.appendChild(buildModelNode(child));
            });
        }
        if (hasAnims) {
            obj.userData.animations.forEach(anim => {
                const animItem = this.createTreeItem(anim.name, 'icon-animation', anim);
                childrenContainer.appendChild(animItem);
            });
        }
        
        modelsChildren.appendChild(item);
        if (isCollapsible) {
             modelsChildren.appendChild(childrenContainer);
        }
        return item;
    };
    
    this.world.children.forEach(child => buildModelNode(child));
    this.sceneTreeView.appendChild(modelsCat);
    this.sceneTreeView.appendChild(modelsChildren);
  }

  onSceneTreeClick(event) {
    const item = event.target.closest('.tree-item');
    if (!item) return;
    if (event.target.closest('.arrow')) return;
    
    const uuid = item.dataset.uuid;
    const special = item.dataset.special;
    
    if (uuid) {
        // *** FIX: Search the entire scene, not just the world ***
        const object = this.scene.getObjectByProperty('uuid', uuid);
        if (object) {
            if (this.parentingState.isWaiting) {
                this.completeChildingProcess(object);
            } else {
                this.selectObject(object);
                this.hidePanel(this.scenePanel); // Close panel on selection
            }
        }
    } else if (special) {
        if (this.parentingState.isWaiting) {
            this.main.debugger.warn("Cannot parent an object to World settings.", "Parenting");
            this.cancelChildingProcess();
        } else {
            this.selectObject(special);
            this.hidePanel(this.scenePanel); // Close panel on selection
        }
    }
  }
  
  startChildingProcess() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Object3D)) {
        this.main.debugger.warn("Select an object to be the child first.", "Parenting");
        return;
    }
    this.parentingState.isWaiting = true;
    this.parentingState.childToMove = this.selectedObject;
    this.parentButton.textContent = 'Cancel (Select Parent)';
    this.parentButton.style.background = '#ff3b30';
    this.hidePanel(this.scenePanel); // Close panel to allow viewport selection
  }
  
  completeChildingProcess(newParent) {
    const childToMove = this.parentingState.childToMove;
    if (!childToMove || newParent === childToMove) {
      this.cancelChildingProcess();
      return;
    }
    
    newParent.attach(childToMove); // .attach preserves world transform
    this.main.debugger.log(`Parented ${childToMove.name} to ${newParent.name}`);
    this.cancelChildingProcess();
    this.buildSceneTree();
    this.selectObject(childToMove);
  }
  
  cancelChildingProcess() {
    this.parentingState.isWaiting = false;
    this.parentingState.childToMove = null;
    this.parentButton.textContent = 'Child To...';
    this.parentButton.style.background = '';
    this.parentButton.disabled = !(this.selectedObject instanceof THREE.Object3D);
  }

  // --- Object Selection & Properties ---
  onPointerDown(event) {
    // *** MODIFIED: Add check for isPanelOpen ***
    if (this.state !== 'EDITOR' || this.transformControls.dragging || this.isPanelOpen) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Intersect the world and terrain
    const objectsToIntersect = [...this.world.children, this.main.terrain];
    const intersects = this.raycaster.intersectObjects(objectsToIntersect, true);
    
    let hit = null;
    for (const i of intersects) {
      if (i.object.userData.__isTerrain) {
          hit = null; // Hit terrain, de-select
          break; 
      }
      // *** CRITICAL FIX: Select the clicked mesh, NOT its root parent ***
      if (i.object.isMesh) {
        hit = i.object; // Select the actual mesh
        break;
      }
    }
    
    if (this.parentingState.isWaiting && hit) {
      this.completeChildingProcess(hit);
    } else {
      this.selectObject(hit);
    }
  }

  selectObject(obj) {
    if (this.selectedObject === obj) return;
    this.selectedObject = obj;
    
    if (obj instanceof THREE.Object3D) {
      this.transformControls.attach(obj);
      // *** MODIFIED: Show panel if not already open ***
      if (!this.isPanelOpen) {
          this.showPanel(this.propsPanel);
      }
    } else {
      this.transformControls.detach();
      // *** MODIFIED: Hide props if nothing is selected ***
      this.hidePanel(this.propsPanel);
    }
    
    this.cancelChildingProcess();
    this.updatePropertyPanel(obj);
    this.buildSceneTree();
  }
  
  deleteSelected() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Object3D)) return;
    
    // Don't delete world settings
    if (typeof this.selectedObject === 'string') return; 
    
    const obj = this.selectedObject;
    this.selectObject(null); // De-select
    
    obj.removeFromParent();
    
    // Dispose geometry and materials
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
    this.buildSceneTree();
  }

  /**
   * ROUTER: Rebuilds the Property Panel based on selection
   */
  updatePropertyPanel(obj) {
    this.propsContent.innerHTML = '';
    this.resetAnimCreator();

    if (obj === null) {
      this.propsContent.innerHTML = '<p>No object selected.</p>';
    } else if (typeof obj === 'string') {
      if (obj === 'sky') this.buildSkyPanel();
      if (obj === 'light') this.buildLightPanel();
      if (obj === 'terrain') this.buildTerrainPanel();
    } else if (obj instanceof THREE.Object3D) {
      this.buildObjectPanel(obj);
    }
  }

  // --- PANEL BUILDER: 3D OBJECT ---
  buildObjectPanel(obj) {
    const pos = obj.position;
    const rot = obj.rotation;
    const scl = obj.scale;

    let mesh = null;
    // *** FIX: Find mesh on selected object or its children ***
    if (obj.isMesh) {
        mesh = obj;
    } else {
        obj.traverse(child => { if (child.isMesh) mesh = child; });
    }
    const mat = mesh ? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) : null;
    
    // *** FIX: Find animation root ***
    let animRoot = obj;
    while (animRoot.parent && animRoot.parent !== this.world) {
        animRoot = animRoot.parent;
    }
    const anims = animRoot.userData.animations || [];
    
    const animListHTML = anims.map(anim => `
      <div class="animation-list-item">
        <span>${anim.name}</span>
        <button data-anim-name="${anim.name}">Test</button>
      </div>
    `).join('');

    this.propsContent.innerHTML = `
      <div class="props-group">
        <h5>${obj.name || obj.type} ( ${obj.isMesh ? 'Mesh' : 'Group'} )</h5>
        <div class="props-stack">
            <label>Position (Local)</label>
            <div class="props-vector3">
              <span>X</span><input type="number" step="0.1" id="props-pos-x" value="${pos.x.toFixed(2)}">
              <span>Y</span><input type="number" step="0.1" id="props-pos-y" value="${pos.y.toFixed(2)}">
              <span>Z</span><input type="number" step="0.1" id="props-pos-z" value="${pos.z.toFixed(2)}">
            </div>
            <div class="props-slider">
              <span>X</span><input type="range" min="-50" max="50" step="0.1" id="props-pos-x-slider" value="${pos.x.toFixed(2)}">
            </div>
            <div class="props-slider">
              <span>Y</span><input type="range" min="0" max="50" step="0.1" id="props-pos-y-slider" value="${pos.y.toFixed(2)}">
            </div>
            <div class="props-slider">
              <span>Z</span><input type="range" min="-50" max="50" step="0.1" id="props-pos-z-slider" value="${pos.z.toFixed(2)}">
            </div>
        </div>
        <div class="props-stack">
            <label>Rotation (Local)</label>
            <div class="props-vector3">
              <span>X</span><input type="number" step="1" id="props-rot-x" value="${THREE.MathUtils.radToDeg(rot.x).toFixed(1)}">
              <span>Y</span><input type="number" step="1" id="props-rot-y" value="${THREE.MathUtils.radToDeg(rot.y).toFixed(1)}">
              <span>Z</span><input type="number" step="1" id="props-rot-z" value="${THREE.MathUtils.radToDeg(rot.z).toFixed(1)}">
            </div>
        </div>
        <div class="props-stack">
            <label>Scale (Local, Non-Uniform)</label>
            <div class="props-vector3">
              <span>X</span><input type="number" step="0.05" id="props-scl-x" value="${scl.x.toFixed(2)}">
              <span>Y</span><input type="number" step="0.05" id="props-scl-y" value="${scl.y.toFixed(2)}">
              <span>Z</span><input type="number" step="0.05" id="props-scl-z" value="${scl.z.toFixed(2)}">
            </div>
        </div>
        <div class="props-stack">
            <label>Scale (Local, Uniform)</label>
            <input type="range" min="0.01" max="5" step="0.01" id="props-scl-uniform" value="${scl.x.toFixed(2)}">
        </div>
      </div>
      
      ${mat ? `... (Material HTML) ...` : ''}
      ... (Animation HTML) ...
    `;
    
    const matHTML = mat ? `
      <div class="props-group">
        <h5>Material (PBR)</h5>
        <div class="props-row"><label>Metalness</label><input type="range" min="0" max="1" step="0.01" id="props-mat-metal" value="${mat.metalness || 0}"></div>
        <div class="props-row"><label>Roughness</label><input type="range" min="0" max="1" step="0.01" id="props-mat-rough" value="${mat.roughness || 0}"></div>
        
        <div class="props-row"><label>Albedo Map</label><div class="props-texture"><span id="map-name">${mat.map ? mat.map.name || 'Texture' : 'None'}</span><button id="btn-load-map">Load</button></div></div>
        <div class="props-row"><label>Normal Map</label><div class="props-texture"><span id="normal-name">${mat.normalMap ? mat.normalMap.name || 'Texture' : 'None'}</span><button id="btn-load-normal">Load</button></div></div>
        <div class="props-row"><label>Roughness Map</label><div class="props-texture"><span id="rough-name">${mat.roughnessMap ? mat.roughnessMap.name || 'Texture' : 'None'}</span><button id="btn-load-rough">Load</button></div></div>
        <div class="props-row"><label>Metalness Map</label><div class="props-texture"><span id="metal-name">${mat.metalnessMap ? mat.metalnessMap.name || 'Texture' : 'None'}</span><button id="btn-load-metal">Load</button></div></div>
        <div class="props-row"><label>AO Map</label><div class="props-texture"><span id="ao-name">${mat.aoMap ? mat.aoMap.name || 'Texture' : 'None'}</span><button id="btn-load-ao">Load</button></div></div>
        <div class="props-row"><label>Emissive Map</label><div class="props-texture"><span id="emissive-name">${mat.emissiveMap ? mat.emissiveMap.name || 'Texture' : 'None'}</span><button id="btn-load-emissive">Load</button></div></div>
        <div class="props-row"><label>Displacement</label><div class="props-texture"><span id="disp-name">${mat.displacementMap ? mat.displacementMap.name || 'Texture' : 'None'}</span><button id="btn-load-disp">Load</button></div></div>
        
        <div class="props-stack">
            <label>Displacement Scale</label>
            <input type="range" min="0" max="5" step="0.1" id="props-disp-scale" value="${mat.displacementScale || 1}">
        </div>
        <div class="props-stack">
            <label>UV Repeat</label>
            <div class="props-vector3">
                <span>X</span><input type="number" step="0.1" id="props-uv-x" value="${mat.map ? mat.map.repeat.x : 1}">
                <span>Y</span><input type="number" step="0.1" id="props-uv-y" value="${mat.map ? mat.map.repeat.y : 1}">
            </div>
        </div>
      </div>
    ` : '<div class="props-group"><p style="padding: 16px; margin: 0; color: #8e8e93;">No material found on this object.</p></div>';

    const animHTML = `
      <div class="props-group">
        <h5>Animations (on Root: ${animRoot.name || 'Model'})</h5>
        <div class="animation-list" id="anim-list">${animListHTML || '<p style="padding: 0 16px 16px; margin: 0; color: #8e8e93;">No animations found on root.</p>'}</div>
        <button id="btn-anim-create-new" style="margin: 10px 16px 16px;">Create New Animation</button>
        <div class="animation-creator" id="anim-creator" style="display: none; margin: 0 16px 16px; box-sizing: border-box;">
          <label>Animation Name</label>
          <input type="text" id="anim-name" placeholder="e.g. 'DoorOpen'">
          <div class="animation-keyframe-row">
            <button id="btn-anim-set-pos1">Set Start Pos</button>
            <span id="anim-pos1-display">...</span>
          </div>
          <div class="animation-keyframe-row">
            <button id="btn-anim-set-pos2">Set End Pos</button>
            <span id="anim-pos2-display">...</span>
          </div>
          <label>Duration (seconds)</label>
          <input type="number" id="anim-duration" value="2" step="0.1">
          <button id="btn-anim-save">Save Animation</button>
        </div>
      </div>
    `;
    
    this.propsContent.innerHTML = this.propsContent.innerHTML
        .replace('... (Material HTML) ...', matHTML)
        .replace('... (Animation HTML) ...', animHTML);

    // *** FIX: Pass animRoot to binding function ***
    this.bindPropertyPanelEvents(obj, mat, animRoot);
  }

  // --- PANEL BUILDER: SKY ---
  buildSkyPanel() {
    // ... (This function is unchanged) ...
    const sky = this.main.sky;
    const sunLight = this.main.sunLight;
    
    this.propsContent.innerHTML = `
        <div class="props-group">
            <h5>Sky Settings</h5>
            <div class="props-stack"><label>Top Color</label><input type="color" id="props-sky-top" value="${'#' + sky.material.uniforms.topColor.value.getHexString()}"></div>
            <div class="props-stack"><label>Bottom Color</label><input type="color" id="props-sky-bottom" value="${'#' + sky.material.uniforms.bottomColor.value.getHexString()}"></div>
        </div>
        <div class="props-group">
            <h5>Sun</h5>
            <div class="props-stack"><label>Sun Color</label><input type="color" id="props-sun-color" value="${'#' + sunLight.color.getHexString()}"></div>
            <div class="props-stack"><label>Sun Intensity</label><input type="range" min="0" max="5" step="0.1" id="props-sun-intensity" value="${sunLight.intensity}"></div>
            <div class="props-stack"><label>Time of Day</label><input type="range" min="0" max="100" step="1" id="props-sun-slider" value="${this.timeOfDay}"></div>
        </div>
    `;
    
    document.getElementById('props-sky-top').oninput = (e) => sky.material.uniforms.topColor.value.set(e.target.value);
    document.getElementById('props-sky-bottom').oninput = (e) => sky.material.uniforms.bottomColor.value.set(e.target.value);
    document.getElementById('props-sun-color').oninput = (e) => sunLight.color.set(e.target.value);
    document.getElementById('props-sun-intensity').oninput = (e) => sunLight.intensity = parseFloat(e.target.value);
    
    document.getElementById('props-sun-slider').oninput = (e) => {
        const val = e.target.value;
        this.main.updateSun(val);
        this.timeOfDay = val;
    };
  }
  
  // --- PANEL BUILDER: LIGHTING ---
  buildLightPanel() {
    // ... (This function is unchanged) ...
    const sunLight = this.main.sunLight;
    const hemiLight = this.main.hemiLight;
    const pos = sunLight.position;
    
    this.propsContent.innerHTML = `
        <div class="props-group">
            <h5>Sun Light (Directional)</h5>
            <div class="props-stack"><label>Sun Color</label><input type="color" id="props-sun-color" value="${'#' + sunLight.color.getHexString()}"></div>
            <div class="props-stack"><label>Sun Intensity</label><input type="range" min="0" max="5" step="0.1" id="props-sun-intensity" value="${sunLight.intensity}"></div>
            <div class="props-stack">
                <label>Sun Position</label>
                <div class="props-vector3">
                  <span>X</span><input type="number" step="1" id="props-pos-x" value="${pos.x.toFixed(0)}">
                  <span>Y</span><input type="number" step="1" id="props-pos-y" value="${pos.y.toFixed(0)}">
                  <span>Z</span><input type="number" step="1" id="props-pos-z" value="${pos.z.toFixed(0)}">
                </div>
            </div>
        </div>
        <div class="props-group">
            <h5>Ambient Light (Hemisphere)</h5>
            <div class="props-stack"><label>Sky Color</label><input type="color" id="props-hemi-sky" value="${'#' + hemiLight.color.getHexString()}"></div>
            <div class="props-stack"><label>Ground Color</label><input type="color" id="props-hemi-ground" value="${'#' + hemiLight.groundColor.getHexString()}"></div>
            <div class="props-stack"><label>Ambient Intensity</label><input type="range" min="0" max="3" step="0.05" id="props-hemi-intensity" value="${hemiLight.intensity}"></div>
        </div>
    `;
    
    document.getElementById('props-sun-color').oninput = (e) => sunLight.color.set(e.target.value);
    document.getElementById('props-sun-intensity').oninput = (e) => sunLight.intensity = parseFloat(e.target.value);
    document.getElementById('props-pos-x').oninput = (e) => sunLight.position.x = parseFloat(e.target.value);
    document.getElementById('props-pos-y').oninput = (e) => sunLight.position.y = parseFloat(e.target.value);
    document.getElementById('props-pos-z').oninput = (e) => sunLight.position.z = parseFloat(e.target.value);
    document.getElementById('props-hemi-sky').oninput = (e) => hemiLight.color.set(e.target.value);
    document.getElementById('props-hemi-ground').oninput = (e) => hemiLight.groundColor.set(e.target.value);
    document.getElementById('props-hemi-intensity').oninput = (e) => hemiLight.intensity = parseFloat(e.target.value);
  }
  
  // --- PANEL BUILDER: TERRAIN ---
  buildTerrainPanel() {
    // ... (This function is unchanged) ...
    const terrainMesh = this.main.terrainMesh;
    if (!terrainMesh) return;
    const mat = terrainMesh.material;
    
    this.propsContent.innerHTML = `
        <div class="props-group">
            <h5>Terrain Settings</h5>
            <div class="props-row"><label>Show Grid</label><input type="checkbox" id="props-grid-toggle" ${this.isGridVisible ? 'checked' : ''}></div>
        </div>
        <div class="props-group">
            <h5>Material</h5>
            <div class="props-stack"><label>Base Color</label><input type="color" id="props-terrain-color" value="${'#' + mat.color.getHexString()}"></div>
            <div class="props-row"><label>Metalness</label><input type="range" min="0" max="1" step="0.01" id="props-mat-metal" value="${mat.metalness || 0}"></div>
            <div class="props-row"><label>Roughness</label><input type="range" min="0" max="1" step="0.01" id="props-mat-rough" value="${mat.roughness || 0}"></div>
        </div>
        <div class="props-group">
            <h5>Textures</h5>
            <div class="props-row"><label>Albedo Map</label><div class="props-texture"><span id="map-name">${mat.map ? mat.map.name || 'Texture' : 'None'}</span><button id="btn-load-map">Load</button></div></div>
            <div class="props-row"><label>Normal Map</label><div class="props-texture"><span id="normal-name">${mat.normalMap ? mat.normalMap.name || 'Texture' : 'None'}</span><button id="btn-load-normal">Load</button></div></div>
            <div class="props-row"><label>Roughness Map</label><div class="props-texture"><span id="rough-name">${mat.roughnessMap ? mat.roughnessMap.name || 'Texture' : 'None'}</span><button id="btn-load-rough">Load</button></div></div>
            <div class="props-row"><label>Metalness Map</label><div class="props-texture"><span id="metal-name">${mat.metalnessMap ? mat.metalnessMap.name || 'Texture' : 'None'}</span><button id="btn-load-metal">Load</button></div></div>
            <div class="props-row"><label>AO Map</label><div class="props-texture"><span id="ao-name">${mat.aoMap ? mat.aoMap.name || 'Texture' : 'None'}</span><button id="btn-load-ao">Load</button></div></div>
            <div class="props-row"><label>Displacement</label><div class="props-texture"><span id="disp-name">${mat.displacementMap ? mat.displacementMap.name || 'Texture' : 'None'}</span><button id="btn-load-disp">Load</button></div></div>
            <div class="props-stack">
                <label>Displacement Scale</label>
                <input type="range" min="0" max="5" step="0.1" id="props-disp-scale" value="${mat.displacementScale || 1}">
            </div>
            <div class="props-stack">
                <label>UV Repeat</label>
                <div class="props-vector3">
                    <span>X</span><input type="number" step="1" id="props-uv-x" value="${mat.map ? mat.map.repeat.x : 20}">
                    <span>Y</span><input type="number" step="1" id="props-uv-y" value="${mat.map ? mat.map.repeat.y : 20}">
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('props-grid-toggle').onchange = (e) => {
        this.main.gridHelper.visible = e.target.checked;
        this.isGridVisible = e.target.checked;
    };
    document.getElementById('props-terrain-color').oninput = (e) => mat.color.set(e.target.value);
    document.getElementById('props-mat-metal').oninput = (e) => mat.metalness = parseFloat(e.target.value);
    document.getElementById('props-mat-rough').oninput = (e) => mat.roughness = parseFloat(e.target.value);
    
    document.getElementById('btn-load-map').onclick = () => this.texInputMap.click();
    document.getElementById('btn-load-normal').onclick = () => this.texInputNormal.click();
    document.getElementById('btn-load-rough').onclick = () => this.texInputRough.click();
    document.getElementById('btn-load-metal').onclick = () => this.texInputMetal.click();
    document.getElementById('btn-load-ao').onclick = () => this.texInputAO.click();
    document.getElementById('btn-load-disp').onclick = () => this.texInputDisplacement.click();

    this.texInputMap.onchange = (e) => this.handleTextureUpload(e, mat, 'map', true);
    this.texInputNormal.onchange = (e) => this.handleTextureUpload(e, mat, 'normalMap', true);
    this.texInputRough.onchange = (e) => this.handleTextureUpload(e, mat, 'roughnessMap', true);
    this.texInputMetal.onchange = (e) => this.handleTextureUpload(e, mat, 'metalnessMap', true);
    this.texInputAO.onchange = (e) => this.handleTextureUpload(e, mat, 'aoMap', true);
    this.texInputDisplacement.onchange = (e) => this.handleTextureUpload(e, mat, 'displacementMap', true);

    document.getElementById('props-disp-scale').oninput = (e) => mat.displacementScale = parseFloat(e.target.value);
    document.getElementById('props-uv-x').oninput = (e) => this.setMaterialUV(mat, 'x', e.target.value);
    document.getElementById('props-uv-y').oninput = (e) => this.setMaterialUV(mat, 'y', e.target.value);
  }

  // *** MODIFIED: Accept animRoot ***
  bindPropertyPanelEvents(obj, mat, animRoot) {
    // --- Transform ---
    const pX = document.getElementById('props-pos-x');
    const pY = document.getElementById('props-pos-y');
    const pZ = document.getElementById('props-pos-z');
    const pXSlider = document.getElementById('props-pos-x-slider');
    const pYSlider = document.getElementById('props-pos-y-slider');
    const pZSlider = document.getElementById('props-pos-z-slider');
    
    const syncPos = (source, value) => {
        const val = parseFloat(value);
        if (isNaN(val)) return;
        if (source !== 'x-num') pX.value = val.toFixed(2);
        if (source !== 'x-slider') pXSlider.value = val;
        if (source !== 'y-num') pY.value = val.toFixed(2);
        if (source !== 'y-slider') pYSlider.value = val;
        if (source !== 'z-num') pZ.value = val.toFixed(2);
        if (source !== 'z-slider') pZSlider.value = val;
        if (source === 'x-num' || source === 'x-slider') obj.position.x = val;
        if (source === 'y-num' || source === 'y-slider') obj.position.y = val;
        if (source === 'z-num' || source === 'z-slider') obj.position.z = val;
    };

    pX.oninput = (e) => syncPos('x-num', e.target.value);
    pY.oninput = (e) => syncPos('y-num', e.target.value);
    pZ.oninput = (e) => syncPos('z-num', e.target.value);
    pXSlider.oninput = (e) => syncPos('x-slider', e.target.value);
    pYSlider.oninput = (e) => syncPos('y-slider', e.target.value);
    pZSlider.oninput = (e) => syncPos('z-slider', e.target.value);

    document.getElementById('props-rot-x').oninput = (e) => obj.rotation.x = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    document.getElementById('props-rot-y').oninput = (e) => obj.rotation.y = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    document.getElementById('props-rot-z').oninput = (e) => obj.rotation.z = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    
    const sclX = document.getElementById('props-scl-x');
    const sclY = document.getElementById('props-scl-y');
    const sclZ = document.getElementById('props-scl-z');
    const sclUni = document.getElementById('props-scl-uniform');
    
    sclX.oninput = (e) => obj.scale.x = parseFloat(e.target.value);
    sclY.oninput = (e) => obj.scale.y = parseFloat(e.target.value);
    sclZ.oninput = (e) => obj.scale.z = parseFloat(e.target.value);
    
    sclUni.oninput = (e) => {
        const val = parseFloat(e.target.value);
        obj.scale.set(val, val, val);
        sclX.value = val.toFixed(2); sclY.value = val.toFixed(2); sclZ.value = val.toFixed(2);
    };

    // --- Material ---
    if (mat) {
      document.getElementById('props-mat-metal').oninput = (e) => mat.metalness = parseFloat(e.target.value);
      document.getElementById('props-mat-rough').oninput = (e) => mat.roughness = parseFloat(e.target.value);
      document.getElementById('props-uv-x').oninput = (e) => this.setMaterialUV(mat, 'x', e.target.value);
      document.getElementById('props-uv-y').oninput = (e) => this.setMaterialUV(mat, 'y', e.target.value);
      
      document.getElementById('btn-load-map').onclick = () => this.texInputMap.click();
      document.getElementById('btn-load-normal').onclick = () => this.texInputNormal.click();
      document.getElementById('btn-load-rough').onclick = () => this.texInputRough.click();
      document.getElementById('btn-load-metal').onclick = () => this.texInputMetal.click();
      document.getElementById('btn-load-ao').onclick = () => this.texInputAO.click();
      document.getElementById('btn-load-emissive').onclick = () => this.texInputEmissive.click();
      document.getElementById('btn-load-disp').onclick = () => this.texInputDisplacement.click();
      
      this.texInputMap.onchange = (e) => this.handleTextureUpload(e, mat, 'map', false);
      this.texInputNormal.onchange = (e) => this.handleTextureUpload(e, mat, 'normalMap', false);
      this.texInputRough.onchange = (e) => this.handleTextureUpload(e, mat, 'roughnessMap', false);
      this.texInputMetal.onchange = (e) => this.handleTextureUpload(e, mat, 'metalnessMap', false);
      this.texInputAO.onchange = (e) => this.handleTextureUpload(e, mat, 'aoMap', false);
      this.texInputEmissive.onchange = (e) => this.handleTextureUpload(e, mat, 'emissiveMap', false);
      this.texInputDisplacement.onchange = (e) => this.handleTextureUpload(e, mat, 'displacementMap', false);
    }

    // --- Animation ---
    const rootForAnims = animRoot || obj; // Fallback to selected object
    
    document.getElementById('btn-anim-create-new').onclick = () => {
      document.getElementById('anim-creator').style.display = 'flex';
      this.resetAnimCreator();
    };
    document.getElementById('btn-anim-set-pos1').onclick = () => this.setAnimKeyframe(1);
    document.getElementById('btn-anim-set-pos2').onclick = () => this.setAnimKeyframe(2);
    // *** FIX: Pass anim root to save function ***
    document.getElementById('btn-anim-save').onclick = () => this.saveAnimation(rootForAnims);
    
    document.getElementById('anim-list').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            // *** FIX: Pass anim root to test function ***
            this.testAnimation(e.target.dataset.animName, rootForAnims);
        }
    });
  }

  syncPropsFromGizmo() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Object3D) || this.isPanelOpen) return;
    
    const { position, rotation, scale } = this.selectedObject;

    document.getElementById('props-pos-x').value = position.x.toFixed(2);
    document.getElementById('props-pos-y').value = position.y.toFixed(2);
    document.getElementById('props-pos-z').value = position.z.toFixed(2);
    document.getElementById('props-pos-x-slider').value = position.x;
    document.getElementById('props-pos-y-slider').value = position.y;
    document.getElementById('props-pos-z-slider').value = position.z;
    
    document.getElementById('props-rot-x').value = THREE.MathUtils.radToDeg(rotation.x).toFixed(1);
    document.getElementById('props-rot-y').value = THREE.MathUtils.radToDeg(rotation.y).toFixed(1);
    document.getElementById('props-rot-z').value = THREE.MathUtils.radToDeg(rotation.z).toFixed(1);
    
    document.getElementById('props-scl-x').value = scale.x.toFixed(2);
    document.getElementById('props-scl-y').value = scale.y.toFixed(2);
    document.getElementById('props-scl-z').value = scale.z.toFixed(2);
    const uniSlider = document.getElementById('props-scl-uniform');
    if (uniSlider) {
        if (scale.x === scale.y && scale.x === scale.z) {
            uniSlider.value = scale.x.toFixed(2);
        } else {
            uniSlider.value = scale.x.toFixed(2);
        }
    }
  }

  // --- Animation Creator Logic (Updated) ---
  resetAnimCreator() {
    this.animCreatorState = { pos1: null, pos2: null };
    const nameEl = document.getElementById('anim-name');
    if (nameEl) {
        nameEl.value = '';
        document.getElementById('anim-duration').value = 2;
        document.getElementById('anim-pos1-display').textContent = '...';
        document.getElementById('anim-pos2-display').textContent = '...';
    }
  }

  setAnimKeyframe(index) {
    if (!this.selectedObject) return;
    const pos = this.selectedObject.position.clone();
    const displayStr = `X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}, Z: ${pos.z.toFixed(1)}`;
    if (index === 1) {
      this.animCreatorState.pos1 = pos;
      document.getElementById('anim-pos1-display').textContent = displayStr;
    } else {
      this.animCreatorState.pos2 = pos;
      document.getElementById('anim-pos2-display').textContent = displayStr;
    }
  }

  // *** MODIFIED: Accept rootObject ***
  saveAnimation(rootObject) {
    const { pos1, pos2 } = this.animCreatorState;
    const name = document.getElementById('anim-name').value;
    const duration = parseFloat(document.getElementById('anim-duration').value);

    if (!pos1 || !pos2) { this.main.debugger.warn('Set both start and end positions.', 'Animation'); return; }
    if (!name) { this.main.debugger.warn('Enter an animation name.', 'Animation'); return; }
    if (isNaN(duration) || duration <= 0) { this.main.debugger.warn('Enter a valid duration.', 'Animation'); return; }

    const times = [0, duration];
    const values = [pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z];
    // This animation will be relative to the parent of the *selected object*
    const posTrack = new THREE.VectorKeyframeTrack('.position', times, values);
    const clip = new THREE.AnimationClip(name, -1, [posTrack]);

    if (!rootObject.userData.animations) {
      rootObject.userData.animations = [];
    }
    rootObject.userData.animations.push(clip);

    document.getElementById('anim-creator').style.display = 'none';
    this.updatePropertyPanel(this.selectedObject); // Refresh panel
    this.buildSceneTree(); // Refresh scene tree to show new anim
    this.main.debugger.log(`Animation '${name}' saved.`);
  }

  // *** MODIFIED: Accept rootObject ***
  testAnimation(animName, rootObject) {
    if (!rootObject || !rootObject.userData.animations) {
        this.main.debugger.warn(`No animations found on root object.`, 'Animation');
        return;
    }
    const clip = THREE.AnimationClip.findByName(rootObject.userData.animations, animName);
    if (!clip) { this.main.debugger.warn(`Animation '${animName}' not found.`, 'Animation'); return; }

    // Use the mixer on the root object
    if (!rootObject.mixer) {
      rootObject.mixer = new THREE.AnimationMixer(rootObject);
    }
    
    // Find the specific object this animation targets
    // For now, we assume it targets the selected object
    // A more robust system would store the target's name in the clip
    const targetObject = this.selectedObject;
    if (!targetObject) return;

    // We need to find the clip action on the *root* mixer,
    // but the clip itself contains the track for the *child*
    // This is complex. A simpler way is to put the mixer on the object itself.
    
    // *** RE-THINK: The animation should be played on the object it applies to.
    // The *clip* is stored on the root, but the *mixer* should be on the
    // object being animated.
    
    const animatedObj = this.selectedObject; // We assume the anim applies to the selected obj
    
    if (!animatedObj.mixer) {
      animatedObj.mixer = new THREE.AnimationMixer(animatedObj);
    }
    
    animatedObj.mixer.stopAllAction();
    const action = animatedObj.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
  }
  
  // --- Material/Texture Logic ---
  handleTextureUpload(event, material, mapType, isTerrain = false) {
    // ... (This function is unchanged) ...
    const file = event.target.files[0];
    if (!file) return;
    this.fileReader.onload = (e) => {
      this.textureLoader.load(e.target.result, (texture) => {
        texture.name = file.name;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const repeatVal = isTerrain ? 20 : 1;
        texture.repeat.set(repeatVal, repeatVal);
        
        material[mapType] = texture;
        material.needsUpdate = true;
        
        this.updatePropertyPanel(this.selectedObject);
      });
    };
    this.fileReader.readAsDataURL(file);
    event.target.value = null;
  }
  
  setMaterialUV(material, axis, value) {
    // ... (This function is unchanged) ...
    const val = parseFloat(value);
    if (isNaN(val)) return;
    
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'displacementMap', 'emissiveMap'].forEach(mapType => {
        if (material[mapType]) {
            material[mapType].repeat[axis] = val;
            material[mapType].needsUpdate = true;
        }
    });
  }
}
