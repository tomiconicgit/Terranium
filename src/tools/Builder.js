// Controller-only builder:
// • 3×3 face mini-grid (3×1 for slab top/bottom)
// • Ghost preview aligned to reticle
// • R2 place one, L2 remove one
// • R1/L1 cycle hotbar, Y toggle vertical intent, B rotate 90°
// • Pipes/wires extend when you aim at their ends
import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar) {
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world = scene.getObjectByName('world') || (()=>{ const g=new THREE.Group(); g.name='world'; scene.add(g); return g; })();

    this.ray = new THREE.Raycaster();

    // grid visuals
    const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.9 });
    const hotMat  = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent:true, opacity:0.35, depthWrite:false });

    this.gridGroup = new THREE.Group();
    this.gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
    this.gridHot = new THREE.Mesh(new THREE.PlaneGeometry(1/3,1/3), hotMat);
    this.gridHot.position.z = 0.0005;
    this.gridHot.renderOrder = 10;
    this.gridGroup.add(this.gridLines, this.gridHot);
    this.gridGroup.visible = false;
    this.scene.add(this.gridGroup);

    this.preview = new THREE.Group();
    this.preview.visible = false;
    this.preview.name = 'previewGhost';
    this.scene.add(this.preview);

    this._lastButtons = [];
    this._hover = null;

    this.catalog = createCatalog();
    this.hotbar.setCatalog(this.catalog);

    this.cache = makeAssetCache();

    this.orientAxis = 'auto';
    this.rotIndex = 0;
    this._lastSelectedId = this.catalog[this.hotbar.index]?.id;
  }

  pad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  pressed(idx) {
    const p = this.pad();
    if (!p) return false;
    const now = !!p.buttons[idx]?.pressed;
    const prev = !!this._lastButtons[idx];
    this._lastButtons[idx] = now;
    return now && !prev;
  }

  update() {
    const selected = this.catalog[this.hotbar.index];
    if (selected?.id !== this._lastSelectedId) {
      this._lastSelectedId = selected?.id || null;
      this.orientAxis = 'auto';
      this.rotIndex   = 0;
      this.preview.userData.key = '__';
    }

    if (this.pressed(5)) this.hotbar.selectNext(); // R1
    if (this.pressed(4)) this.hotbar.selectPrev(); // L1
    if (this.pressed(3)) { this.orientAxis = (this.orientAxis === 'vertical') ? 'auto' : 'vertical'; this.preview.userData.key='__'; } // Y
    if (this.pressed(1)) { this.rotIndex = (this.rotIndex+1)&3; this.preview.userData.key='__'; } // B

    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.scene.getObjectByName('groundInstanced')], true);

    if (!hits.length || !selected) {
      this.gridGroup.visible = false;
      this.preview.visible = false;
      this._hover = null;
      return;
    }

    const hit = hits[0];
    const n = (hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0))
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();

    const isWorld = underRoot(hit.object, this.world);
    const refCenter = new THREE.Vector3();
    const refSize   = new THREE.Vector3(1,1,1);

    if (isWorld) {
      const root = assetRoot(hit.object);
      const box = new THREE.Box3().setFromObject(root);
      refCenter.copy(box.getCenter(new THREE.Vector3()));
      refSize.copy(box.getSize(new THREE.Vector3()));
    } else {
      refCenter.copy(snapVec(hit.point, 1.0));
      refCenter.y = 0.5;
    }

    const { uAxis, vAxis, face } = faceBasisFromNormal(n);
    const faceCenter = refCenter.clone().addScaledVector(n, sizeOn(face, refSize)/2);
    const local = hit.point.clone().sub(faceCenter);
    const u = local.dot(uAxis) / sizeOn(faceU(face), refSize);
    const v = local.dot(vAxis) / sizeOn(faceV(face), refSize);

    const slab = selected.kind === 'slab';
    const topBottom = (face === 'top' || face === 'bottom');
    const cols = 3, rows = (slab && topBottom) ? 1 : 3;

    const iu = clampi(Math.floor((u + 0.5) * cols), 0, cols-1);
    const iv = clampi(Math.floor((v + 0.5) * rows), 0, rows-1);

    const uLen = sizeOn(faceU(face), refSize);
    const vLen = sizeOn(faceV(face), refSize);
    const uStep = uLen / cols, vStep = vLen / rows;
    const uC = (-0.5 + (iu + 0.5) / cols) * uLen;
    const vC = (-0.5 + (iv + 0.5) / rows) * vLen;

    const cellCenter = faceCenter.clone().addScaledVector(uAxis, uC).addScaledVector(vAxis, vC);

    // draw grid
    drawGrid(this.gridLines, this.gridGroup, this.gridHot, faceCenter, uAxis, vAxis, n, uLen, vLen, cols, rows, uC, vC, uStep, vStep);

    // preview mesh
    const axisPref = (this.orientAxis === 'vertical') ? 'y' : 'auto';
    ensurePreview(this.preview, selected, this.cache, axisPref === 'auto' ? axisFromFace(face) : 'y', this.rotIndex, face);

    const { pos, rot } = computeTransform(selected, face, cellCenter, refCenter, axisPref, this.rotIndex);
    this.preview.position.copy(pos);
    this.preview.quaternion.copy(rot);
    this.preview.visible = true;

    this._hover = { hit, face, refCenter, cellCenter, axisPref, rotIndex: this.rotIndex, selected };

    if (this.pressed(7)) this.placeOne();   // R2
    if (this.pressed(6)) this.removeOne();  // L2
  }

  removeOne() {
    if (!this._hover) return;
    const root = assetRoot(this._hover.hit.object);
    if (root && root.parent === this.world) root.parent.remove(root);
  }

  placeOne() {
    if (!this._hover) return;
    const { selected, face, refCenter, cellCenter, axisPref, rotIndex, hit } = this._hover;

    const hitRoot = assetRoot(hit.object);
    if ((selected.kind === 'pipe' || selected.kind === 'wire') && hitRoot?.userData?.asset?.id === selected.id) {
      const axis = hitRoot.userData.axis || axisFromFace(face);
      const dir = axisVec(axis);
      const step = selected.step || 1.0;
      const ext = makeMesh(selected, this.cache, axis);
      ext.position.copy(hitRoot.position).addScaledVector(dir, step);
      ext.userData.asset = { id: selected.id }; ext.userData.axis = axis;
      this.world.add(ext);
      return;
    }

    const axis = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    const mesh = makeMesh(selected, this.cache, axis);
    const { pos, rot } = computeTransform(selected, face, cellCenter, refCenter, axisPref, rotIndex);
    mesh.position.copy(pos); mesh.quaternion.copy(rot);
    mesh.userData.asset = { id: selected.id }; mesh.userData.axis = axis; mesh.name = `asset_${selected.id}`;
    this.world.add(mesh);
  }
}

