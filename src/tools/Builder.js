// Builder.js — controller-only placement/removal + 3×3 face mini-grid snapping
// R2 (7) = place, L2 (6) = destroy, R1 (5)/L1 (4) = hotbar next/prev
// Ray is cast from screen center (reticle). We render a 3×3 (or 3×1 for slabs) grid
// on the face of the hit block, highlight the hovered mini-tile in red, and snap placement to it.

import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar) {
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world = scene.getObjectByName('world');
    if (!this.world) {
      this.world = new THREE.Group(); this.world.name='world';
      this.scene.add(this.world);
    }

    // grid size (tile)
    this.grid = 1.0;

    // ray
    this.raycaster = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3();
    this.tmpN = new THREE.Vector3();

    // highlight cube (placement preview)
    const hlGeom = new THREE.BoxGeometry(this.grid, this.grid, this.grid);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.25, transparent: true, depthWrite:false });
    this.highlight = new THREE.Mesh(hlGeom, hlMat);
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // face mini-grid visuals (drawn as a plane on the hit face)
    const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.9 });
    const redMat  = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent:true, opacity:0.35, depthWrite:false });

    this.gridGroup = new THREE.Group();
    this.gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
    this.gridHot = new THREE.Mesh(new THREE.PlaneGeometry(1/3,1/3), redMat); // will be scaled for 3×1 slab view
    this.gridHot.position.z = 0.0005; // nudge in front to avoid z-fight
    this.gridHot.renderOrder = 10;
    this.gridGroup.add(this.gridLines, this.gridHot);
    this.gridGroup.visible = false;
    this.scene.add(this.gridGroup);

    // catalog + UI
    this.catalog = createCatalog();
    this.hotbar.setCatalog(this.catalog);

    // For shoulder buttons in here (we edge-detect locally)
    this._lastButtons = [];

    // Asset mesh cache
    this.cache = makeAssetCache();

    // Remember last mini-cell for placement
    this._hoverInfo = null;
  }

  /* ---------------- Gamepad helpers ---------------- */
  getGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  wasPressed(btnIndex) {
    const gp = this.getGamepad();
    if (!gp) return false;
    const now = !!gp.buttons[btnIndex]?.pressed;
    const before = !!this._lastButtons[btnIndex];
    this._lastButtons[btnIndex] = now;
    return now && !before;
  }
  isDown(btnIndex) {
    const gp = this.getGamepad();
    return gp ? !!gp.buttons[btnIndex]?.pressed : false;
  }

  /* ---------------- Main update ---------------- */
  update(_dt) {
    // shoulders move hotbar selection
    if (this.wasPressed(5)) this.hotbar.selectNext(); // R1
    if (this.wasPressed(4)) this.hotbar.selectPrev(); // L1

    // cast from screen center
    this.raycaster.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.raycaster.intersectObjects(
      [this.world, this.scene.getObjectByName('groundInstanced')],
      true
    );

    if (!hits.length) {
      this.highlight.visible = false;
      this.gridGroup.visible = false;
      this._hoverInfo = null;
      return;
    }

    const hit = hits[0];

    // derive world-space face normal
    const normal = (hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0))
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();

    // figure out if we hit an existing placed asset (world) or the ground
    const isWorld = isWorldChild(hit.object, this.world);

    // identify a "block reference" transform (cube-sized 1m) to attach a face grid to
    // For the ground instancing, we snap hit.point to nearest block center at y=0.5.
    let refCenter = new THREE.Vector3();
    let refSize   = new THREE.Vector3(1,1,1); // unit cube default
    if (isWorld) {
      const root = findAssetRoot(hit.object);
      if (root) {
        // treat any asset’s local bounding box as the reference; for blocks this is 1×1×1
        const box = new THREE.Box3().setFromObject(root);
        refCenter.copy(box.getCenter(new THREE.Vector3()));
        refSize.copy(box.getSize(new THREE.Vector3()));
        // For blocks we want unit sizing; “block” assets already are 1×1×1.
        // Slabs will be (1×0.25×1), pipes/wires/windows slender — that’s ok for face picking.
      }
    } else {
      // ground: choose the snapped center of the ground block under the cursor, at y=0.5
      refCenter.copy(snapVec(hit.point, this.grid));
      refCenter.y = 0.5;
      refSize.set(1,1,1);
    }

    // choose face plane basis (U,V across the face, N = normal)
    const { uAxis, vAxis, face, plane } = faceBasisFromNormal(normal);
    // transform hit point into the face local 2D uv in [-0.5, 0.5]
    const faceCenter = refCenter.clone().addScaledVector(normal, refSizeOn(face, refSize)/2);
    const local = hit.point.clone().sub(faceCenter);
    const u = local.dot(uAxis) / refSizeOn(faceUName(face), refSize);
    const v = local.dot(vAxis) / refSizeOn(faceVName(face), refSize);

    // decide grid dims (3×3 generally; 3×1 when placing slab on top/bottom)
    const selected = this.catalog[this.hotbar.index];
    const placingSlab = selected?.kind === 'slab';
    const isTopOrBottom = (face === 'top' || face === 'bottom');

    const gridCols = (placingSlab && isTopOrBottom) ? 3 : 3;
    const gridRows = (placingSlab && isTopOrBottom) ? 1 : 3;

    // pick hovered mini-cell index
    const iu = clampInt(Math.floor((u + 0.5) * gridCols), 0, gridCols-1);
    const iv = clampInt(Math.floor((v + 0.5) * gridRows), 0, gridRows-1);

    // exact mini-cell center in face-local coords (uC, vC in [-0.5..0.5])
    const uStep = 1 / gridCols;
    const vStep = 1 / gridRows;
    const uC = (-0.5 + uStep * (iu + 0.5));
    const vC = (-0.5 + vStep * (iv + 0.5));

    // world-space mini-cell center on the face (on the face plane)
    const cellCenter = faceCenter
      .clone()
      .addScaledVector(uAxis, uC * refSizeOn(faceUName(face), refSize))
      .addScaledVector(vAxis, vC * refSizeOn(faceVName(face), refSize));

    // draw the grid and hot cell on the face
    this.drawFaceGrid(faceCenter, uAxis, vAxis, refSize, face, gridCols, gridRows, iu, iv);

    // compute actual placement preview position (depends on asset type)
    const preview = this.computePlacementPreview(selected, face, cellCenter, refCenter);

    this.highlight.visible = true;
    this.highlight.position.copy(preview.position);
    this.highlight.scale.copy(preview.scale);

    // Save hover info for placement action
    this._hoverInfo = { hit, face, cellCenter, refCenter, iu, iv };

    // Actions
    if (this.isDown(7)) this.tryPlace();   // R2 place
    if (this.isDown(6)) this.tryDestroy(); // L2 destroy
  }

  /* ---------------- Destroy ---------------- */
  tryDestroy() {
    if (!this._hoverInfo) return;
    const { hit } = this._hoverInfo;
    const obj = findAssetRoot(hit.object);
    if (obj && obj.parent === this.world) obj.parent.remove(obj);
  }

  /* ---------------- Place ---------------- */
  tryPlace() {
    if (!this._hoverInfo) return;
    const { hit, face, cellCenter, refCenter } = this._hoverInfo;
    const def = this.catalog[this.hotbar.index];
    if (!def) return;

    // If we’re extending same-type pipe/wire: extend outwards in face axis by step
    const root = findAssetRoot(hit.object);
    if (root?.userData?.asset?.id === def.id && (def.kind === 'pipe' || def.kind === 'wire')) {
      const axis = axisFromFace(face); // extend along face axis
      const step = def.step || 1.0;
      const dir = axisToVec3(axis);
      const ext = makeAssetMesh(def, this.cache);
      orientMesh(ext, axis, def);
      // put extension one step outward from current cellCenter ref; ensure we start from root’s “outside”
      const base = root.position.clone();
      // choose which side to extend based on aiming direction (dot with dir)
      const towards = Math.sign(cellCenter.clone().sub(base).dot(dir)) || 1;
      ext.position.copy(base.addScaledVector(dir, towards * step));
      ext.userData.asset = { id:def.id };
      ext.userData.axis = axis;
      this.world.add(ext);
      return;
    }

    // New placement
    const mesh = makeAssetMesh(def, this.cache);

    if (def.orient === 'auto') {
      const axis = axisFromFace(face);
      orientMesh(mesh, axis, def);
      mesh.userData.axis = axis;
    }

    const preview = this.computePlacementPreview(def, face, cellCenter, refCenter);
    mesh.position.copy(preview.position);
    // scale is only for the preview highlight; the mesh already has proper size

    mesh.userData.asset = { id: def.id };
    this.world.add(mesh);
  }

  /* ---------------- Preview computation ---------------- */
  computePlacementPreview(def, face, cellCenter, refCenter) {
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1,1,1);
    pos.copy(cellCenter);

    if (def.kind === 'block') {
      // Always adjacent: ignore mini-cell offsets, place one block out along face
      const n = normalFromFace(face);
      pos.copy(refCenter).addScaledVector(n, 0.5 + 0.5);
      scl.set(1,1,1);
    }
    else if (def.kind === 'slab') {
      const n = normalFromFace(face);
      const axis = axisFromFace(face);
      // slabs are 0.25 along their axis (Y if top/bottom; X or Z if side)
      if (axis === 'y') {
        // sits atop or under: center.y at ref top/bottom + 0.125 outward
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
      scl.set(1,1,1);
    }
    else if (def.kind === 'pipe' || def.kind === 'wire') {
      // Axis = face axis; center offset 0.5 along outward normal
      const axis = axisFromFace(face);
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
    }
    else if (def.kind === 'window') {
      // Thin panel sits exactly on the face (no extra offset)
      const n = normalFromFace(face);
      pos.addScaledVector(n, 0.0008); // tiny offset to avoid z-fight
    }

    return { position: pos, scale: scl };
  }

  /* ---------------- Face mini-grid drawing ---------------- */
  drawFaceGrid(faceCenter, uAxis, vAxis, refSize, face, cols, rows, iu, iv) {
    // Build grid lines geometry for cols×rows inside a 1×1 face
    // Convert to world positions using basis (faceCenter + u*uSize + v*vSize)
    const uLen = refSizeOn(faceUName(face), refSize);
    const vLen = refSizeOn(faceVName(face), refSize);

    const lines = [];
    for (let c = 0; c <= cols; c++) {
      const u = -0.5 + (c/cols);
      const a = faceCenter.clone()
        .addScaledVector(uAxis, u * uLen)
        .addScaledVector(vAxis, -0.5 * vLen);
      const b = faceCenter.clone()
        .addScaledVector(uAxis, u * uLen)
        .addScaledVector(vAxis, +0.5 * vLen);
      lines.push(a, b);
    }
    for (let r = 0; r <= rows; r++) {
      const v = -0.5 + (r/rows);
      const a = faceCenter.clone()
        .addScaledVector(uAxis, -0.5 * uLen)
        .addScaledVector(vAxis, v * vLen);
      const b = faceCenter.clone()
        .addScaledVector(uAxis, +0.5 * uLen)
        .addScaledVector(vAxis, v * vLen);
      lines.push(a, b);
    }

    const pos = new Float32Array(lines.length * 3);
    for (let i=0;i<lines.length;i++){
      pos[i*3+0]=lines[i].x; pos[i*3+1]=lines[i].y; pos[i*3+2]=lines[i].z;
    }
    this.gridLines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.gridLines.geometry.computeBoundingSphere();

    // Position the highlighted mini-cell patch (red)
    const uStep = uLen / cols;
    const vStep = vLen / rows;
    const uC = (-0.5 + (iu + 0.5) / cols) * uLen;
    const vC = (-0.5 + (iv + 0.5) / rows) * vLen;

    // orient the red plane to the face
    const basis = new THREE.Matrix4().makeBasis(uAxis.clone().normalize(), vAxis.clone().normalize(), normalFromFace(face));
    const world = new THREE.Matrix4()
      .copy(basis)
      .setPosition(faceCenter.clone().addScaledVector(normalFromFace(face), 0.001)); // tiny lift

    this.gridHot.geometry.dispose();
    this.gridHot.geometry = new THREE.PlaneGeometry(uStep, vStep);

    this.gridGroup.matrix.copy(world);
    this.gridGroup.matrixAutoUpdate = false;

    // move hot patch in local (u,v) of the plane
    this.gridHot.position.set(uC, vC, 0.0005);

    this.gridGroup.visible = true;
  }
}

