// Builder.js — controller-only placement/removal with:
// • ONE placement/removal per press (R2/L2 edge-detected)
// • 3×3 (or 3×1 for slab on top/bottom) mini-grid
// • Ghost preview mesh (faded) of the exact asset at the pointed mini-tile
// • Y (3) toggles vertical/horizontal orientation
// • B (1) rotates 90° per press around face normal

import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar) {
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world = scene.getObjectByName('world');
    if (!this.world) { this.world = new THREE.Group(); this.world.name='world'; scene.add(this.world); }

    this.grid = 1.0;

    // Raycast from reticle center
    this.raycaster = new THREE.Raycaster();

    // Mini-grid visuals
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

    // Ghost preview (faded copy of the actual asset)
    this.preview = new THREE.Group();
    this.preview.name = 'previewGhost';
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.previewDefId = null;      // remember which asset is previewed
    this.previewAxis   = 'auto';
    this.previewRotIdx = 0;

    // Edge-detect buttons so each press is a single action
    this._lastButtons = [];

    this.tmp = {
      v: new THREE.Vector3(),
      n: new THREE.Vector3()
    };

    // Catalog + hotbar thumbnails
    this.catalog = createCatalog();
    this.hotbar.setCatalog(this.catalog); // shows names + better swatches

    // Asset cache (geoms/mats)
    this.cache = makeAssetCache();

    // Orientation state toggles (persist across frames; reset on selection change)
    this.orientAxis = 'auto'; // 'auto' | 'vertical'
    this.rotIndex   = 0;      // 0..3 (90° steps around face normal)
    this._lastSelectedId = this.catalog[this.hotbar.index]?.id;

    // Hover info for actions
    this._hover = null;
  }

  /* ---------------- Gamepad helpers ---------------- */
  getPad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  wasPressed(idx) {
    const p = this.getPad();
    if (!p) return false;
    const now = !!p.buttons[idx]?.pressed;
    const prev = !!this._lastButtons[idx];
    this._lastButtons[idx] = now;
    return now && !prev;
  }

  /* ---------------- Main update ---------------- */
  update(_dt) {
    // Reset orientation state when you change hotbar selection
    const selected = this.catalog[this.hotbar.index];
    if (selected?.id !== this._lastSelectedId) {
      this._lastSelectedId = selected?.id || null;
      this.orientAxis = 'auto';
      this.rotIndex = 0;
      this._rebuildPreviewMesh();
    }

    // Shoulder buttons move selection
    if (this.wasPressed(5)) { this.hotbar.selectNext(); } // R1
    if (this.wasPressed(4)) { this.hotbar.selectPrev(); } // L1

    // Y toggles vertical/horizontal intent
    if (this.wasPressed(3)) { // Y
      this.orientAxis = (this.orientAxis === 'vertical') ? 'auto' : 'vertical';
      this._rebuildPreviewMesh();
    }
    // B rotates 90° per press
    if (this.wasPressed(1)) { // B
      this.rotIndex = (this.rotIndex + 1) & 3;
      this._rebuildPreviewMesh();
    }

    // Ray from center
    this.raycaster.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.raycaster.intersectObjects(
      [this.world, this.scene.getObjectByName('groundInstanced')],
      true
    );

    if (!hits.length || !selected) {
      this.gridGroup.visible = false;
      this.preview.visible = false;
      this._hover = null;
      return;
    }

    const hit = hits[0];
    const normal = (hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0))
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();

    // Determine reference “block” center and size (1×1×1 for normal blocks)
    const isWorld = isUnderRoot(hit.object, this.world);
    const refCenter = new THREE.Vector3();
    const refSize   = new THREE.Vector3(1,1,1);

    if (isWorld) {
      const root = findAssetRoot(hit.object);
      const box = new THREE.Box3().setFromObject(root);
      refCenter.copy(box.getCenter(new THREE.Vector3()));
      refSize.copy(box.getSize(new THREE.Vector3()));
    } else {
      // ground tile snap (y=0.5 center)
      refCenter.copy(snapVec(hit.point, 1.0));
      refCenter.y = 0.5;
    }

    // Face basis and UV on the face
    const { uAxis, vAxis, face } = faceBasisFromNormal(normal);
    const faceCenter = refCenter.clone().addScaledVector(normal, refSizeOn(face, refSize)/2);
    const local = hit.point.clone().sub(faceCenter);
    const u = local.dot(uAxis) / refSizeOn(faceUName(face), refSize);
    const v = local.dot(vAxis) / refSizeOn(faceVName(face), refSize);

    // Grid dimension (3×3, or 3×1 for slab on top/bottom)
    const placingSlab = selected.kind === 'slab';
    const topOrBottom = (face === 'top' || face === 'bottom');
    const cols = 3;
    const rows = (placingSlab && topOrBottom) ? 1 : 3;

    const iu = clampInt(Math.floor((u + 0.5) * cols), 0, cols-1);
    const iv = clampInt(Math.floor((v + 0.5) * rows), 0, rows-1);

    // Mini-cell center on face (world space)
    const uLen = refSizeOn(faceUName(face), refSize);
    const vLen = refSizeOn(faceVName(face), refSize);
    const uStep = uLen / cols;
    const vStep = vLen / rows;
    const uC = (-0.5 + (iu + 0.5) / cols) * uLen;
    const vC = (-0.5 + (iv + 0.5) / rows) * vLen;
    const cellCenter = faceCenter
      .clone()
      .addScaledVector(uAxis, uC)
      .addScaledVector(vAxis, vC);

    // Draw face grid + hot cell
    this._drawFaceGrid(faceCenter, uAxis, vAxis, uLen, vLen, face, cols, rows, iu, iv);

    // Compute preview transform and show ghost of the real asset
    const axisPref = (this.orientAxis === 'vertical') ? 'y' : 'auto';
    const { pos, rot } = this._computePlacementTransform(selected, face, cellCenter, refCenter, axisPref, this.rotIndex);
    this._ensurePreviewMesh(selected, axisPref, this.rotIndex, face);
    this.preview.position.copy(pos);
    this.preview.quaternion.copy(rot);
    this.preview.visible = true;

    // Save hover for action
    this._hover = { hit, face, refCenter, cellCenter, axisPref, rotIndex: this.rotIndex, selected };

    // Actions — single item per press
    if (this.wasPressed(7)) this._placeOnce();   // R2 place once
    if (this.wasPressed(6)) this._removeOnce();  // L2 remove once
  }

  /* ---------------- Place / Remove (single) ---------------- */
  _removeOnce() {
    if (!this._hover) return;
    const targetRoot = findAssetRoot(this._hover.hit.object);
    if (targetRoot && targetRoot.parent === this.world) {
      targetRoot.parent.remove(targetRoot);
    }
  }

  _placeOnce() {
    if (!this._hover) return;
    const { selected, face, refCenter, cellCenter, axisPref, rotIndex } = this._hover;

    // Extension rule: if same-type pipe/wire hit, extend by one step along its axis
    const hitRoot = findAssetRoot(this._hover.hit.object);
    const isExtensible = (selected.kind === 'pipe' || selected.kind === 'wire');
    if (isExtensible && hitRoot?.userData?.asset?.id === selected.id) {
      const axis = hitRoot.userData.axis || axisFromFace(face);
      const dir = axisToVec3(axis);
      const step = selected.step || 1.0;
      const ext = makeAssetMesh(selected, this.cache, axis);
      orientMesh(ext, axis, selected);
      ext.position.copy(hitRoot.position).addScaledVector(dir, step);
      ext.userData.asset = { id: selected.id };
      ext.userData.axis = axis;
      this.world.add(ext);
      return;
    }

    // New mesh at preview transform
    const axis = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    const mesh = makeAssetMesh(selected, this.cache, axis);
    orientMesh(mesh, axis, selected);

    const { pos, rot } = this._computePlacementTransform(selected, face, cellCenter, refCenter, axisPref, rotIndex);
    mesh.position.copy(pos);
    mesh.quaternion.copy(rot);

    mesh.userData.asset = { id: selected.id };
    mesh.userData.axis = axis;
    mesh.name = `asset_${selected.id}`;

    this.world.add(mesh);
  }

  /* ---------------- Preview mesh management ---------------- */
  _ensurePreviewMesh(def, axisPref, rotIndex, face) {
    const wantId = def.id;
    const wantAxisKey = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    const key = `${wantId}|${wantAxisKey}|${rotIndex}`;

    if (this.preview.userData.key === key) return;

    // rebuild
    this.preview.clear();
    const axis = wantAxisKey;
    const mesh = makeAssetMesh(def, this.cache, axis);
    orientMesh(mesh, axis, def);

    // make it look like ghost: faded, depthWrite off
    mesh.traverse(o=>{
      if (o.isMesh) {
        const m = o.material;
        const ghost = m.clone();
        ghost.transparent = true;
        ghost.opacity = 0.45;
        ghost.depthWrite = false;
        o.material = ghost;
      }
    });

    // apply 90° steps around face normal (done as quaternion during placement; here keep neutral)
    this.preview.add(mesh);
    this.preview.userData.key = key;
  }

  _rebuildPreviewMesh() {
    // Force rebuild on next update by invalidating the key
    this.preview.userData.key = '__invalid__';
  }

  /* ---------------- Transforms ---------------- */
  _computePlacementTransform(def, face, cellCenter, refCenter, axisPref, rotIndex) {
    const pos = new THREE.Vector3().copy(cellCenter);
    const q = new THREE.Quaternion();

    // rotation base: align to chosen axis (pipes/wires/windows/slabs)
    const axis = (axisPref === 'auto') ? axisFromFace(face) : 'y';
    // Face normal for additional 90° step rotation
    const n = normalFromFace(face);

    if (def.kind === 'block') {
      // ignore mini-cell; place adjacent exactly one block away along normal
      pos.copy(refCenter).addScaledVector(n, 1.0);
      // rotate around normal by 90° steps (visual no-op for cubes but consistent)
      const step = rotIndex * (Math.PI/2);
      q.setFromAxisAngle(n, step);
      return { pos, rot: q };
    }

    if (def.kind === 'slab') {
      // thickness 0.25 along placement axis
      if (axis === 'y') {
        const sign = (face === 'top') ? +1 : -1;
        const topY = refCenter.y + sign * 0.5;
        pos.set(cellCenter.x, topY + sign * 0.125, cellCenter.z);
      } else if (axis === 'x') {
        const sign = (face === 'right') ? +1 : -1;
        const faceX = refCenter.x + sign * 0.5;
        pos.set(faceX + sign * 0.125, cellCenter.y, cellCenter.z);
      } else { // z
        const sign = (face === 'front') ? +1 : -1;
        const faceZ = refCenter.z + sign * 0.5;
        pos.set(cellCenter.x, cellCenter.y, faceZ + sign * 0.125);
      }
      const step = rotIndex * (Math.PI/2);
      q.setFromAxisAngle(n, step);
      return { pos, rot: q };
    }

    if (def.kind === 'pipe' || def.kind === 'wire') {
      // sit centered on selected mini-tile, offset outward 0.5 along normal
      if (axis === 'y') {
        const sign = (face === 'top') ? +1 : -1;
        pos.set(cellCenter.x, refCenter.y + sign * (0.5 + 0.5), cellCenter.z);
      } else if (axis === 'x') {
        const sign = (face === 'right') ? +1 : -1;
        pos.set(refCenter.x + sign * (0.5 + 0.5), cellCenter.y, cellCenter.z);
      } else { // z
        const sign = (face === 'front') ? +1 : -1;
        pos.set(cellCenter.x, cellCenter.y, refCenter.z + sign * (0.5 + 0.5));
      }
      const step = rotIndex * (Math.PI/2);
      q.setFromAxisAngle(n, step);
      return { pos, rot: q };
    }

    if (def.kind === 'window') {
      // sits exactly on face (tiny offset to avoid z-fight)
      pos.addScaledVector(n, 0.001);
      const step = rotIndex * (Math.PI/2);
      q.setFromAxisAngle(n, step);
      return { pos, rot: q };
    }

    // default
    return { pos, rot: q.identity() };
  }

  /* ---------------- Grid drawing ---------------- */
  _drawFaceGrid(faceCenter, uAxis, vAxis, uLen, vLen, face, cols, rows, iu, iv) {
    const lines = [];
    // vertical lines
    for (let c = 0; c <= cols; c++) {
      const u = -0.5 + (c/cols);
      const a = faceCenter.clone().addScaledVector(uAxis, u * uLen).addScaledVector(vAxis, -0.5 * vLen);
      const b = faceCenter.clone().addScaledVector(uAxis, u * uLen).addScaledVector(vAxis, +0.5 * vLen);
      lines.push(a, b);
    }
    // horizontal lines
    for (let r = 0; r <= rows; r++) {
      const v = -0.5 + (r/rows);
      const a = faceCenter.clone().addScaledVector(uAxis, -0.5 * uLen).addScaledVector(vAxis, v * vLen);
      const b = faceCenter.clone().addScaledVector(uAxis, +0.5 * uLen).addScaledVector(vAxis, v * vLen);
      lines.push(a, b);
    }

    const pos = new Float32Array(lines.length * 3);
    for (let i=0;i<lines.length;i++){
      const p = lines[i]; pos[i*3+0]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z;
    }
    this.gridLines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.gridLines.geometry.computeBoundingSphere();

    // highlighted mini-cell patch
    const uStep = uLen / cols;
    const vStep = vLen / rows;
    const uC = (-0.5 + (iu + 0.5) / cols) * uLen;
    const vC = (-0.5 + (iv + 0.5) / rows) * vLen;

    // plane transform: (uAxis, vAxis, normal)
    const n = normalFromFace(face);
    const basis = new THREE.Matrix4().makeBasis(uAxis.clone().normalize(), vAxis.clone().normalize(), n);
    const world = new THREE.Matrix4()
      .copy(basis)
      .setPosition(faceCenter.clone().addScaledVector(n, 0.001));

    this.gridGroup.matrix.copy(world);
    this.gridGroup.matrixAutoUpdate = false;

    this.gridHot.geometry.dispose();
    this.gridHot.geometry = new THREE.PlaneGeometry(uStep, vStep);
    this.gridHot.position.set(uC, vC, 0.0005);

    this.gridGroup.visible = true;
  }
}

