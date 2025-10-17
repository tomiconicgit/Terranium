// src/ui/Highlighter.js
// Camera-look tile highlighter with lock & copy selection.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class HighlighterUI {
  /**
   * @param {{scene:THREE.Scene, camera:THREE.Camera, terrainGroup:THREE.Group, debugger:any}} deps
   */
  constructor({ scene, camera, terrainGroup, debugger: dbg }) {
    this.scene = scene;
    this.camera = camera;
    this.terrainGroup = terrainGroup;
    this.debugger = dbg;

    this.active = false;
    this.tileSize = 1.0;  // meters per tile
    this.hoverMesh = null;
    this.selection = [];  // [{i,j,y}]
    this.selectionMeshes = [];
    this.raycaster = new THREE.Raycaster();

    this.terrainTargets = this._collectTerrainMeshes();

    this._buildUI();
  }

  _collectTerrainMeshes() {
    // Same rule used in Main.js
    return this.terrainGroup.children.filter(
      c => c.name === "sand_terrain" || c.geometry?.type === "PlaneGeometry"
    );
  }

  _buildUI() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for Highlighter.'), 'Init');
      return;
    }

    // Toggle button next to "Engines"
    const btn = document.createElement('button');
    btn.id = 'highlighter-btn';
    btn.textContent = 'Highlight';
    btn.title = 'Toggle tile highlighter';
    btn.onclick = () => this.toggle();
    container.appendChild(btn);
    this.button = btn;

    // Panel (appears when active)
    const panel = document.createElement('div');
    panel.id = 'highlighter-panel';
    panel.classList.add('no-look');
    panel.style.cssText = `
      position:fixed; top:80px; left:390px; z-index:10; background:rgba(30,30,36,0.90);
      color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:260px; padding:12px; display:none; box-shadow:0 5px 15px rgba(0,0,0,0.35);
      backdrop-filter:blur(8px); -webkit-overflow-scrolling: touch; touch-action: pan-y;`;

    panel.innerHTML = `
      <h4 style="margin:0 0 10px;border-bottom:1px solid #444;padding-bottom:6px;">Highlighter</h4>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button id="hl-lock" style="flex:1;">Lock Tile</button>
        <button id="hl-clear" style="flex:1;">Clear</button>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="hl-copy" style="flex:1;">Copy Selection</button>
        <button id="hl-close" style="flex:1;">Close</button>
      </div>
      <p id="hl-status" style="margin:8px 0 0; font-size:.9em; color:#ccc;">Tiles: 0</p>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector('#hl-lock').onclick = () => this.lockCurrentTile();
    panel.querySelector('#hl-clear').onclick = () => this.clearSelection();
    panel.querySelector('#hl-copy').onclick = () => this.copySelection();
    panel.querySelector('#hl-close').onclick = () => this.toggle(false);
  }

  toggle(force) {
    const next = (typeof force === 'boolean') ? force : !this.active;
    this.active = next;
    this.panel.style.display = this.active ? 'block' : 'none';
    this.button.style.backgroundColor = this.active ? 'rgba(79,143,247,0.9)' : 'rgba(30,30,36,0.8)';

    if (this.active) {
      if (!this.hoverMesh) this._createHoverMesh();
    } else {
      if (this.hoverMesh) { this.scene.remove(this.hoverMesh); this.hoverMesh = null; }
    }
  }

  _createHoverMesh() {
    const g = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    const m = new THREE.MeshBasicMaterial({ color: 0x49a4ff, transparent: true, opacity: 0.45 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 9999;
    mesh.position.y = 0.02;
    mesh.matrixAutoUpdate = true;
    this.scene.add(mesh);
    this.hoverMesh = mesh;
  }

  _makeLockedMesh(i, j, y) {
    const g = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    const m = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((i + 0.5) * this.tileSize, y + 0.02, (j + 0.5) * this.tileSize);
    mesh.renderOrder = 9998;
    this.scene.add(mesh);
    return mesh;
  }

  _intersectGround() {
    // Ray from camera forward
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    const hits = this.raycaster.intersectObjects(this.terrainTargets, true);
    return hits[0] || null;
    }

  update() {
    if (!this.active || !this.hoverMesh) return;
    const hit = this._intersectGround();
    if (!hit) { this.hoverMesh.visible = false; return; }

    const p = hit.point;
    const i = Math.floor(p.x / this.tileSize);
    const j = Math.floor(p.z / this.tileSize);

    // Center of the tile
    const cx = (i + 0.5) * this.tileSize;
    const cz = (j + 0.5) * this.tileSize;

    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(cx, p.y + 0.02, cz);
  }

  lockCurrentTile() {
    const hit = this._intersectGround();
    if (!hit) return;
    const p = hit.point;
    const i = Math.floor(p.x / this.tileSize);
    const j = Math.floor(p.z / this.tileSize);
    const y = p.y;

    // Prevent duplicates
    const key = `${i},${j}`;
    if (this.selection.find(t => t.key === key)) return;

    const mesh = this._makeLockedMesh(i, j, y);
    this.selection.push({ key, i, j, y: Number(y.toFixed(3)) });
    this.selectionMeshes.push(mesh);
    this._updateStatus();
  }

  clearSelection() {
    this.selectionMeshes.forEach(m => this.scene.remove(m));
    this.selectionMeshes.length = 0;
    this.selection.length = 0;
    this._updateStatus();
  }

  copySelection() {
    const payload = {
      tileSize: this.tileSize,
      tiles: this.selection.map(({ i, j, y }) => ({ i, j, y }))
    };
    const str = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(str)
      .then(() => this.debugger?.log('Highlight selection copied.'))
      .catch(err => this.debugger?.handleError(err, 'Highlighter.Copy'));
  }

  _updateStatus() {
    const el = this.panel.querySelector('#hl-status');
    if (el) el.textContent = `Tiles: ${this.selection.length}`;
  }
}