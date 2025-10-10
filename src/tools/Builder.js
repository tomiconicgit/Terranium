// Builder.js — controller-only placement/removal + smart orientation/snapping
// R2 (7) = place, L2 (6) = destroy, R1 (5)/L1 (4) = hotbar next/prev
// Ray is cast from screen center (reticle), highlight is aligned to snapped grid.

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

    this.grid = 1.0;
    this.raycaster = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3();
    this.tmpN = new THREE.Vector3();

    // highlight cube (aligned to where placement would occur)
    const hlGeom = new THREE.BoxGeometry(this.grid, this.grid, this.grid);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.25, transparent: true, depthWrite:false });
    this.highlight = new THREE.Mesh(hlGeom, hlMat);
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // catalog
    this.catalog = createCatalog();
    this.hotbar.setCatalog(this.catalog);

    // For button edges
    this._lastButtons = [];

    // Reuse common geometries / materials
    this.cache = makeAssetCache();
  }

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

  update(_dt) {
    const gp = this.getGamepad();

    // Shoulders move hotbar selection
    if (this.wasPressed(5)) this.hotbar.selectNext(); // R1
    if (this.wasPressed(4)) this.hotbar.selectPrev(); // L1

    // Cast from center of screen -> intersect world & ground
    const ndc = new THREE.Vector2(0,0);
    this.raycaster.setFromCamera(ndc, this.camera);

    const hits = this.raycaster.intersectObjects([this.world, this.scene.getObjectByName('groundInstanced')], true);
    if (hits.length) {
      const hit = hits[0];
      const faceN = hit.face?.normal?.clone()?.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)) || new THREE.Vector3(0,1,0);
      faceN.normalize();

      // Determine placement position: if we hit an existing block, offset one grid along face normal;
      // if we hit ground instance, place at snapped point (y=+0.5).
      const basePoint = hit.point.clone();
      const isWorld = isWorldChild(hit.object, this.world);

      let placePos;
      if (isWorld) {
        // place adjacent to the face we are looking at
        placePos = snapVec(basePoint.addScaledVector(faceN, this.grid * 0.5), this.grid);
      } else {
        // ground: sit on top
        placePos = snapVec(basePoint, this.grid);
        placePos.y = this.grid * 0.5;
      }

      this.highlight.visible = true;
      this.highlight.position.copy(placePos);
      this.highlight.scale.set(1,1,1);

      // Place / Destroy
      if (this.isDown(7)) { // R2 place (hold = repeat)
        this.tryPlace(hit, placePos, faceN);
      }
      if (this.isDown(6)) { // L2 destroy
        this.tryDestroy(hit, placePos);
      }
    } else {
      this.highlight.visible = false;
    }
  }

  tryDestroy(hit) {
    // If we’re pointing at a placed asset, remove that block chain piece
    const obj = findAssetRoot(hit.object);
    if (obj && obj.parent === this.world) {
      obj.parent.remove(obj);
    }
  }

  tryPlace(hit, placePos, faceN) {
    const def = this.catalog[this.hotbar.index];
    if (!def) return;

    // If targeting an existing pipe/wire of same asset, extend along its axis.
    const targetRoot = findAssetRoot(hit.object);
    if (targetRoot?.userData?.asset?.id === def.id && (def.kind === 'pipe' || def.kind === 'wire')) {
      // extend from the end the user looked at
      const axis = targetRoot.userData.axis || chooseAxisFromFace(faceN);
      const step = def.step || 1.0;
      const dir = axisToVec3(axis);
      // project the ray-hit point onto the local axis to decide which end is closer
      const localHit = hit.point.clone().sub(targetRoot.position);
      const side = Math.sign(localHit.dot(dir));
      const extensionPos = targetRoot.position.clone().addScaledVector(dir, side * step);
      const ext = makeAssetMesh(def, this.cache);
      ext.position.copy(extensionPos);
      ext.userData.asset = { id:def.id };
      ext.userData.axis = axis;
      this.world.add(ext);
      return;
    }

    // otherwise create a new
    const mesh = makeAssetMesh(def, this.cache);

    // orientation is chosen from face normal (vertical vs horizontal)
    if (def.orient === 'auto') {
      const axis = chooseAxisFromFace(faceN);
      mesh.userData.axis = axis; // store for future extension
      orientMesh(mesh, axis, def);
    }

    mesh.position.copy(placePos);
    mesh.userData.asset = { id: def.id };
    this.world.add(mesh);
  }
}

/* ---------------- Catalog (10 items) ---------------- */

function createCatalog() {
  // Each item gets: id, name, kind, orient('auto'|'none'), preview, step(optional), size
  return [
    { id:'block_grass',    name:'Grass Block', kind:'block',   orient:'none', preview:'#49a84b', previewText:'' },
    { id:'block_concrete', name:'Concrete',    kind:'block',   orient:'none', preview:'#b9c0c7', previewText:'' },
    { id:'block_sand',     name:'Sand',        kind:'block',   orient:'none', preview:'#dbc99a', previewText:'' },
    { id:'block_metal',    name:'Metal',       kind:'block',   orient:'none', preview:'#9ea6af', previewText:'' },
    { id:'block_iron',     name:'White Iron',  kind:'block',   orient:'none', preview:'#eef2f5', previewText:'' },
    { id:'block_asphalt',  name:'Asphalt',     kind:'block',   orient:'none', preview:'#1b1b1b', previewText:'' },
    { id:'slab_concrete',  name:'Slab 1/4',    kind:'slab',    orient:'auto', preview:'#b9c0c7', previewText:'1/4' },
    { id:'pipe_round',     name:'Pipe',        kind:'pipe',    orient:'auto', preview:'#caa555', previewText:'' , step:1.0 },
    { id:'wire_thin',      name:'Wire',        kind:'wire',    orient:'auto', preview:'#444',    previewText:'' , step:1.0 },
    { id:'window_thin',    name:'Window',      kind:'window',  orient:'auto', preview:'#88b8f5', previewText:'' },
  ];
}