/* ---------------- Catalog ---------------- */
function createCatalog() {
  // Swatches and names are used by Hotbar to show true look + label
  return [
    { id:'block_grass',    name:'Grass Block', kind:'block',   orient:'none', preview:'#49a84b' },
    { id:'block_concrete', name:'Concrete',    kind:'block',   orient:'none', preview:'#b9c0c7' },
    { id:'block_sand',     name:'Sand',        kind:'block',   orient:'none', preview:'#dbc99a' },
    { id:'block_metal',    name:'Metal',       kind:'block',   orient:'none', preview:'#9ea6af' },
    { id:'block_iron',     name:'White Iron',  kind:'block',   orient:'none', preview:'#eef2f5' },
    { id:'block_asphalt',  name:'Asphalt',     kind:'block',   orient:'none', preview:'#1b1b1b' },
    { id:'slab_concrete',  name:'Slab 1/4',    kind:'slab',    orient:'auto', preview:'#b9c0c7' },
    { id:'pipe_round',     name:'Pipe',        kind:'pipe',    orient:'auto', preview:'#caa555', step:1.0 },
    { id:'wire_thin',      name:'Wire',        kind:'wire',    orient:'auto', preview:'#444444', step:1.0 },
    { id:'window_thin',    name:'Window',      kind:'window',  orient:'auto', preview:'#88b8f5' },
  ];
}

