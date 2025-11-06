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
      parentObject: null
    };

    // NEW: State for Animation Creator
    this.animCreatorState = {
      pos1: null,
      pos2: null
    };

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
    this.parentButton = document.getElementById('btn-parent-object');
    this.propsContent = document.getElementById('props-content');
    this.assetList = document.getElementById('asset-list');
    this.modelFileInput = document.getElementById('file-input-model');
    this.uploadModelButton = document.getElementById('btn-upload-model');

    this.sunSlider = document.getElementById('sun-slider');
    this.gridToggle = document.getElementById('grid-toggle');
    
    this.texInputMap = document.getElementById('texture-input-map');
    this.texInputNormal = document.getElementById('texture-input-normal');
    this.texInputMetal = document.getElementById('texture-input-metal');
    this.texInputRough = document.getElementById('texture-input-rough');
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = true;
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls);

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

    this.parentButton.addEventListener('click', () => this.startParenting());
    this.sceneTreeView.addEventListener('click', (e) => this.onSceneTreeClick(e));

    this.assetList.addEventListener('click', (e) => this.onAssetClick(e));
    this.uploadModelButton.addEventListener('click', () => this.modelFileInput.click());
    this.modelFileInput.addEventListener('change', (e) => this.onFileUpload(e));

    this.sunSlider.addEventListener('input', (e) => this.main.updateSun(e.target.value));
    this.main.updateSun(this.sunSlider.value);
    this.gridToggle.addEventListener('change', (e) => {
      this.main.gridHelper.visible = e.target.checked;
    });

    document.getElementById('tex-grey').onclick = () => this.main.setTerrainColor(0x555555);
    document.getElementById('tex-grass').onclick = () => this.main.setTerrainTexture('src/assets/textures/grass.jpg');
    document.getElementById('tex-sand').onclick = () => this.main.setTerrainTexture('src/assets/textures/sand.jpg');
    document.getElementById('tex-concrete').onclick = () => this.main.setTerrainTexture('src/assets/textures/concrete.jpg');
    
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
    if (this.selectedObject) {
      this.transformControls.attach(this.selectedObject);
    }
    this.main.controls.setPaused(true);
    this.main.gridHelper.visible = this.gridToggle.checked;
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
      this.transformControls.showX = false;
      this.transformControls.showY = false;
      this.transformControls.showZ = false;
    } else {
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
  buildSceneTree() {
    this.sceneTreeView.innerHTML = '';
    const buildNode = (obj, depth = 0) => {
      const item = document.createElement('div');
      item.className = 'scene-tree-item';
      if (depth > 0) item.classList.add('child');
      item.textContent = obj.name || obj.type;
      item.dataset.uuid = obj.uuid;
      if (this.selectedObject && obj.uuid === this.selectedObject.uuid) {
        item.classList.add('selected');
      }
      this.sceneTreeView.appendChild(item);
      obj.children.forEach(child => buildNode(child, depth + 1));
    };
    this.world.children.forEach(child => buildNode(child));
  }

  onSceneTreeClick(event) {
    const item = event.target.closest('.scene-tree-item');
    if (!item) return;
    const uuid = item.dataset.uuid;
    const object = this.world.getObjectByProperty('uuid', uuid); 
    if (object) {
      if (this.parentingState.isWaiting) {
        this.completeParenting(object);
      } else {
        this.selectObject(object);
      }
    }
  }
  
  startParenting() {
    if (!this.selectedObject) return;
    this.parentingState.isWaiting = true;
    this.parentingState.parentObject = this.selectedObject;
    this.parentButton.textContent = 'Cancel Parenting';
    this.parentButton.style.background = '#ff3b30';
  }
  
  completeParenting(childObject) {
    if (!this.parentingState.parentObject || childObject === this.parentingState.parentObject) {
      this.cancelParenting();
      return;
    }
    this.parentingState.parentObject.attach(childObject);
    this.cancelParenting();
    this.buildSceneTree();
    this.selectObject(childObject);
  }
  
  cancelParenting() {
    this.parentingState.isWaiting = false;
    this.parentingState.parentObject = null;
    this.parentButton.textContent = 'Set as Parent';
    this.parentButton.style.background = '';
    this.parentButton.disabled = (this.selectedObject === null);
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
      this.completeParenting(hit);
    } else {
      this.selectObject(hit);
    }
  }

  selectObject(obj) {
    if (this.selectedObject === obj) return;
    this.selectedObject = obj;
    if (obj) {
      this.transformControls.attach(obj);
    } else {
      this.transformControls.detach();
    }
    this.cancelParenting();
    this.updatePropertyPanel(obj);
    this.buildSceneTree();
  }
  
  deleteSelected() {
    if (!this.selectedObject) return;
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
   * Rebuilds the Property Panel for the selected object
   */
  updatePropertyPanel(obj) {
    if (!obj) {
      this.propsContent.innerHTML = '<p>No object selected.</p>';
      return;
    }

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
      
      ${mat ? `
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
        <label>UV Repeat X</label>
        <input type="number" step="0.1" id="props-uv-x" value="${mat.map ? mat.map.repeat.x : 1}">
        <label>UV Repeat Y</label>
        <input type="number" step="0.1" id="props-uv-y" value="${mat.map ? mat.map.repeat.y : 1}">
      </div>
      ` : ''}

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

    this.bindPropertyPanelEvents(obj, mat);
  }

  /**
   * Binds update events to the dynamically created property panel
   */
  bindPropertyPanelEvents(obj, mat) {
    document.getElementById('props-pos-x').oninput = (e) => obj.position.x = parseFloat(e.target.value);
    document.getElementById('props-pos-y').oninput = (e) => obj.position.y = parseFloat(e.target.value);
    document.getElementById('props-pos-z').oninput = (e) => obj.position.z = parseFloat(e.target.value);
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
        sclX.value = val.toFixed(2);
        sclY.value = val.toFixed(2);
        sclZ.value = val.toFixed(2);
    };

    if (mat) {
      document.getElementById('props-mat-metal').oninput = (e) => mat.metalness = parseFloat(e.target.value);
      document.getElementById('props-mat-rough').oninput = (e) => mat.roughness = parseFloat(e.target.value);
      document.getElementById('props-uv-x').oninput = (e) => this.setMaterialUV(mat, 'x', e.target.value);
      document.getElementById('props-uv-y').oninput = (e) => this.setMaterialUV(mat, 'y', e.target.value);
      document.getElementById('btn-load-map').onclick = () => this.texInputMap.click();
      document.getElementById('btn-load-normal').onclick = () => this.texInputNormal.click();
      this.texInputMap.onchange = (e) => this.handleTextureUpload(e, mat, 'map');
      this.texInputNormal.onchange = (e) => this.handleTextureUpload(e, mat, 'normalMap');
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

  /**
   * Updates the input sliders when the gizmo is moved
   */
  syncPropsFromGizmo() {
    if (!this.selectedObject) return;
    const { position, rotation, scale } = this.selectedObject;

    document.getElementById('props-pos-x').value = position.x.toFixed(2);
    document.getElementById('props-pos-y').value = position.y.toFixed(2);
    document.getElementById('props-pos-z').value = position.z.toFixed(2);
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
    document.getElementById('anim-name').value = '';
    document.getElementById('anim-duration').value = 2;
    document.getElementById('anim-pos1-display').textContent = '...';
    document.getElementById('anim-pos2-display').textContent = '...';
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

    if (!pos1 || !pos2) {
      this.main.debugger.warn('Set both start and end positions.', 'Animation');
      return;
    }
    if (!name) {
      this.main.debugger.warn('Enter an animation name.', 'Animation');
      return;
    }
    if (isNaN(duration) || duration <= 0) {
      this.main.debugger.warn('Enter a valid duration.', 'Animation');
      return;
    }

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
    if (!clip) {
      this.main.debugger.warn(`Animation '${animName}' not found.`, 'Animation');
      return;
    }

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
        document.getElementById(mapType === 'map' ? 'map-name' : 'normal-name').textContent = file.name;
      });
    };
    this.fileReader.readAsDataURL(file);
    event.target.value = null;
  }
  
  setMaterialUV(material, axis, value) {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(mapType => {
        if (material[mapType]) {
            material[mapType].repeat[axis] = val;
            material[mapType].needsUpdate = true;
        }
    });
  }
}
