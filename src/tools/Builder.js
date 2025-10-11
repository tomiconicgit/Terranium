// src/tools/Builder.js — Metal Flat + Walls (correct vertical baseline + smooth flats)

import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene  = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world   = scene.getObjectByName('world');
    this.terrain = scene.getObjectByName('terrainPlane');

    this.catalog = makeCatalog();
    this.hotbar.setCatalog(this.catalog);

    this.ray = new THREE.Raycaster();

    // Ghost preview
    this.preview = new THREE.Group(); this.preview.visible = false;
    this.preview.name = 'ghost';
    this.scene.add(this.preview);
    this.prevKey = '';

    // state
    this.rot = 0; // 0..3 for half pieces
    this._lastButtons = [];
    this._hover = null;
  }

  /* ---------- gamepad helpers ---------- */
  pad(){ const a=navigator.getGamepads?.()||[]; for (const p of a) if (p && p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed, b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n && !b; }

  /* ---------- per-frame ---------- */
  update(){
    const def = this.catalog[this.hotbar.index];

    // UI
    if (this.pressed(5)) this.hotbar.selectNext(); // R1
    if (this.pressed(4)) this.hotbar.selectPrev(); // L1
    if (this.pressed(1)) { this.rot = (this.rot + 1) & 3; this.prevKey=''; } // B rotate (halves)

    // Raycast from reticle center
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.terrain], true);
    if (!hits.length || !def) { this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const anchorRoot = findPlacedRoot(hit.object);
    const normal = worldNormal(hit);

    const sugg = this.suggest(def, hit.point, normal, anchorRoot, hit.object);
    if (!sugg) { this.preview.visible=false; this._hover=null; return; }

    // build / refresh ghost
    const key = `${def.id}|${sugg.axis}|${this.rot}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def, sugg.axis);
      ghost.traverse(o=>{
        if (o.isMesh) {
          const m = o.material.clone(); m.transparent=true; m.opacity=0.45; m.depthWrite=false; o.material=m;
        }
      });
      this.preview.add(ghost);
      this.prevKey = key;
    }
    this.preview.position.copy(sugg.pos);
    this.preview.quaternion.copy(sugg.rot);
    this.preview.visible = true;

    this._hover = { def, sugg, anchorRoot };

    // Actions: one per press
    if (this.pressed(7)) this.placeOne();   // R2
    if (this.pressed(6)) this.removeOne();  // L2
  }

  /* ---------- snap rules ---------- */
  suggest(def, hitPoint, n, anchorRoot, hitObject){
    const rotYaw = this.rot * Math.PI/2;
    const rotQ = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);

    // 3-unit cell centers: ...,-1.5, 1.5, 4.5, ...
    const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;

    // ===== METAL FLAT =====
    if (def.baseType === 'flat'){
      // Terrain → snap to grid
      if (!anchorRoot && hitObject === this.terrain && Math.abs(hitPoint.y) < 0.6){
        const cx=snap3(hitPoint.x), cz=snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.thickness/2, cz);
        const axis = (this.rot & 1) ? 'z' : 'x';
        return { pos, rot: rotQ, axis, foundationCenter: new THREE.Vector3(cx,0,cz) };
      }
      // Adjacent to existing flat
      if (anchorRoot?.userData?.part?.type === 'flat'){
        const base = anchorRoot;
        const side = pickSide(hitPoint, base.position);
        const out  = outwardVector(side);
        const pos  = base.position.clone().addScaledVector(out, 3);
        pos.y = def.thickness/2;
        const axis = (this.rot & 1) ? 'z' : 'x';
        const newCell = base.position.clone().addScaledVector(out, 3);
        return { pos, rot: rotQ, axis, foundationCenter: newCell };
      }
      return null;
    }

    // ===== WALLS =====
    if (def.baseType === 'wall'){
      // Must anchor to a Metal Flat OR a wall tied to a flat
      let cellCenter = null;
      let topY = 0; // exact top surface of the owning Metal Flat

      if (anchorRoot?.userData?.part?.type === 'flat'){
        cellCenter = anchorRoot.position.clone(); cellCenter.y = 0;
        // group is centered at thickness/2 — so top = centerY + thickness/2
        topY = anchorRoot.position.y + anchorRoot.userData.part.thickness/2;
      } else if (anchorRoot?.userData?.part?.type === 'wall' && anchorRoot.userData.foundationCenter){
        cellCenter = anchorRoot.userData.foundationCenter.clone();
        topY = anchorRoot.userData.baseTopY ?? 0;
      } else {
        return null; // disallow wall-on-terrain
      }

      // stack on top if looking at a wall's top
      if (anchorRoot?.userData?.part?.type === 'wall' && Math.abs(n.y) > 0.5){
        const w = anchorRoot;
        const pos2 = w.position.clone(); pos2.y += def.size.y;
        const rot2 = new THREE.Quaternion().setFromAxisAngle(Y, yawForSide(w.userData.meta.side));
        const ax2  = w.userData.meta.axis;
        if (w.userData.meta.halfOffset) pos2.addScaledVector(edgeAxis(ax2), w.userData.meta.halfOffset);
        return { pos:pos2, rot:rot2, axis:ax2, side:w.userData.meta.side, halfOffset:w.userData.meta.halfOffset, foundationCenter: w.userData.foundationCenter.clone(), baseTopY: topY };
      }

      // snap to Metal Flat edge
      const side = pickSide(hitPoint, cellCenter);
      const yaw  = yawForSide(side);
      const rot  = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const axis = axisForSide(side);

      const out  = outwardVector(side);
      const pos  = cellCenter.clone()
        .addScaledVector(out, 1.5 + def.thickness/2);

      // center at half-height + exact flat top, so bottom sits flush on slab
      pos.y = def.size.y/2 + topY;

      // half wall: choose left/right half
      const local = hitPoint.clone().sub(cellCenter);
      if (def.size.x === 1.5){
        const along = (axis === 'z') ? local.z : local.x;
        const halfOffset = (along >= 0 ? +0.75 : -0.75);
        pos.addScaledVector(edgeAxis(axis), halfOffset);
        return { pos, rot, axis, side, halfOffset, foundationCenter: cellCenter.clone(), baseTopY: topY };
      }

      return { pos, rot, axis, side, foundationCenter: cellCenter.clone(), baseTopY: topY };
    }

    return null;
  }

  /* ---------- actions ---------- */
  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg } = h;

    const mesh = buildPart(def, sugg.axis);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    // annotate for future snaps
    mesh.userData.part = { type:def.baseType, size:def.size, thickness:def.thickness };
    mesh.userData.meta = { axis:sugg.axis, side:sugg.side, halfOffset:sugg.halfOffset };
    mesh.userData.foundationCenter = sugg.foundationCenter
      ? sugg.foundationCenter.clone()
      : cellFromWorld(mesh.position);
    // store the *exact* top Y of the owning flat to keep stacks aligned
    if (sugg.baseTopY !== undefined) mesh.userData.baseTopY = sugg.baseTopY;

    this.world.add(mesh);
  }

  removeOne(){
    if (!this._hover?.anchorRoot) return;
    const r = this._hover.anchorRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }
}

/* =========================
   Catalog + mesh builders
========================= */
function makeCatalog(){
  return [
    // Prefer building floors first in the hotbar order
    { id:'metal_flat', name:'Metal Flat (3×3)', baseType:'flat', kind:'flat',
      size:{x:3,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' },
    { id:'half_flat',  name:'Half Flat (1.5×3)', baseType:'flat', kind:'flat',
      size:{x:1.5,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' },

    { id:'metal_wall', name:'Metal Wall (3×3)', baseType:'wall', kind:'wall',
      size:{x:3,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },
    { id:'half_wall',  name:'Half Wall (1.5×3)', baseType:'wall', kind:'wall',
      size:{x:1.5,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },
  ];
}

/* Materials */
function matMetal() { return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matWall()  { return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

function buildPart(def, axis='x'){
  const g = new THREE.Group();
  const EPS = 0.04; // remove corner gaps

  if (def.baseType === 'wall'){
    const len = def.size.x + EPS;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, def.size.y, def.thickness), matWall());
    wall.position.y = def.size.y/2;
    g.add(wall);
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  if (def.baseType === 'flat'){
    // SMOOTH slab (no ribs/extra geometry)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
    slab.position.y = def.thickness/2;
    g.add(slab);
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  return g;
}

/* =========================
   Math / snap helpers
========================= */
const Y = new THREE.Vector3(0,1,0);

function findPlacedRoot(obj){
  let p = obj;
  while (p){
    if (p.parent && p.parent.name === 'world') return p;
    p = p.parent;
  }
  return null;
}
function worldNormal(hit){
  const n = (hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0));
  return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
}
function pickSide(point, cellCenter){
  const d = point.clone().sub(cellCenter);
  return (Math.abs(d.x) > Math.abs(d.z))
    ? (d.x >= 0 ? '+x' : '-x')
    : (d.z >= 0 ? '+z' : '-z');
}
function outwardVector(side){
  switch (side){
    case '+x': return new THREE.Vector3( 1,0,0);
    case '-x': return new THREE.Vector3(-1,0,0);
    case '+z': return new THREE.Vector3( 0,0,1);
    case '-z': return new THREE.Vector3( 0,0,-1);
  }
  return new THREE.Vector3(1,0,0);
}
function yawForSide(side){
  switch (side){
    case '+x': return  Math.PI/2;
    case '-x': return -Math.PI/2;
    case '+z': return 0;
    case '-z': return Math.PI;
  }
  return 0;
}
function axisForSide(side){
  // along-edge axis: if ±x, edge runs along Z; if ±z, along X
  return (side.endsWith('x')) ? 'z' : 'x';
}
function edgeAxis(axis){ return (axis === 'z') ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }
function cellFromWorld(p){
  const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;
  return new THREE.Vector3(snap3(p.x), 0, snap3(p.z));
}