/* ---------- catalog ---------- */
function createCatalog() {
  return [
    { id:'block_grass',    name:'Grass Block', kind:'block',  preview:'#49a84b' },
    { id:'block_concrete', name:'Concrete',    kind:'block',  preview:'#b9c0c7' },
    { id:'block_sand',     name:'Sand',        kind:'block',  preview:'#dbc99a' },
    { id:'block_metal',    name:'Metal',       kind:'block',  preview:'#9ea6af' },
    { id:'block_iron',     name:'White Iron',  kind:'block',  preview:'#eef2f5' },
    { id:'block_asphalt',  name:'Asphalt',     kind:'block',  preview:'#1b1b1b' },
    { id:'slab_concrete',  name:'Slab 1/4',    kind:'slab',   preview:'#b9c0c7' },
    { id:'pipe_round',     name:'Pipe',        kind:'pipe',   preview:'#caa555', step:1.0 },
    { id:'wire_thin',      name:'Wire',        kind:'wire',   preview:'#444444', step:1.0 },
    { id:'window_thin',    name:'Window',      kind:'window', preview:'#88b8f5' }
  ];
}

/* ---------- asset meshes ---------- */
function makeAssetCache(){
  const t = {};
  t.mats = {
    grass:    new THREE.MeshStandardMaterial({ color:0x49a84b, roughness:1,   metalness:0 }),
    concrete: new THREE.MeshStandardMaterial({ color:0xb9c0c7, roughness:0.95, metalness:0.05 }),
    sand:     new THREE.MeshStandardMaterial({ color:0xdbc99a, roughness:1,   metalness:0 }),
    metal:    new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.5, metalness:0.9 }),
    iron:     new THREE.MeshStandardMaterial({ color:0xeef2f5, roughness:0.45, metalness:0.95 }),
    asphalt:  new THREE.MeshStandardMaterial({ color:0x1b1b1b, roughness:1,   metalness:0 }),
    pipe:     new THREE.MeshStandardMaterial({ color:0xcaa555, roughness:0.9, metalness:0.2 }),
    wire:     new THREE.MeshStandardMaterial({ color:0x444444, roughness:1.0, metalness:0.0 }),
    glass:    new THREE.MeshStandardMaterial({ color:0x88b8f5, roughness:0.15, metalness:0.05, transparent:true, opacity:0.4 })
  };
  return t;
}
function makeMesh(def, cache, axis='y'){
  switch(def.id){
    case 'block_grass':    return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.grass);
    case 'block_concrete': return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.concrete);
    case 'block_sand':     return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.sand);
    case 'block_metal':    return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.metal);
    case 'block_iron':     return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.iron);
    case 'block_asphalt':  return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.asphalt);
    case 'slab_concrete': {
      const g = axis==='y'? new THREE.BoxGeometry(1,0.25,1) : axis==='x'? new THREE.BoxGeometry(0.25,1,1) : new THREE.BoxGeometry(1,1,0.25);
      return new THREE.Mesh(g, cache.mats.concrete);
    }
    case 'pipe_round': {
      const r = 0.18; let g;
      if (axis==='y') g = new THREE.CylinderGeometry(r,r,1,16);
      else if (axis==='x') g = new THREE.CylinderGeometry(r,r,1,16).rotateZ(Math.PI/2);
      else g = new THREE.CylinderGeometry(r,r,1,16).rotateX(Math.PI/2);
      return new THREE.Mesh(g, cache.mats.pipe);
    }
    case 'wire_thin': {
      const r = 0.05; let g;
      if (axis==='y') g = new THREE.CylinderGeometry(r,r,1,8);
      else if (axis==='x') g = new THREE.CylinderGeometry(r,r,1,8).rotateZ(Math.PI/2);
      else g = new THREE.CylinderGeometry(r,r,1,8).rotateX(Math.PI/2);
      return new THREE.Mesh(g, cache.mats.wire);
    }
    case 'window_thin': {
      let g;
      if (axis==='x') g = new THREE.BoxGeometry(0.05,1,1);
      else if (axis==='y') g = new THREE.BoxGeometry(1,0.05,1);
      else g = new THREE.BoxGeometry(1,1,0.05);
      return new THREE.Mesh(g, cache.mats.glass);
    }
  }
  return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), cache.mats.concrete);
}