/* ---------------- Asset Mesh Factory ---------------- */

function makeAssetCache() {
  const cache = {};

  // base materials
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

  // geometries (1m grid)
  cache.geom = {
    cube: new THREE.BoxGeometry(1,1,1),
    slabY: new THREE.BoxGeometry(1,0.25,1),
    slabX: new THREE.BoxGeometry(0.25,1,1),
    slabZ: new THREE.BoxGeometry(1,1,0.25),

    pipeX: new THREE.CylinderGeometry(0.18,0.18,1,16), // will rotate into X/Z
    pipeY: new THREE.CylinderGeometry(0.18,0.18,1,16),
    pipeZ: new THREE.CylinderGeometry(0.18,0.18,1,16),

    wireX: new THREE.CylinderGeometry(0.05,0.05,1,8),
    wireY: new THREE.CylinderGeometry(0.05,0.05,1,8),
    wireZ: new THREE.CylinderGeometry(0.05,0.05,1,8),

    windowX: new THREE.BoxGeometry(1,1,0.05),
    windowY: new THREE.BoxGeometry(0.05,1,1),
    windowZ: new THREE.BoxGeometry(1,0.05,1),
  };

  // rotate cylinders to align with axis
  cache.geom.pipeX.rotateZ(Math.PI/2);
  cache.geom.pipeZ.rotateX(Math.PI/2);
  cache.geom.wireX.rotateZ(Math.PI/2);
  cache.geom.wireZ.rotateX(Math.PI/2);

  return cache;
}

function makeAssetMesh(def, cache) {
  let mesh;
  switch (def.id) {
    // blocks
    case 'block_grass':   mesh = new THREE.Mesh(cache.geom.cube, cache.mats.grass); break;
    case 'block_concrete':mesh = new THREE.Mesh(cache.geom.cube, cache.mats.concrete); break;
    case 'block_sand':    mesh = new THREE.Mesh(cache.geom.cube, cache.mats.sand); break;
    case 'block_metal':   mesh = new THREE.Mesh(cache.geom.cube, cache.mats.metal); break;
    case 'block_iron':    mesh = new THREE.Mesh(cache.geom.cube, cache.mats.iron); break;
    case 'block_asphalt': mesh = new THREE.Mesh(cache.geom.cube, cache.mats.asphalt); break;

    // slab 1/4 — choose Y slab by default; will orient later if needed
    case 'slab_concrete': mesh = new THREE.Mesh(cache.geom.slabY, cache.mats.concrete); break;

    // pipe
    case 'pipe_round':    mesh = new THREE.Mesh(cache.geom.pipeY, cache.mats.pipe); break;

    // wire (thin)
    case 'wire_thin':     mesh = new THREE.Mesh(cache.geom.wireY, cache.mats.wire); break;

    // window (thin plane-like block)
    case 'window_thin':   mesh = new THREE.Mesh(cache.geom.windowX, cache.mats.glass); break;

    default:
      mesh = new THREE.Mesh(cache.geom.cube, cache.mats.concrete);
  }

  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.asset = { id: def.id };
  mesh.name = `asset_${def.id}`;
  return mesh;
}

/* ---------------- Helpers ---------------- */

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

// Decide axis from the face we’re aiming at (used for auto orientation)
function chooseAxisFromFace(n) {
  // pick the dominant axis of normal; if pointing up/down => vertical (Y)
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ay >= ax && ay >= az) return 'y';
  if (ax >= ay && ax >= az) return 'x';
  return 'z';
}

function axisToVec3(axis) {
  if (axis === 'x') return new THREE.Vector3(1,0,0);
  if (axis === 'y') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}

function orientMesh(mesh, axis, def) {
  // Change geometry if needed (slab/windows/wire/pipe) to match axis
  const id = def.id;
  const parent = mesh.parent;
  if (parent) parent.remove(mesh); // safe swap if needed

  // swap geometry for axis-specific variants
  if (def.kind === 'slab') {
    if (axis === 'y') mesh.geometry = mesh.geometry.parameters?.height === 0.25 ? mesh.geometry : new THREE.BoxGeometry(1,0.25,1);
    else if (axis === 'x') mesh.geometry = new THREE.BoxGeometry(0.25,1,1);
    else mesh.geometry = new THREE.BoxGeometry(1,1,0.25);
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
    // window aligned perpendicular to axis: if aiming X-face -> window normal is X so use thin along Z/Y
    if (axis === 'x') mesh.geometry = new THREE.BoxGeometry(0.05,1,1);
    if (axis === 'y') mesh.geometry = new THREE.BoxGeometry(1,0.05,1);
    if (axis === 'z') mesh.geometry = new THREE.BoxGeometry(1,1,0.05);
  }

  if (parent) parent.add(mesh);
}