/* ---------------- Asset Cache & Factory ---------------- */
function makeAssetCache() {
  const cache = {};
  cache.mats = {
    grass:    new THREE.MeshStandardMaterial({ color:0x49a84b, roughness:1,   metalness:0 }),
    concrete: new THREE.MeshStandardMaterial({ color:0xb9c0c7, roughness:0.95, metalness:0.05 }),
    sand:     new THREE.MeshStandardMaterial({ color:0xdbc99a, roughness:1,   metalness:0 }),
    metal:    new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.5, metalness:0.9 }),
    iron:     new THREE.MeshStandardMaterial({ color:0xeef2f5, roughness:0.45, metalness:0.95 }),
    asphalt:  new THREE.MeshStandardMaterial({ color:0x1b1b1b, roughness:1,   metalness:0 }),
    pipe:     new THREE.MeshStandardMaterial({ color:0xcaa555, roughness:0.9, metalness:0.2 }),
    wire:     new THREE.MeshStandardMaterial({ color:0x444444, roughness:1.0, metalness:0.0 }),
    glass:    new THREE.MeshStandardMaterial({ color:0x88b8f5, roughness:0.15, metalness:0.05, transparent:true, opacity:0.4 }),
  };

  cache.geom = {
    cube: new THREE.BoxGeometry(1,1,1),

    slabY: new THREE.BoxGeometry(1,0.25,1),
    slabX: new THREE.BoxGeometry(0.25,1,1),
    slabZ: new THREE.BoxGeometry(1,1,0.25),

    pipeY: new THREE.CylinderGeometry(0.18,0.18,1,16),
    pipeX: new THREE.CylinderGeometry(0.18,0.18,1,16).rotateZ(Math.PI/2),
    pipeZ: new THREE.CylinderGeometry(0.18,0.18,1,16).rotateX(Math.PI/2),

    wireY: new THREE.CylinderGeometry(0.05,0.05,1,8),
    wireX: new THREE.CylinderGeometry(0.05,0.05,1,8).rotateZ(Math.PI/2),
    wireZ: new THREE.CylinderGeometry(0.05,0.05,1,8).rotateX(Math.PI/2),

    winX: new THREE.BoxGeometry(0.05,1,1),
    winY: new THREE.BoxGeometry(1,0.05,1),
    winZ: new THREE.BoxGeometry(1,1,0.05),
  };

  return cache;
}

