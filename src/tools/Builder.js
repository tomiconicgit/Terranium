// src/tools/Builder.js — NMS-like snapping with snap nodes (4u grid)
// Parts:
//  • Foundations 4×4, Half-Foundations 2×4
//  • Walls 4×4, Half-Walls 2×4 (thin)
//  • Ceilings 4×4, Half-Ceilings 2×4
// Controller: R1/L1 select, B rotate 90°, R2 place once, L2 remove once

import * as THREE from 'three';

const U = 4;                      // base cell (units)
const EPS = 1e-4;
const SNAP_RADIUS = 1.0;          // how close the reticle must be to a snap
const GHOST_OK  = 0x7af28b;       // green
const GHOST_BAD = 0xf06a6a;       // red

export class Builder {
  constructor(scene, camera, hotbar) {
    this.scene  = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world   = scene.getObjectByName('world') || (() => { const g=new THREE.Group(); g.name='world'; scene.add(g); return g; })();
    this.terrain = scene.getObjectByName('terrainPlane');

    // catalog
    this.catalog = makeCatalog();
    this.hotbar.setCatalog(this.catalog);

    // raycaster
    this.ray = new THREE.Raycaster();

    // ghost
    this.preview = new THREE.Group();
    this.preview.name = 'ghost';
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.previewKey = '';

    // state
    this.rot = 0;              // 0..3 (90° steps)
    this._lastButtons = [];
    this._hover = null;
  }

  /* ---------- gamepad helpers ---------- */
  pad(){ const a=navigator.getGamepads?.()||[]; for (const p of a) if (p&&p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed, b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n&&!b; }

  /* ---------- per-frame ---------- */
  update() {
    const def = this.catalog[this.hotbar.index];

    // selection / rotate
    if (this.pressed(5)) this.hotbar.selectNext(); // R1
    if (this.pressed(4)) this.hotbar.selectPrev(); // L1
    if (this.pressed(1)) { this.rot = (this.rot + 1) & 3; this.previewKey=''; } // B

    // raycast from reticle center
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.terrain], true);
    if (!hits.length || !def) { this.preview.visible=false; this._hover=null; return; }
    const hit = hits[0];

    // compute suggestion (snap-if-possible, else base-terrain for foundations)
    const sugg = this._suggestPlacement(def, hit);
    if (!sugg) { this.preview.visible=false; this._hover=null; return; }

    // build/refresh ghost mesh per def+axis key
    const key = `${def.id}|${sugg.axis}|${this.rot}`;
    if (key !== this.previewKey) {
      this.preview.clear();
      const ghost = buildMesh(def, sugg.axis);
      // make it translucent and easily re-tintable
      ghost.traverse(o => {
        if (o.isMesh) {
          const m = o.material.clone();
          m.transparent = true; m.opacity = 0.45; m.depthWrite = false;
          o.material = m;
        }
      });
      this.preview.add(ghost);
      this.previewKey = key;
    }

    // update transform
    this.preview.position.copy(sugg.pos);
    this.preview.quaternion.copy(sugg.rot);

    // validate
    const isValid = this._validate(def, sugg);
    tintGhost(this.preview, isValid ? GHOST_OK : GHOST_BAD);
    this.preview.visible = true;

    this._hover = { def, sugg, isValid, targetSnap: sugg.targetSnap, anchor: sugg.anchor };

