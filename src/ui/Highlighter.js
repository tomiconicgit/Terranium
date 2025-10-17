// src/ui/Highlighter.js
// Camera-look tile highlighter with lock, line selection, unhighlight, and copy JSON.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class HighlighterUI {
  constructor({ scene, camera, terrainGroup, debugger: dbg }) {
    this.scene = scene;
    this.camera = camera;
    this.terrainGroup = terrainGroup;
    this.debugger = dbg;

    this.active = false;
    this.tileSize = 1.0;
    this.hoverMesh = null;
    this.selection = [];
    this.selectionMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.downcaster = new THREE.Raycaster();

    this.terrainTargets = this._collectTerrainMeshes();

    this.lineStart = null;

    this._buildUI();
  }

  _collectTerrainMeshes() {
    const arr = [];
    this.terrainGroup.traverse(obj => { if (obj.isMesh) arr.push(obj); });
    return arr;
  }

  _buildUI() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for Highlighter.'), 'Init');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'highlighter-btn';
    btn.textContent = 'Highlight';
    btn.title = 'Toggle tile highlighter';
    btn.onclick = () => this.toggle();
    container.appendChild(btn);
    this.button = btn;

    const panel = document.createElement('div');
    panel.id = 'highlighter-panel';
    panel.classList.add('no-look');
    panel.style.cssText = `
      position:fixed; top:80px; left:520px; z-index:10; background:rgba(30,30,36,0.90);
      color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:300px; padding:12px; display:none; box-shadow:0 5px 15px rgba(0,0,0,0.35);
      backdrop-filter:blur(8px); -webkit-overflow-scrolling: touch; touch-action: pan-y;`;

    panel.innerHTML = `
      <h4 style="margin:0 0 10px;border-bottom:1px solid #444;padding-bottom:6px;">Highlighter</h4>

      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button id="hl-lock" style="flex:1;">Lock Tile</button>
        <button id="hl-unlock" style="flex:1;">Unhighlight Tile</button>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button id="hl-line-start" style="flex:1;">Start Line</button>
        <button id="hl-line-end" style="flex:1;">End Line</button>
      </div>

      <div style="display:flex; gap:8px;">
        <button id="hl-copy" style="flex:1;">Copy Selection</button>
        <button id="hl-clear" style="flex:1;">Clear</button>
      </div>

      <div style="display:flex; gap:8px; margin-top:8px;">
        <button id="hl-close" style="flex:1;">Close</button>
      </div>

      <p id="hl-status" style="margin:8px 0 0; font-size:.9em; color:#ccc;">Tiles: 0</p>
      <p id="hl-hint" style="margin:4px 0 0; font-size:.85em; color:#9aa;">Tip: Start Line, walk, then End Line to fill the straight path.</p>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector('#hl-lock').onclick = () => this.lockCurrentTile();
    panel.querySelector('#hl-unlock').onclick = () => this.unhighlightCurrentTile();
    panel.querySelector('#hl-line-start').onclick = () => this.setLineStart();
    panel.querySelector('#hl-line-end').onclick = () => this.finishLine();
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
      // in case terrain changed:
      this.terrainTargets = this._collectTerrainMeshes();
    } else {
      if (this.hoverMesh) { this.scene.remove(this.hoverMesh); this.hoverMesh = null; }
      this.lineStart = null;
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

  _intersectGroundForward() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    const hits = this.raycaster.intersectObjects(this.terrainTargets, true);
    return hits[0] || null;
  }

  _intersectGroundDown(x, z, maxHeight = 200) {
    const origin = new THREE.Vector3(x, maxHeight, z);
    const down = new THREE.Vector3(0, -1, 0);
    this.downcaster.set(origin, down);
    const hits = this.downcaster.intersectObjects(this.terrainTargets, true);
    return hits[0] || null;
  }

  _currentTileFromView() {
    const hit = this._intersectGroundForward();
    if (!hit) return null;
    const p = hit.point;
    const i = Math.floor(p.x / this.tileSize);
    const j = Math.floor(p.z / this.tileSize);
    return { i, j, y: p.y };
  }

  update() {
    if (!this.active || !this.hoverMesh) return;
    const t = this._currentTileFromView();
    if (!t) { this.hoverMesh.visible = false; return; }

    const cx = (t.i + 0.5) * this.tileSize;
    const cz = (t.j + 0.5) * this.tileSize;

    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(cx, t.y + 0.02, cz);
  }

  // ---------- Single-tile operations ----------
  lockCurrentTile() {
    const t = this._currentTileFromView();
    if (!t) return;
    this._lockTile(t.i, t.j, t.y);
  }

  unhighlightCurrentTile() {
    const t = this._currentTileFromView();
    if (!t) return;
    this._removeTile(t.i, t.j);
  }

  // ---------- Line selection ----------
  setLineStart() {
    const t = this._currentTileFromView();
    if (!t) return;
    this.lineStart = { i: t.i, j: t.j };
    this._setStatus(`Line start set at (${t.i},${t.j}).`);
  }

  finishLine() {
    if (!this.lineStart) { this._setStatus('Set a Start Line first.'); return; }
    const t2 = this._currentTileFromView();
    if (!t2) return;

    const { i: i0, j: j0 } = this.lineStart;
    const { i: i1, j: j1 } = t2;

    const tiles = this._bresenham(i0, j0, i1, j1);
    let added = 0;
    for (const { i, j } of tiles) {
      const cx = (i + 0.5) * this.tileSize;
      const cz = (j + 0.5) * this.tileSize;
      const hit = this._intersectGroundDown(cx, cz);
      const y = hit ? hit.point.y : 0;
      if (this._lockTile(i, j, y)) added++;
    }

    this._setStatus(`Line added ${added} tiles from (${i0},${j0}) to (${i1},${j1}).`);
    this.lineStart = null;
  }

  _bresenham(x0, y0, x1, y1) {
    const pts = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;

    for (;;) {
      pts.push({ i: x, j: y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
    return pts;
  }

  // ---------- Selection management ----------
  _lockTile(i, j, y) {
    const key = `${i},${j}`;
    if (this.selection.find(t => t.key === key)) return false;
    const mesh = this._makeLockedMesh(i, j, y);
    this.selection.push({ key, i, j, y: Number(y.toFixed(3)) });
    this.selectionMeshes.push(mesh);
    this._updateStatus();
    return true;
  }

  _removeTile(i, j) {
    const key = `${i},${j}`;
    const idx = this.selection.findIndex(t => t.key === key);
    if (idx === -1) return false;
    const mesh = this.selectionMeshes[idx];
    this.scene.remove(mesh);
    this.selection.splice(idx, 1);
    this.selectionMeshes.splice(idx, 1);
    this._updateStatus();
    this._setStatus(`Unhighlighted (${i},${j}).`);
    return true;
  }

  clearSelection() {
    this.selectionMeshes.forEach(m => this.scene.remove(m));
    this.selectionMeshes.length = 0;
    this.selection.length = 0;
    this._updateStatus();
    this._setStatus('Selection cleared.');
  }

  copySelection() {
    const payload = {
      tileSize: this.tileSize,
      tiles: this.selection.map(({ i, j, y }) => ({ i, j, y }))
    };
    const str = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(str)
      .then(() => this._setStatus('Selection copied to clipboard.'))
      .catch(err => this.debugger?.handleError(err, 'Highlighter.Copy'));
  }

  _updateStatus() {
    const el = this.panel.querySelector('#hl-status');
    if (el) el.textContent = `Tiles: ${this.selection.length}`;
  }

  _setStatus(text) {
    const el = this.panel.querySelector('#hl-status');
    if (el) el.textContent = `Tiles: ${this.selection.length} — ${text}`;
  }
}