/* ---------------- Catalog (10 items) ---------------- */

function createCatalog() {
  // Each item gets: id, name, kind, orient('auto'|'none'), preview, step(optional)
  return [
    { id:'block_grass',    name:'Grass Block', kind:'block',   orient:'none', preview:'#49a84b', previewText:'' },
    { id:'block_concrete', name:'Concrete',    kind:'block',   orient:'none', preview:'#b9c0c7', previewText:'' },
    { id:'block_sand',     name:'Sand',        kind:'block',   orient:'none', preview:'#dbc99a', previewText:'' },
    { id:'block_metal',    name:'Metal',       kind:'block',   orient:'none', preview:'#9ea6af', previewText:'' },
    { id:'block_iron',     name:'White Iron',  kind:'block',   orient:'none', preview:'#eef2f5', previewText:'' },
    { id:'block_asphalt',  name:'Asphalt',     kind:'block',   orient:'none', preview:'#1b1b1b', previewText:'' },
    { id:'slab_concrete',  name:'Slab 1/4',    kind:'slab',    orient:'auto', preview:'#b9c0c7', previewText:'1/4' },
    { id:'pipe_round',     name:'Pipe',        kind:'pipe',    orient:'auto', preview:'#caa555', previewText:'' , step:1.0 },
    { id:'wire_thin',      name:'Wire',        kind:'wire',    orient:'auto', preview:'#444444', previewText:'' , step:1.0 },
    { id:'window_thin',    name:'Window',      kind:'window',  orient:'auto', preview:'#88b8f5', previewText:'' },
  ];
}