/* ---------- transforms & grid ---------- */
function computeTransform(def, face, cellCenter, refCenter, axisPref, rotIndex){
  const pos = new THREE.Vector3().copy(cellCenter);
  const q = new THREE.Quaternion();
  const n = normalFromFace(face);

  if (def.kind === 'block') {
    pos.copy(refCenter).addScaledVector(n, 1.0);
    q.setFromAxisAngle(n, rotIndex * (Math.PI/2));
    return { pos, rot: q };
  }
  if (def.kind === 'slab') {
    const axis = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    if (axis === 'y') {
      const sign = (face === 'top') ? +1 : -1;
      const y = refCenter.y + sign * 0.5 + sign * 0.125;
      pos.set(cellCenter.x, y, cellCenter.z);
    } else if (axis === 'x') {
      const sign = (face === 'right') ? +1 : -1;
      const x = refCenter.x + sign * 0.5 + sign * 0.125;
      pos.set(x, cellCenter.y, cellCenter.z);
    } else {
      const sign = (face === 'front') ? +1 : -1;
      const z = refCenter.z + sign * 0.5 + sign * 0.125;
      pos.set(cellCenter.x, cellCenter.y, z);
    }
    q.setFromAxisAngle(n, rotIndex * (Math.PI/2));
    return { pos, rot: q };
  }
  if (def.kind === 'pipe' || def.kind === 'wire') {
    const axis = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    if (axis === 'y') {
      const sign = (face === 'top') ? +1 : -1;
      pos.set(cellCenter.x, refCenter.y + sign*(0.5 + 0.5), cellCenter.z);
    } else if (axis === 'x') {
      const sign = (face === 'right') ? +1 : -1;
      pos.set(refCenter.x + sign*(0.5 + 0.5), cellCenter.y, cellCenter.z);
    } else {
      const sign = (face === 'front') ? +1 : -1;
      pos.set(cellCenter.x, cellCenter.y, refCenter.z + sign*(0.5 + 0.5));
    }
    q.setFromAxisAngle(n, rotIndex * (Math.PI/2));
    return { pos, rot: q };
  }
  if (def.kind === 'window') {
    pos.addScaledVector(n, 0.001);
    q.setFromAxisAngle(n, rotIndex * (Math.PI/2));
    return { pos, rot: q };
  }
  return { pos, rot: q.identity() };
}