function makeAssetMesh(def, cache, axis='y') {
  let mesh;
  switch (def.id) {
    case 'block_grass':    mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.grass); break;
    case 'block_concrete': mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.concrete); break;
    case 'block_sand':     mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.sand); break;
    case 'block_metal':    mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.metal); break;
    case 'block_iron':     mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.iron); break;
    case 'block_asphalt':  mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.asphalt); break;

    case 'slab_concrete':
      mesh = new THREE.Mesh(
        axis==='y' ? new THREE.BoxGeometry(1,0.25,1) :
        axis==='x' ? new THREE.BoxGeometry(0.25,1,1) :
                     new THREE.BoxGeometry(1,1,0.25),
        cache.mats.concrete
      ); break;

    case 'pipe_round':
      mesh = new THREE.Mesh(
        axis==='y' ? new THREE.CylinderGeometry(0.18,0.18,1,16) :
        axis==='x' ? new THREE.CylinderGeometry(0.18,0.18,1,16).rotateZ(Math.PI/2) :
                     new THREE.CylinderGeometry(0.18,0.18,1,16).rotateX(Math.PI/2),
        cache.mats.pipe
      ); break;

    case 'wire_thin':
      mesh = new THREE.Mesh(
        axis==='y' ? new THREE.CylinderGeometry(0.05,0.05,1,8) :
        axis==='x' ? new THREE.CylinderGeometry(0.05,0.05,1,8).rotateZ(Math.PI/2) :
                     new THREE.CylinderGeometry(0.05,0.05,1,8).rotateX(Math.PI/2),
        cache.mats.wire
      ); break;

    case 'window_thin':
      mesh = new THREE.Mesh(
        axis==='x' ? cache.geom.winX :
        axis==='y' ? cache.geom.winY :
                     cache.geom.winZ,
        cache.mats.glass
      ); break;

    default:
      mesh = new THREE.Mesh(cache.geom.cube, cache.mats.concrete);
  }

  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.asset = { id: def.id };
  mesh.name = `asset_${def.id}`;
  return mesh;
}