    // actions (one per press)
    if (this.pressed(7)) this._placeOnce();  // R2
    if (this.pressed(6)) this._removeOnce(); // L2
  }

  /* ---------- find suggestion ---------- */
  _suggestPlacement(def, hit) {
    // 1) collect all world snap nodes
    const allSnaps = collectWorldSnaps(this.world);

    // 2) find nearest compatible snap within radius
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    const look = new THREE.Vector3().copy(hit.point);

    let best = null, bestD = Infinity;
    for (const sn of allSnaps) {
      if (sn.occupied) continue;
      if (!isCompatible(def, sn)) continue;
      const d = sn.worldPos.distanceTo(look);
      if (d < SNAP_RADIUS && d < bestD) { best = sn; bestD = d; }
    }

    // If we found a compatible target snap, compute aligned transform
    if (best) {
      const { pos, rot } = alignToSnap(def, best, this.rot);
      return {
        pos, rot,
        axis: best.axis || 'x',
        targetSnap: best,
        anchor: best.owner
      };
    }

    // 3) foundations may place on terrain (flat plane), snapped to U grid
    if (def.baseType === 'foundation' && this.terrain && hit.object === this.terrain) {
      const yaw = this.rot * Math.PI/2;
      const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const pos = new THREE.Vector3(
        snapGrid(hit.point.x, U),
        def.thickness/2, // sits on terrain y=0
        snapGrid(hit.point.z, U)
      );
      const axis = (this.rot & 1) ? 'z' : 'x';
      return { pos, rot, axis, targetSnap:null, anchor:null };
    }

    // otherwise: no valid suggestion
    return null;
  }

  /* ---------- placement / removal ---------- */
  _placeOnce() {
    const h = this._hover; if (!h || !h.isValid) return;
    const { def, sugg, targetSnap } = h;

    const mesh = buildMesh(def, sugg.axis);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    // annotate part & bounding box
    mesh.userData.part = {
      type: def.baseType,
      id: def.id,
      size: def.size,
      thickness: def.thickness
    };

    // generate this part’s snap nodes in local space (then update to world after adding)
    mesh.userData.snaps = createSnapsFor(def);
    markOccupied(targetSnap, mesh); // mark the target snap (other side) as used by this mesh

    // remember "cell" center for stacking helpers if needed
    mesh.userData.foundationCenter = cellFromWorld(mesh.position);

    this.world.add(mesh);
    // after adding, bake world transforms into snaps
    updateWorldPosForSnaps(mesh);

    // also set reciprocal occupancy: bind the snap node on this new mesh that mates with targetSnap
    if (targetSnap) {
      const mySnap = findMateSnap(mesh, def, targetSnap);
      if (mySnap) {
        mySnap.occupied = true;
        mySnap.occupiedBy = mesh;
        mySnap.matesWith = targetSnap;
        targetSnap.matesWith = mySnap;
      }
    }
  }

  _removeOnce() {
    // remove the object we are looking at (top-most in world)
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world], true);
    if (!hits.length) return;
    const root = findPlacedRoot(hits[0].object);
    if (!root || root.parent !== this.world) return;

    // free its occupied snaps (and counterpart on mates)
    const snaps = root.userData.snaps || [];
    for (const sn of snaps) {
      if (sn.matesWith) sn.matesWith.occupied = false, sn.matesWith.occupiedBy = null, sn.matesWith.matesWith = null;
      sn.occupied = false; sn.occupiedBy = null; sn.matesWith = null;
    }

    root.parent.remove(root);
  }

  /* ---------- validation ---------- */
  _validate(def, sugg) {
    // (a) If snapping, ensure the target snap isn’t already taken (we filtered by .occupied, but double-check)
    if (sugg.targetSnap && sugg.targetSnap.occupied) return false;

    // (b) Collision test with simple AABB vs all children in world
    const newBox = computeWorldAABB(def, sugg.pos, sugg.rot);
    const tmpBox = new THREE.Box3();
    for (const child of this.world.children) {
      if (!child.userData?.part) continue;
      tmpBox.copy(new THREE.Box3().setFromObject(child));
      if (boxesOverlap(newBox, tmpBox)) return false;
    }

    // (c) Support: foundations on terrain y≈0; walls/ceilings must be placed via a compatible snap (sugg.targetSnap exists)
    if (def.baseType !== 'foundation' && !sugg.targetSnap) return false;
    if (def.baseType === 'foundation') {
      // forbid hovering in mid-air (terrain is flat at y=0); allow slight embed tolerance
      if (Math.abs(sugg.pos.y - def.thickness/2) > 0.05) return false;
    }

    return true;
  }
}

/* ============================================================================
   Catalog (4u scale) and mesh builders (plain metal look)
============================================================================ */
function makeCatalog(){
  return [
    // Foundations
    { id:'metal_foundation', name:'Metal Foundation (4×4)', baseType:'foundation', kind:'foundation',
      size:{x:4,y:0.4,z:4}, thickness:0.4, preview:'#a9b6c4' },
    { id:'half_foundation',  name:'Half Foundation (2×4)',  baseType:'foundation', kind:'foundation',
      size:{x:2,y:0.4,z:4}, thickness:0.4, preview:'#a9b6c4' },

    // Walls (thin, vertical)
    { id:'metal_wall', name:'Metal Wall (4×4)', baseType:'wall', kind:'wall',
      size:{x:4,y:4,z:0.2}, thickness:0.2, preview:'#dfe6ee' },
    { id:'half_wall',  name:'Half Wall (2×4)',  baseType:'wall', kind:'wall',
      size:{x:2,y:4,z:0.2}, thickness:0.2, preview:'#dfe6ee' },

    // Ceilings / floors
    { id:'metal_ceiling', name:'Metal Ceiling (4×4)', baseType:'ceiling', kind:'ceiling',
      size:{x:4,y:0.25,z:4}, thickness:0.25, preview:'#b8c2cc' },
    { id:'half_ceiling',  name:'Half Ceiling (2×4)',  baseType:'ceiling', kind:'ceiling',
      size:{x:2,y:0.25,z:4}, thickness:0.25, preview:'#b8c2cc' },
  ];
}

function matMetal()    { return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matMetalLite(){ return new THREE.MeshStandardMaterial({ color:0xb8c2cc, roughness:0.6,  metalness:0.7  }); }
function matWall()     { return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

function buildMesh(def, axis='x'){
  const g = new THREE.Group(); g.name = `piece_${def.id}`;

  if (def.baseType === 'foundation' || def.baseType === 'ceiling') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
    slab.position.y = def.thickness/2; g.add(slab);
    // subtle braces for readability
    const ribX = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.18), matMetalLite());
    for (let z=-Math.floor(def.size.z/U); z<=Math.floor(def.size.z/U); z++){
      const r = ribX.clone(); r.position.set(0, def.thickness+0.03, z*(U/2)); g.add(r);
    }
    const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, def.size.z), matMetalLite());
    for (let x=-Math.floor(def.size.x/U); x<=Math.floor(def.size.x/U); x++){
      const r = ribZ.clone(); r.position.set(x*(U/2), def.thickness+0.06, 0); g.add(r);
    }
    return g;
  }

  if (def.baseType === 'wall') {
    // long along X, thin along Z; rotate group 90° around Y if we later need along Z (comes from snap)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), matWall());
    wall.position.y = def.size.y/2; g.add(wall);
    return g;
  }

  return g;
}

/* ============================================================================
   Snap system
   - Each placed mesh carries userData.snaps: localPos, worldPos, kind, face, axis, occupied flags
============================================================================ */
function createSnapsFor(def){
  const snaps = [];
  const t = def.thickness;
  const halfX = def.size.x/2, halfY = def.size.y/2, halfZ = def.size.z/2;

  if (def.baseType === 'foundation') {
    // Edge snaps (for walls / half walls) — centers on each side, just outside the slab
    snaps.push(snap('+x','edge','z', new THREE.Vector3(+halfX + t/2, halfY, 0)));
    snaps.push(snap('-x','edge','z', new THREE.Vector3(-halfX - t/2, halfY, 0)));
    snaps.push(snap('+z','edge','x', new THREE.Vector3(0, halfY, +halfZ + t/2)));
    snaps.push(snap('-z','edge','x', new THREE.Vector3(0, halfY, -halfZ - t/2)));

    // Top snaps (for ceilings) — at slab top center
    snaps.push(snap('top','top','x', new THREE.Vector3(0, def.thickness + EPS, 0)));
    // Bottom snap not exposed (terrain handles support)
  }

  if (def.baseType === 'wall') {
    // bottom snap to sit on foundation edge (mates with foundation edge)
    snaps.push(snap('bottom','edge-accept','z_or_x', new THREE.Vector3(0, 0, 0)));
    // top snap to take ceiling
    snaps.push(snap('top','top-accept','x', new THREE.Vector3(0, def.size.y + EPS, 0)));
    // side snaps to chain walls (left/right).
    snaps.push(snap('left','wall-side','x',  new THREE.Vector3(-def.size.x/2, def.size.y/2, 0)));
    snaps.push(snap('right','wall-side','x', new THREE.Vector3(+def.size.x/2, def.size.y/2, 0)));
  }

  if (def.baseType === 'ceiling') {
    // mates to foundation top or wall top
    snaps.push(snap('bottom','top','x', new THREE.Vector3(0, 0, 0)));
  }

  return snaps;
}
function snap(face, kind, axis, localPos){
  return {
    face, kind, axis, localPos: localPos.clone(),
    worldPos: new THREE.Vector3(),
    occupied:false, occupiedBy:null, matesWith:null,
    owner:null
  };
}

function updateWorldPosForSnaps(root){
  const snaps = root.userData.snaps || [];
  for (const s of snaps) {
    s.owner = root;
    s.worldPos.copy(s.localPos).applyMatrix4(root.matrixWorld);
  }
}

function collectWorldSnaps(world){
  const out = [];
  world.updateMatrixWorld(true);
  for (const child of world.children) {
    const snaps = child.userData?.snaps || [];
    for (const s of snaps) {
      s.owner = child;
      s.worldPos.copy(s.localPos).applyMatrix4(child.matrixWorld);
      out.push(s);
    }
  }
  return out;
}

/* compatibility rules:
   - Foundation.edge   <-> Wall.bottom (edge-accept)
   - Wall.top-accept   <-> Ceiling.bottom (top)
   - Wall.wall-side    <-> Wall.wall-side  (for chaining)  [optional future]
   - Foundation.top    <-> Ceiling.bottom  (allow ceiling directly on foundation)
*/
function isCompatible(def, targetSnap){
  if (targetSnap.kind === 'edge') {
    return def.baseType === 'wall';
  }
  if (targetSnap.kind === 'top') {
    return def.baseType === 'ceiling';
  }
  if (targetSnap.kind === 'top-accept') {
    return def.baseType === 'ceiling';
  }
  if (targetSnap.kind === 'edge-accept') {
    // snapping another wall on top edge doesn't make sense; walls stack using wall top via terrain rule; keep false
    return false;
  }
  if (targetSnap.kind === 'wall-side') {
    return def.baseType === 'wall'; // chaining walls — optional
  }
  return false;
}

/* align placing part so its own "mate snap" lands on targetSnap */
function alignToSnap(def, targetSnap, rotIndex){
  const yaw = rotIndex * Math.PI/2;
  const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);

  // Which snap on the incoming part should mate with the target?
  // - to foundation.edge -> use our wall.bottom (edge-accept)
  // - to wall.top-accept -> use our ceiling.bottom (top)
  // - to foundation.top  -> use our ceiling.bottom (top)
  // - to wall.wall-side  -> use our wall.wall-side opposite (simplify: use left/right by side)
  const mySnaps = createSnapsFor(def);

  let mateKindNeeded = null;
  if (targetSnap.kind === 'edge') mateKindNeeded = 'edge-accept';
  if (targetSnap.kind === 'top' || targetSnap.kind === 'top-accept') mateKindNeeded = 'top';

  // Choose the first matching snap on the incoming part
  let mySnap = mySnaps.find(s => s.kind === mateKindNeeded) || mySnaps[0];

  // rotate mySnap local into world with desired yaw
  const m = new THREE.Matrix4().makeRotationFromQuaternion(rot);
  const mySnapWorldOffset = mySnap.localPos.clone().applyMatrix4(m);

  // We also need to orient walls to face outward from the foundation edge they snap to:
  let extraYaw = 0;
  if (def.baseType === 'wall' && targetSnap.kind === 'edge') {
    // face outward from target face
    extraYaw = yawForFace(targetSnap.face);
    rot.multiply(new THREE.Quaternion().setFromAxisAngle(Y, extraYaw));
    // recalc after extra yaw
    const m2 = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(Y, rotIndex*Math.PI/2 + extraYaw));
    mySnapWorldOffset.copy(mySnap.localPos).applyMatrix4(m2);
  }

  // position so our snap sits exactly at target snap world pos
  const pos = targetSnap.worldPos.clone().sub(mySnapWorldOffset);

  return { pos, rot };
}

function yawForFace(face){
  switch(face){
    case '+x': return  Math.PI/2;
    case '-x': return -Math.PI/2;
    case '+z': return 0;
    case '-z': return Math.PI;
    case 'top': return 0;
    default: return 0;
  }
}

function markOccupied(targetSnap, newOwner){
  if (!targetSnap) return;
  targetSnap.occupied = true;
  targetSnap.occupiedBy = newOwner;
}

function findMateSnap(mesh, def, targetSnap){
  const snaps = mesh.userData.snaps || [];
  if (targetSnap.kind === 'edge')      return snaps.find(s => s.kind === 'edge-accept');
  if (targetSnap.kind === 'top')       return snaps.find(s => s.kind === 'top');
  if (targetSnap.kind === 'top-accept')return snaps.find(s => s.kind === 'top');
  if (targetSnap.kind === 'wall-side') return snaps.find(s => s.kind === 'wall-side');
  return null;
}

/* ============================================================================
   Validation helpers
============================================================================ */
function computeWorldAABB(def, pos, rotQ){
  // approximate with a box of def.size, centered around the mesh’s center
  const half = new THREE.Vector3(def.size.x/2, def.size.y/2 || def.thickness/2, def.size.z/2);
  // center Y: wall center at y=def.size.y/2; slabs at y=thickness/2
  const center = new THREE.Vector3(
    0,
    def.baseType === 'wall' ? def.size.y/2 : (def.thickness/2),
    0
  );

  const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(def.size.x, def.size.y || def.thickness, def.size.z));
  const mat = new THREE.Matrix4().compose(pos, rotQ, new THREE.Vector3(1,1,1));

  // Transform 8 corners, build world box
  const pts = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ].map(p => p.applyMatrix4(mat));

  const worldBox = new THREE.Box3();
  worldBox.setFromPoints(pts);
  return worldBox;
}

function boxesOverlap(a, b){
  return !(a.max.x < b.min.x - EPS || a.min.x > b.max.x + EPS ||
           a.max.y < b.min.y - EPS || a.min.y > b.max.y + EPS ||
           a.max.z < b.min.z - EPS || a.min.z > b.max.z + EPS);
}

/* ============================================================================
   Misc utilities
============================================================================ */
const Y = new THREE.Vector3(0,1,0);

function findPlacedRoot(obj){
  let p = obj;
  while (p){ if (p.parent && p.parent.name === 'world') return p; p = p.parent; }
  return null;
}
function cellFromWorld(p){
  return new THREE.Vector3(snapGrid(p.x, U), 0, snapGrid(p.z, U));
}
function snapGrid(v, step){ return Math.round(v / step) * step; }

function tintGhost(g, hex){
  g.traverse(o=>{
    if (o.isMesh && o.material) {
      // tint by color; keep opacity
      const m = o.material;
      if (m.color) m.color.setHex(hex);
      if ('emissive' in m) m.emissive.setHex(0x000000);
    }
  });
}