/* ---------------- Asset Cache & Factory ---------------- */

function makeAssetCache() {
  const cache = {};

  cache.mats = {
    grass:    new THREE.MeshStandardMaterial({ color:0x49a84b, roughness:1, metalness:0 }),
    concrete: new THREE.MeshStandardMaterial({ color:0xb9c0c7, roughness:0.95, metalness:0.05 }),
    sand:     new THREE.MeshStandardMaterial({ color:0xdbc99a, roughness:1, metalness:0 }),
    metal:    new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.5, metalness:0.9 }),
    iron:     new THREE.MeshStandardMaterial({ color:0xeef2f5, roughness:0.45, metalness:0.95 }),
    asphalt:  new THREE.MeshStandardMaterial({ color:0x1b1b1b, roughness:1, metalness:0 }),
    pipe:     new THREE.MeshStandardMaterial({ color:0xcaa555, roughness:0.9, metalness:0.2 }),
    wire:     new THREE.MeshStandardMaterial({ color:0x444444, roughness:1.0, metalness:0.0 }),
    glass:    new THREE.MeshStandardMaterial({ color:0x88b8f5, roughness:0.15, metalness:0.05, transparent:true, opacity:0.4 })
  };

  cache.geom = {
    cube: new THREE.BoxGeometry(1,1,1),

    slabY: new THREE.BoxGeometry(1,0.25,1),
    slabX: new THREE.BoxGeometry(0.25,1,1),
    slabZ: new THREE.BoxGeometry(1,1,0.25),

    pipeX: new THREE.CylinderGeometry(0.18,0.18,1,16),
    pipeY: new THREE.CylinderGeometry(0.18,0.18,1,16),
    pipeZ: new THREE.CylinderGeometry(0.18,0.18,1,16),

    wireX: new THREE.CylinderGeometry(0.05,0.05,1,8),
    wireY: new THREE.CylinderGeometry(0.05,0.05,1,8),
    wireZ: new THREE.CylinderGeometry(0.05,0.05,1,8),

    windowX: new THREE.BoxGeometry(1,1,0.05),
    windowY: new THREE.BoxGeometry(0.05,1,1),
    windowZ: new THREE.BoxGeometry(1,0.05,1),
  };

  // Rotate to axis
  cache.geom.pipeX.rotateZ(Math.PI/2);
  cache.geom.pipeZ.rotateX(Math.PI/2);
  cache.geom.wireX.rotateZ(Math.PI/2);
  cache.geom.wireZ.rotateX(Math.PI/2);

  return cache;
}