/* ---------------- Orientation helpers ---------------- */
function orientMesh(mesh, axis, def) {
  // For pipes/wires/windows/slabs we already created geoms per axis.
  // Blocks remain cubic; no extra orientation needed.
  return mesh;
}

function axisFromFace(face) {
  if (face === 'top' || face === 'bottom') return 'y';
  if (face === 'right' || face === 'left') return 'x';
  return 'z'; // front/back
}
function normalFromFace(face) {
  switch(face){
    case 'top':    return new THREE.Vector3(0, 1, 0);
    case 'bottom': return new THREE.Vector3(0,-1, 0);
    case 'right':  return new THREE.Vector3(1, 0, 0);
    case 'left':   return new THREE.Vector3(-1,0, 0);
    case 'front':  return new THREE.Vector3(0, 0, 1);
    case 'back':   return new THREE.Vector3(0, 0,-1);
  }
  return new THREE.Vector3(0,1,0);
}
function faceBasisFromNormal(n) {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  let face, uAxis, vAxis;
  if (ay >= ax && ay >= az) {
    face = n.y > 0 ? 'top' : 'bottom';
    uAxis = new THREE.Vector3(1,0,0);
    vAxis = new THREE.Vector3(0,0,1).multiplyScalar(face==='bottom'?-1:1);
  } else if (ax >= ay && ax >= az) {
    face = n.x > 0 ? 'right' : 'left';
    uAxis = new THREE.Vector3(0,0,1);
    vAxis = new THREE.Vector3(0,1,0);
  } else {
    face = n.z > 0 ? 'front' : 'back';
    uAxis = new THREE.Vector3(1,0,0);
    vAxis = new THREE.Vector3(0,1,0);
  }
  return { face, uAxis, vAxis };
}
function refSizeOn(axisName, sizeVec) {
  if (axisName === 'x') return sizeVec.x;
  if (axisName === 'y') return sizeVec.y;
  return sizeVec.z;
}
function faceUName(face){
  if (face==='top'||face==='bottom') return 'x';
  if (face==='right'||face==='left') return 'z';
  return 'x';
}
function faceVName(face){
  if (face==='top'||face==='bottom') return 'z';
  return 'y';
}

/* ---------------- Utils ---------------- */
function isUnderRoot(obj, root) {
  let p = obj;
  while (p) { if (p === root) return true; p = p.parent; }
  return false;
}
function findAssetRoot(obj) {
  let p = obj;
  while (p) { if (p.userData?.asset && p.name?.startsWith('asset_')) return p; p = p.parent; }
  return null;
}
function snap(v, g) { return Math.round(v / g) * g; }
function snapVec(v, g) {
  return new THREE.Vector3(snap(v.x, g), snap(v.y, g), snap(v.z, g));
}
function axisToVec3(axis) {
  if (axis === 'x') return new THREE.Vector3(1,0,0);
  if (axis === 'y') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}
function clampInt(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }