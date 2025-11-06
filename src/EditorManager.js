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

    this.parentingState = {
      isWaiting: false,
      childToMove: null
    };
    this.animCreatorState = { pos1: null, pos2: null };
    
    // Store time of day to fix bug
    this.timeOfDay = 50; 
    // Store grid state
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
    this.toolbar = document.getElementById('editor-toolbar');
    
    this.tabBar = document.querySelector('.tab-bar');
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');

    this.sceneTreeView = document.getElementById('scene-tree-view');
    this.parentButton = document.getElementById('btn-child-to');
    
    this.propsContent = document.getElementById('props-content');
    this.assetList = document.getElementById('asset-list');
    this.modelFileInput = document.getElementById('file-input-model');
    this.uploadModelButton = document.getElementById('btn-upload-model');
    
    // Bind all texture inputs
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

    // *** FIX: Listen for dragging-changed to disable camera ***
    this.transformControls.addEventListener('dragging-changed', (event) => {
        this.orbitControls.enabled = !event.value;
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
    this.tabBar.addEventListener('click', (e) => this.onTabClick(e));
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);
    
    this.parentButton.addEventListener('click', () => this.startChildingProcess());
    this.sceneTreeView.addEventListener('click', (e) => this.onSceneTreeClick(e));

    this.assetList.addEventListener('click', (e) => this.onAssetClick(e));
    this.uploadModelButton.addEventListener('click', () => this.modelFileInput.click());
    this.modelFileInput.addEventListener('change', (e) => this.onFileUpload(e));
    
    document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());
  }

  // --- Game Mode Logic ---
  enterGameMode() {
    this.state = 'GAME';
    this.appContainer.classList.add('game-mode-active');
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
    this.orbitControls.enabled = true;
    if (this.selectedObject instanceof THREE.Object3D) {
      this.transformControls.attach(this.selectedObject);
    }
    this.main.controls.setPaused(true);
    this.main.gridHelper.visible = this.isGridVisible;
    
    this.camera.position.set(25, 25, 25);
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();
    this.main.onWindowResize();
  }

  // --- UI Event Handlers ---
  onTabClick(event) {
    const button = event.target.closest('button.tab-button');
    if (!button) return;
    const tabId = button.dataset.tab;
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(tabId).classList.add('active');
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
    if (isCollapsible) arrow.textContent = '►';
    
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
    
    const buildModelNode = (obj) => {
        const hasAnims = obj.userData.animations && obj.userData.animations.length > 0;
        const hasChildren = obj.children.length > 0;
        const isCollapsible = hasChildren || hasAnims;
        
        const item = document.createElement('div');
        item.className = 'tree-item';
        if (isCollapsible) item.classList.add('collapsible');
        item.dataset.uuid = obj.uuid;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        if (isCollapsible) arrow.textContent = '►';
        
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
            obj.children.forEach(child => childrenContainer.appendChild(buildModelNode(child)));
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
        const object = this.world.getObjectByProperty('uuid', uuid);
        if (object) {
            if (this.parentingState.isWaiting) {
                this.completeChildingProcess(object);
            } else {
                this.selectObject(object);
            }
        }
    } else if (special) {
        if (this.parentingState.isWaiting) {
            this.main.debugger.warn("Cannot parent an object to World settings.", "Parenting");
            this.cancelChildingProcess();
        } else {
            this.selectObject(special);
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
  }
  
  completeChildingProcess(newParent) {
    const childToMove = this.parentingState.childToMove;
    if (!childToMove || newParent === childToMove) {
      this.cancelChildingProcess();
      return;
    }
    
    newParent.attach(childToMove);
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
    if (this.state !== 'EDITOR' || this.transformControls.dragging) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objectsToIntersect = [...this.world.children, this.main.terrain];
    const intersects = this.raycaster.intersectObjects(objectsToIntersect, true);
    
    let hit = null;
    for (const i of intersects) {
      if (i.object.userData.__isTerrain) {
          hit = null;
          break; 
      }
      if (i.object.isMesh) {
        let rootObject = i.object;
        while (rootObject.parent && rootObject.parent !== this.world) {
          rootObject = rootObject.parent;
        }
        hit = rootObject;
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
      this.onTabClick({ target: document.querySelector('button[data-tab="tab-properties"]') });
    } else {
      this.transformControls.detach();
    }
    this.cancelChildingProcess();
    this.updatePropertyPanel(obj);
    this.buildSceneTree();
  }
  
  deleteSelected() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Object3D)) return;
    const obj = this.selectedObject;
    this.selectObject(null);
    obj.removeFromParent();
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material?.dispose();
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
    obj.traverse(child => { if (child.isMesh) mesh = child; });
    const mat = mesh ? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) : null;
    
    const anims = obj.userData.animations || [];
    const animListHTML = anims.map(anim => `
      <div class="animation-list-item">
        <span>${anim.name}</span>
        <button data-anim-name="${anim.name}">Test</button>
      </div>
    `).join('');

    this.propsContent.innerHTML = `
      <strong>${obj.name || obj.type}</strong>
      
      <div class="props-group">
        <h5>Transform</h5>
        <label>Position</label>
        <div class="props-vector3">
          <span>X</span><input type="number" step="0.1" id="props-pos-x" value="${pos.x.toFixed(2)}">
          <span>Y</span><input type="number" step="0.1" id="props-pos-y" value="${pos.y.toFixed(2)}">
          <span>Z</span><input type="number" step="0.1" id="props-pos-z" value="${pos.z.toFixed(2)}">
        </div>
        
        <label></label>
        <div class="props-slider">
          <span>X</span><input type="range" min="-50" max="50" step="0.1" id="props-pos-x-slider" value="${pos.x.toFixed(2)}">
        </div>
        <label></label>
        <div class="props-slider">
          <span>Y</span><input type="range" min="0" max="50" step="0.1" id="props-pos-y-slider" value="${pos.y.toFixed(2)}">
        </div>
        <label></label>
        <div class="props-slider">
          <span>Z</span><input type="range" min="-50" max="50" step="0.1" id="props-pos-z-slider" value="${pos.z.toFixed(2)}">
        </div>

        <label>Rotation</label>
        <div class="props-vector3">
          <span>X</span><input type="number" step="1" id="props-rot-x" value="${THREE.MathUtils.radToDeg(rot.x).toFixed(1)}">
          <span>Y</span><input type="number" step="1" id="props-rot-y" value="${THREE.MathUtils.radToDeg(rot.y).toFixed(1)}">
          <span>Z</span><input type="number" step="1" id="props-rot-z" value="${THREE.MathUtils.radToDeg(rot.z).toFixed(1)}">
        </div>
        <label>Scale (Non-Uniform)</label>
        <div class="props-vector3">
          <span>X</span><input type="number" step="0.05" id="props-scl-x" value="${scl.x.toFixed(2)}">
          <span>Y</span><input type="number" step="0.05" id="props-scl-y" value="${scl.y.toFixed(2)}">
          <span>Z</span><input type="number" step="0.05" id="props-scl-z" value="${scl.z.toFixed(2)}">
        </div>
        <label>Scale (Uniform)</label>
        <input type="range" min="0.01" max="5" step="0.01" id="props-scl-uniform" value="${scl.x.toFixed(2)}">
      </div>
      
      ${mat ? `... (Material HTML) ...` : ''}
      ... (Animation HTML) ...
    `;
    
    // *** MODIFIED: Added all PBR map types ***
    const matHTML = mat ? `
      <div class="props-group">
        <h5>Material (PBR)</h5>
        <label>Metalness</label>
        <input type="range" min="0" max="1" step="0.01" id="props-mat-metal" value="${mat.metalness || 0}">
        <label>Roughness</label>
        <input type="range" min="0" max="1" step="0.01" id="props-mat-rough" value="${mat.roughness || 0}">
        
        <label>Albedo Map</label>
        <div class="props-texture">
          <span id="map-name">${mat.map ? mat.map.name || 'Texture' : 'None'}</span>
          <button id="btn-load-map">Load</button>
        </div>
        <label>Normal Map</label>
        <div class="props-texture">
          <span id="normal-name">${mat.normalMap ? mat.normalMap.name || 'Texture' : 'None'}</span>
          <button id="btn-load-normal">Load</button>
        </div>
        <label>Roughness Map</label>
        <div class="props-texture">
          <span id="rough-name">${mat.roughnessMap ? mat.roughnessMap.name || 'Texture' : 'None'}</span>
          <button id="btn-load-rough">Load</button>
        </div>
        <label>Metalness Map</label>
        <div class="props-texture">
          <span id="metal-name">${mat.metalnessMap ? mat.metalnessMap.name || 'Texture' : 'None'}</span>
          <button id="btn-load-metal">Load</button>
        </div>
        <label>AO Map</label>
        <div class="props-texture">
          <span id="ao-name">${mat.aoMap ? mat.aoMap.name || 'Texture' : 'None'}</span>
          <button id="btn-load-ao">Load</button>
        </div>
        <label>Emissive Map</label>
        <div class="props-texture">
          <span id="emissive-name">${mat.emissiveMap ? mat.emissiveMap.name || 'Texture' : 'None'}</span>
          <button id="btn-load-emissive">Load</button>
        </div>
        
        <label>UV Repeat X</label>
        <input type="number" step="0.1" id="props-uv-x" value="${mat.map ? mat.map.repeat.x : 1}">
        <label>UV Repeat Y</label>
        <input type="number" step="0.1" id="props-uv-y" value="${mat.map ? mat.map.repeat.y : 1}">
      </div>
    ` : '';

    const animHTML = `
      <div class="props-group">
        <h5>Animations</h5>
        <div class="animation-list" id="anim-list">${animListHTML}</div>
        <button id="btn-anim-create-new" style="margin-top: 10px;">Create New Animation</button>
        <div class="animation-creator" id="anim-creator" style="display: none;">
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

    this.bindPropertyPanelEvents(obj, mat);
  }

  // --- PANEL BUILDER: SKY ---
  buildSkyPanel() {
    const sky = this.main.sky;
    const sunLight = this.main.sunLight;
    
    // *** FIX: Read from this.timeOfDay, not a non-existent element ***
    this.propsContent.innerHTML = `
        <strong>Sky Settings</strong>
        <div class="props-group">
            <h5>Sky Colors</h5>
            <label>Top Color</label>
            <input type="color" id="props-sky-top" value="${'#' + sky.material.uniforms.topColor.value.getHexString()}">
            <label>Bottom Color</label>
            <input type="color" id="props-sky-bottom" value="${'#' + sky.material.uniforms.bottomColor.value.getHexString()}">
            
            <h5>Sun</h5>
            <label>Sun Color</label>
            <input type="color" id="props-sun-color" value="${'#' + sunLight.color.getHexString()}">
            <label>Sun Intensity</label>
            <input type="range" min="0" max="5" step="0.1" id="props-sun-intensity" value="${sunLight.intensity}">
            <label>Time of Day</label>
            <input type="range" min="0" max="100" step="1" id="props-sun-slider" value="${this.timeOfDay}">
        </div>
    `;
    
    // Bind Events
    document.getElementById('props-sky-top').oninput = (e) => sky.material.uniforms.topColor.value.set(e.target.value);
    document.getElementById('props-sky-bottom').oninput = (e) => sky.material.uniforms.bottomColor.value.set(e.target.value);
    document.getElementById('props-sun-color').oninput = (e) => sunLight.color.set(e.target.value);
    document.getElementById('props-sun-intensity').oninput = (e) => sunLight.intensity = parseFloat(e.target.value);
    
    // *** FIX: Update this.timeOfDay when slider moves ***
    document.getElementById('props-sun-slider').oninput = (e) => {
        const val = e.target.value;
        this.main.updateSun(val);
        this.timeOfDay = val; // Store the new value
    };
  }
  
  // --- PANEL BUILDER: LIGHTING ---
  buildLightPanel() {
    const sunLight = this.main.sunLight;
    const hemiLight = this.main.hemiLight;
    const pos = sunLight.position;
    
    this.propsContent.innerHTML = `
        <strong>Global Lighting</strong>
        <div class="props-group">
            <h5>Sun Light (Directional)</h5>
            <label>Sun Color</label>
            <input type="color" id="props-sun-color" value="${'#' + sunLight.color.getHexString()}">
            <label>Sun Intensity</label>
            <input type="range" min="0" max="5" step="0.1" id="props-sun-intensity" value="${sunLight.intensity}">

            <label>Sun Position</label>
            <div class="props-vector3">
              <span>X</span><input type="number" step="1" id="props-pos-x" value="${pos.x.toFixed(0)}">
              <span>Y</span><input type="number" step="1" id="props-pos-y" value="${pos.y.toFixed(0)}">
              <span>Z</span><input type="number" step="1" id="props-pos-z" value="${pos.z.toFixed(0)}">
            </div>

            <h5>Ambient Light (Hemisphere)</h5>
            <label>Sky Color</label>
            <input type="color" id="props-hemi-sky" value="${'#' + hemiLight.color.getHexString()}">
            <label>Ground Color</label>
            <input type="color" id="props-hemi-ground" value="${'#' + hemiLight.groundColor.getHexString()}">
            <label>Ambient Intensity</label>
            <input type="range" min="0" max="3" step="0.05" id="props-hemi-intensity" value="${hemiLight.intensity}">
        </div>
    `;
    
    // Bind Events
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
    const terrainMesh = this.main.terrainMesh;
    if (!terrainMesh) return;
    const mat = terrainMesh.material;
    
    this.propsContent.innerHTML = `
        <strong>Terrain Settings</strong>
        <div class="props-group">
            <h5>General</h5>
            <label>Grid</label>
            <input type="checkbox" id="props-grid-toggle" ${this.main.gridHelper.visible ? 'checked' : ''}>
            
            <h5>Material</h5>
            <label>Base Color</label>
            <input type="color" id="props-terrain-color" value="${'#' + mat.color.getHexString()}">
            <label>Metalness</label>
            <input type="range" min="0" max="1" step="0.01" id="props-mat-metal" value="${mat.metalness || 0}">
            <label>Roughness</label>
            <input type="range" min="0" max="1" step="0.01" id="props-mat-rough" value="${mat.roughness || 0}">

            <h5>Textures</h5>
            <label>Albedo Map</label>
            <div class="props-texture">
              <span id="map-name">${mat.map ? mat.map.name || 'Texture' : 'None'}</span>
              <button id="btn-load-map">Load</button>
            </div>
            <label>Normal Map</label>
            <div class="props-texture">
              <span id="normal-name">${mat.normalMap ? mat.normalMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-normal">Load</button>
            </div>
            <label>Roughness Map</label>
            <div class="props-texture">
              <span id="rough-name">${mat.roughnessMap ? mat.roughnessMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-rough">Load</button>
            </div>
            <label>Metalness Map</label>
            <div class="props-texture">
              <span id="metal-name">${mat.metalnessMap ? mat.metalnessMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-metal">Load</button>
            </div>
            <label>AO Map</label>
            <div class="props-texture">
              <span id="ao-name">${mat.aoMap ? mat.aoMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-ao">Load</button>
            </div>
            <label>Displacement</label>
            <div class="props-texture">
              <span id="disp-name">${mat.displacementMap ? mat.displacementMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-disp">Load</button>
            </div>
            <label>Disp. Scale</label>
            <input type="range" min="0" max="5" step="0.1" id="props-disp-scale" value="${mat.displacementScale || 1}">
            
            <label>Emissive Map</label>
            <div class="props-texture">
              <span id="emissive-name">${mat.emissiveMap ? mat.emissiveMap.name || 'Texture' : 'None'}</span>
              <button id="btn-load-emissive">Load</button>
            </div>

            <label>UV Repeat X</label>
            <input type="number" step="0.1" id="props-uv-x" value="${mat.map ? mat.map.repeat.x : 1}">
            <label>UV Repeat Y</label>
            <input type="number" step="0.1" id="props-uv-y" value="${mat.map ? mat.map.repeat.y : 1}">
        </div>
    `;
    
    // Bind Events
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
    document.getElementById('btn-load-emissive').onclick = () => this.texInputEmissive.click();

    this.texInputMap.onchange = (e) => this.handleTextureUpload(e, mat, 'map');
    this.texInputNormal.onchange = (e) => this.handleTextureUpload(e, mat, 'normalMap');
    this.texInputRough.onchange = (e) => this.handleTextureUpload(e, mat, 'roughnessMap');
    this.texInputMetal.onchange = (e) => this.handleTextureUpload(e, mat, 'metalnessMap');
    this.texInputAO.onchange = (e) => this.handleTextureUpload(e, mat, 'aoMap');
    this.texInputDisplacement.onchange = (e) => this.handleTextureUpload(e, mat, 'displacementMap');
    this.texInputEmissive.onchange = (e) => this.handleTextureUpload(e, mat, 'emissiveMap');

    document.getElementById('props-disp-scale').oninput = (e) => mat.displacementScale = parseFloat(e.target.value);
    document.getElementById('props-uv-x').oninput = (e) => this.setMaterialUV(mat, 'x', e.target.value);
    document.getElementById('props-uv-y').oninput = (e) => this.setMaterialUV(mat, 'y', e.target.value);
  }

  bindPropertyPanelEvents(obj, mat) {
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
      
      this.texInputMap.onchange = (e) => this.handleTextureUpload(e, mat, 'map');
      this.texInputNormal.onchange = (e) => this.handleTextureUpload(e, mat, 'normalMap');
      this.texInputRough.onchange = (e) => this.handleTextureUpload(e, mat, 'roughnessMap');
      this.texInputMetal.onchange = (e) => this.handleTextureUpload(e, mat, 'metalnessMap');
      this.texInputAO.onchange = (e) => this.handleTextureUpload(e, mat, 'aoMap');
      this.texInputEmissive.onchange = (e) => this.handleTextureUpload(e, mat, 'emissiveMap');
    }

    document.getElementById('btn-anim-create-new').onclick = () => {
      document.getElementById('anim-creator').style.display = 'flex';
      this.resetAnimCreator();
    };
    document.getElementById('btn-anim-set-pos1').onclick = () => this.setAnimKeyframe(1);
    document.getElementById('btn-anim-set-pos2').onclick = () => this.setAnimKeyframe(2);
    document.getElementById('btn-anim-save').onclick = () => this.saveAnimation();
    
    document.getElementById('anim-list').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            this.testAnimation(e.target.dataset.animName);
        }
    });
  }

  syncPropsFromGizmo() {
    if (!this.selectedObject || !(this.selectedObject instanceof THREE.Object3D)) return;
    
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
    if (scale.x === scale.y && scale.x === scale.z) {
        uniSlider.value = scale.x.toFixed(2);
    } else {
        uniSlider.value = scale.x.toFixed(2);
    }
  }

  // --- Animation Creator Logic ---
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

  saveAnimation() {
    const { pos1, pos2 } = this.animCreatorState;
    const name = document.getElementById('anim-name').value;
    const duration = parseFloat(document.getElementById('anim-duration').value);

    if (!pos1 || !pos2) { this.main.debugger.warn('Set both start and end positions.', 'Animation'); return; }
    if (!name) { this.main.debugger.warn('Enter an animation name.', 'Animation'); return; }
    if (isNaN(duration) || duration <= 0) { this.main.debugger.warn('Enter a valid duration.', 'Animation'); return; }

    const times = [0, duration];
    const values = [pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z];
    const posTrack = new THREE.VectorKeyframeTrack('.position', times, values);
    const clip = new THREE.AnimationClip(name, -1, [posTrack]);

    if (!this.selectedObject.userData.animations) {
      this.selectedObject.userData.animations = [];
    }
    this.selectedObject.userData.animations.push(clip);

    document.getElementById('anim-creator').style.display = 'none';
    this.updatePropertyPanel(this.selectedObject);
    this.main.debugger.log(`Animation '${name}' saved.`);
  }

  testAnimation(animName) {
    if (!this.selectedObject || !this.selectedObject.userData.animations) return;
    const clip = THREE.AnimationClip.findByName(this.selectedObject.userData.animations, animName);
    if (!clip) { this.main.debugger.warn(`Animation '${animName}' not found.`, 'Animation'); return; }

    if (!this.selectedObject.mixer) {
      this.selectedObject.mixer = new THREE.AnimationMixer(this.selectedObject);
    }
    
    this.selectedObject.mixer.stopAllAction();
    const action = this.selectedObject.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
  }
  
  // --- Material/Texture Logic ---
  handleTextureUpload(event, material, mapType) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileReader.onload = (e) => {
      this.textureLoader.load(e.target.result, (texture) => {
        texture.name = file.name;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        material[mapType] = texture;
        material.needsUpdate = true;
        
        // *** MODIFIED: Find all possible span IDs ***
        let spanId;
        if (mapType === 'map') spanId = 'map-name';
        else if (mapType === 'normalMap') spanId = 'normal-name';
        else if (mapType === 'displacementMap') spanId = 'disp-name';
        else if (mapType === 'roughnessMap') spanId = 'rough-name';
        else if (mapType === 'metalnessMap') spanId = 'metal-name';
        else if (mapType === 'aoMap') spanId = 'ao-name';
        else if (mapType === 'emissiveMap') spanId = 'emissive-name';
        
        if (spanId && document.getElementById(spanId)) {
          document.getElementById(spanId).textContent = file.name;
        }
      });
    };
    this.fileReader.readAsDataURL(file);
    event.target.value = null;
  }
  
  setMaterialUV(material, axis, value) {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    
    // *** MODIFIED: Include all map types ***
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'displacementMap', 'emissiveMap'].forEach(mapType => {
        if (material[mapType]) {
            material[mapType].repeat[axis] = val;
            material[mapType].needsUpdate = true;
        }
    });
  }
}