function makeAssetMesh(def, cache) {
  let mesh;
  switch (def.id) {
    case 'block_grass':    mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.grass); break;
    case 'block_concrete': mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.concrete); break;
    case 'block_sand':     mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.sand); break;
    case 'block_metal':    mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.metal); break;
    case 'block_iron':     mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.iron); break;
    case 'block_asphalt':  mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.asphalt); break;

    case 'slab_concrete':  mesh = new THREE.Mesh(cache.geom.slabY, cache.mats.concrete); break;

    case 'pipe_round':     mesh = new THREE.Mesh(cache.geom.pipeY, cache.mats.pipe); break;
    case 'wire_thin':      mesh = new THREE.Mesh(cache.geom.wireY, cache.mats.wire); break;

    case 'window_thin':    mesh = new THREE.Mesh(cache.geom.windowX, cache.mats.glass); break;

    default:               mesh = new THREE.Mesh(cache.geom.cube,  cache.mats.concrete);
  }

  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.asset = { id: def.id };
  mesh.name = `asset_${def.id}`;
  return mesh;
}

/* ---------------- Orientation helpers ---------------- */

function orientMesh(mesh, axis, def) {
  if (def.kind === 'slab') {
    if (axis === 'y')      mesh.geometry = new THREE.BoxGeometry(1,0.25,1);
    else if (axis === 'x') mesh.geometry = new THREE.BoxGeometry(0.25,1,1);
    else                   mesh.geometry = new THREE.BoxGeometry(1,1,0.25);
  }
  if (def.kind === 'pipe') {
    if (axis === 'x') mesh.geometry = new THREE.CylinderGeometry(0.18,0.18,1,16).rotateZ(Math.PI/2);
    if (axis === 'y') mesh.geometry = new THREE.CylinderGeometry(0.18,0.18,1,16);
    if (axis === 'z') mesh.geometry = new THREE.CylinderGeometry(0.18,0.18,1,16).rotateX(Math.PI/2);
  }
  if (def.kind === 'wire') {
    if (axis === 'x') mesh.geometry = new THREE.CylinderGeometry(0.05,0.05,1,8).rotateZ(Math.PI/2);
    if (axis === 'y') mesh.geometry = new THREE.CylinderGeometry(0.05,0.05,1,8);
    if (axis === 'z') mesh.geometry = new THREE.CylinderGeometry(0.05,0.05,1,8).rotateX(Math.PI/2);
  }
  if (def.kind === 'window') {
    if (axis === 'x') mesh.geometry = new THREE.BoxGeometry(0.05,1,1);
    if (axis === 'y') mesh.geometry = new THREE.BoxGeometry(1,0.05,1);
    if (axis === 'z') mesh.geometry = new THREE.BoxGeometry(1,1,0.05);
  }
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
  // map world normal to canonical face name and choose orthogonal axes on that face
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  let face, uAxis, vAxis;
  if (ay >= ax && ay >= az) {
    face = n.y > 0 ? 'top' : 'bottom';
    uAxis = new THREE.Vector3(1,0,0);
    vAxis = new THREE.Vector3(0,0,1).multiplyScalar(face==='bottom'?-1:1); // keep v up along +Z for top
  } else if (ax >= ay && ax >= az) {
    face = n.x > 0 ? 'right' : 'left';
    uAxis = new THREE.Vector3(0,0,1);
    vAxis = new THREE.Vector3(0,1,0);
  } else {
    face = n.z > 0 ? 'front' : 'back';
    uAxis = new THREE.Vector3(1,0,0);
    vAxis = new THREE.Vector3(0,1,0);
  }
  const plane = { face, uAxis, vAxis };
  return { ...plane, face, uAxis, vAxis, plane };
}

function refSizeOn(axisName, sizeVec) {
  if (axisName === 'x') return sizeVec.x;
  if (axisName === 'y') return sizeVec.y;
  return sizeVec.z;
}
function faceUName(face){
  if (face==='top'||face==='bottom') return 'x';
  if (face==='right'||face==='left') return 'z';
  return 'x'; // front/back
}
function faceVName(face){
  if (face==='top'||face==='bottom') return 'z';
  return 'y'; // sides use Y as vertical axis
}

/* ---------------- Utils ---------------- */

function isWorldChild(obj, worldRoot) {
  let p = obj;
  while (p) {
    if (p === worldRoot) return true;
    p = p.parent;
  }
  return false;
}

function findAssetRoot(obj) {
  let p = obj;
  while (p) {
    if (p.userData?.asset && p.name?.startsWith('asset_')) return p;
    p = p.parent;
  }
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