function drawGrid(lines, group, hot, faceCenter, uAxis, vAxis, n, uLen, vLen, cols, rows, uC, vC, uStep, vStep){
  const arr = [];
  for (let c=0;c<=cols;c++){
    const u = -0.5 + (c/cols);
    const a = faceCenter.clone().addScaledVector(uAxis, u*uLen).addScaledVector(vAxis, -0.5*vLen);
    const b = faceCenter.clone().addScaledVector(uAxis, u*uLen).addScaledVector(vAxis, +0.5*vLen);
    arr.push(a,b);
  }
  for (let r=0;r<=rows;r++){
    const v = -0.5 + (r/rows);
    const a = faceCenter.clone().addScaledVector(uAxis, -0.5*uLen).addScaledVector(vAxis, v*vLen);
    const b = faceCenter.clone().addScaledVector(uAxis, +0.5*uLen).addScaledVector(vAxis, v*vLen);
    arr.push(a,b);
  }
  const pos = new Float32Array(arr.length*3);
  arr.forEach((p,i)=>{ pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z; });
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos,3));
  lines.geometry.computeBoundingSphere();

  const basis = new THREE.Matrix4().makeBasis(uAxis.clone().normalize(), vAxis.clone().normalize(), n);
  const world = new THREE.Matrix4().copy(basis).setPosition(faceCenter.clone().addScaledVector(n, 0.001));
  group.matrix.copy(world); group.matrixAutoUpdate = false;

  hot.geometry.dispose(); hot.geometry = new THREE.PlaneGeometry(uStep, vStep);
  hot.position.set(uC, vC, 0.0005);

  group.visible = true;
}

/* ---------- helpers ---------- */
function underRoot(o, root){ for (let p=o; p; p=p.parent) if (p===root) return true; return false; }
function assetRoot(o){ for (let p=o; p; p=p.parent) if (p.userData?.asset && p.name?.startsWith('asset_')) return p; return null; }
function snap(n,g){ return Math.round(n/g)*g; }
function snapVec(v,g){ return new THREE.Vector3(snap(v.x,g), snap(v.y,g), snap(v.z,g)); }
function axisFromFace(face){ if (face==='top'||face==='bottom') return 'y'; if (face==='right'||face==='left') return 'x'; return 'z'; }
function normalFromFace(face){
  switch(face){ case 'top':return new THREE.Vector3(0,1,0); case 'bottom':return new THREE.Vector3(0,-1,0);
  case 'right':return new THREE.Vector3(1,0,0); case 'left':return new THREE.Vector3(-1,0,0);
  case 'front':return new THREE.Vector3(0,0,1); default:return new THREE.Vector3(0,0,-1); }
}
function faceBasisFromNormal(n){
  const ax=Math.abs(n.x), ay=Math.abs(n.y), az=Math.abs(n.z);
  if (ay>=ax && ay>=az){ return { face: n.y>0?'top':'bottom', uAxis:new THREE.Vector3(1,0,0), vAxis:new THREE.Vector3(0,0,1).multiplyScalar(n.y<0?-1:1) }; }
  if (ax>=ay && ax>=az){ return { face: n.x>0?'right':'left', uAxis:new THREE.Vector3(0,0,1), vAxis:new THREE.Vector3(0,1,0) }; }
  return { face: n.z>0?'front':'back', uAxis:new THREE.Vector3(1,0,0), vAxis:new THREE.Vector3(0,1,0) };
}
function sizeOn(axis, v){ return axis==='x'?v.x : axis==='y'?v.y : v.z; }
function faceU(face){ return (face==='top'||face==='bottom') ? 'x' : (face==='right'||face==='left') ? 'z' : 'x'; }
function faceV(face){ return (face==='top'||face==='bottom') ? 'z' : 'y'; }
function axisVec(ax){ return ax==='x'? new THREE.Vector3(1,0,0) : ax==='y'? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1); }
function clampi(x,a,b){ return Math.max(a, Math.min(b,x)); }

function ensurePreview(group, def, cache, axis, rotIdx, face){
  const key = `${def.id}|${axis}|${rotIdx}|${face}`;
  if (group.userData.key === key) return;
  group.clear();
  const m = makeMesh(def, cache, axis);
  m.traverse(o=>{
    if (o.isMesh){
      const ghost = o.material.clone();
      ghost.transparent = true; ghost.opacity = 0.45; ghost.depthWrite = false;
      o.material = ghost;
    }
  });
  group.add(m);
  group.userData.key = key;
}