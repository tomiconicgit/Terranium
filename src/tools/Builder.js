// src/tools/Builder.js — controller-only, NMS-like snapping
// Foundations (3×3, half 2×3), Walls (3×3, half 1.5×3), Ceilings (3×3, half 1.5×3)
// R2 place once, L2 remove once, R1/L1 select, B rotates 90° (foundations/ceilings)

import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene  = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world   = scene.getObjectByName('world');
    // FIX: scene names the ground "terrainPlane"
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
    this.rot = 0; // 0..3 quarter-turns for foundations & ceilings
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
    if (this.pressed(1)) { this.rot = (this.rot + 1) & 3; this.prevKey=''; } // B rotate

    // Raycast from reticle center
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.terrain], true);
    if (!hits.length || !def) { this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const anchorRoot = findPlacedRoot(hit.object);
    const normal = worldNormal(hit);

    const sugg = this.suggest(def, hit.point, normal, anchorRoot);
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
  suggest(def, hitPoint, n, anchorRoot){
    const rotYaw = this.rot * Math.PI/2;
    const rotQ = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);

    // 3-unit cell centers: ...,-1.5, 1.5, 4.5, ...
    const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;

    // ===== FOUNDATION =====
    if (def.baseType === 'foundation'){
      // must be terrain-ish; snap to 3-grid; half respects rotation
      if (!anchorRoot && Math.abs(hitPoint.y) < 0.6){
        const cx=snap3(hitPoint.x), cz=snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.thickness/2, cz);
        const axis = (this.rot & 1) ? 'z' : 'x'; // for the half variant orientation
        return { pos, rot: rotQ, axis };
      }
      // next to existing foundation
      if (anchorRoot?.userData?.part?.type === 'foundation'){
        const base = anchorRoot; // center at multiples of 3
        const side = pickSide(hitPoint, base.position);
        const out  = outwardVector(side);
        // full span = 3; half is 2 but still aligns on 3-grid via rotation
        const span = (def.size.x === 2 ? ((this.rot & 1)? 3 : 2) : 3);
        const pos = base.position.clone().addScaledVector(out, span);
        pos.y = def.thickness/2;
        const axis = (this.rot & 1) ? 'z' : 'x';
        return { pos, rot: rotQ, axis };
      }
      return null;
    }

    // derive an anchor cell center (foundation center)
    let cellCenter = null;
    if (anchorRoot?.userData?.part){
      if (anchorRoot.userData.part.type === 'foundation') {
        cellCenter = anchorRoot.position.clone();
      } else if (anchorRoot.userData.foundationCenter) {
        cellCenter = anchorRoot.userData.foundationCenter.clone();
      }
    }
    if (!cellCenter) cellCenter = new THREE.Vector3(snap3(hitPoint.x), 0, snap3(hitPoint.z));

    // ===== WALLS =====
    if (def.baseType === 'wall'){
      const side = pickSide(hitPoint, cellCenter);
      const yaw  = yawForSide(side);
      const rot  = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const axis = axisForSide(side); // along-edge axis

      // base edge position (flush): outward offset = 1.5 (half cell) + wall_thickness/2
      const out  = outwardVector(side);
      const pos  = cellCenter.clone()
        .addScaledVector(out, 1.5 + def.thickness/2);
      pos.y = def.size.y/2;

      // half wall: choose left/right half by where we looked along the edge
      const local = hitPoint.clone().sub(cellCenter);
      if (def.size.x === 1.5){
        const along = (axis === 'z') ? local.z : local.x;
        const halfOffset = (along >= 0 ? +0.75 : -0.75);
        pos.addScaledVector(edgeAxis(axis), halfOffset);
        return { pos, rot, axis, side, halfOffset };
      }

      // stacking on top of a wall (look at top) — keep same side/orientation
      if (anchorRoot?.userData?.part?.type === 'wall' && Math.abs(n.y) > 0.5){
        const w = anchorRoot;
        const pos2 = w.position.clone(); pos2.y += def.size.y;
        const rot2 = new THREE.Quaternion().setFromAxisAngle(Y, yawForSide(w.userData.meta.side));
        const ax2  = w.userData.meta.axis;
        if (w.userData.meta.halfOffset) pos2.addScaledVector(edgeAxis(ax2), w.userData.meta.halfOffset);
        return { pos:pos2, rot:rot2, axis:ax2, side:w.userData.meta.side, halfOffset:w.userData.meta.halfOffset };
      }

      return { pos, rot, axis, side };
    }

    // ===== CEILINGS =====
    if (def.baseType === 'ceiling'){
      // If looking at a wall, put ceiling on the adjacent cell *outside* that wall’s side,
      // sitting at wall top; half ceiling picks left/right along wall.
      if (anchorRoot?.userData?.part?.type === 'wall'){
        const meta = anchorRoot.userData.meta;
        const out  = outwardVector(meta.side);
        const newCell = cellCenter.clone().addScaledVector(out, 3);
        const axis = (this.rot & 1) ? 'z' : 'x';
        const rot  = new THREE.Quaternion().setFromAxisAngle(Y, this.rot*Math.PI/2);

        const pos  = newCell.clone();
        pos.y = anchorRoot.userData.part.size.y + def.thickness/2;

        if (def.size.x === 1.5){
          const local = hitPoint.clone().sub(newCell);
          const along = (axis === 'z') ? local.z : local.x;
          pos.addScaledVector(edgeAxis(axis), (along >= 0 ? +0.75 : -0.75));
        }
        return { pos, rot, axis, foundationCenter:newCell };
      }

      // otherwise: ceiling on current cell (ground/foundation)
      const axis = (this.rot & 1) ? 'z' : 'x';
      const rot  = new THREE.Quaternion().setFromAxisAngle(Y, this.rot*Math.PI/2);
      const pos  = cellCenter.clone(); pos.y = def.thickness/2;

      if (anchorRoot?.userData?.part?.type === 'foundation') pos.y += anchorRoot.userData.part.thickness;

      if (def.size.x === 1.5){
        const local = hitPoint.clone().sub(cellCenter);
        const along = (axis === 'z') ? local.z : local.x;
        pos.addScaledVector(edgeAxis(axis), (along >= 0 ? +0.75 : -0.75));
      }
      return { pos, rot, axis, foundationCenter:cellCenter.clone() };
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
    mesh.userData.foundationCenter = cellFromWorld(mesh.position);

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
    // Foundations
    { id:'metal_foundation', name:'Metal Foundation (3×3)', baseType:'foundation', kind:'foundation',
      size:{x:3,y:0.25,z:3}, thickness:0.25, preview:'#a9b6c4' },
    { id:'half_foundation',  name:'Half Foundation (2×3)',  baseType:'foundation', kind:'foundation',
      size:{x:2,y:0.25,z:3}, thickness:0.25, preview:'#a9b6c4' },

    // Walls
    { id:'metal_wall', name:'Metal Wall (3×3)', baseType:'wall', kind:'wall',
      size:{x:3,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },
    { id:'half_wall',  name:'Half Wall (1.5×3)', baseType:'wall', kind:'wall',
      size:{x:1.5,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },

    // Ceilings
    { id:'metal_ceiling', name:'Metal Ceiling (3×3)', baseType:'ceiling', kind:'ceiling',
      size:{x:3,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' },
    { id:'half_ceiling',  name:'Half Ceiling (1.5×3)', baseType:'ceiling', kind:'ceiling',
      size:{x:1.5,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' },
  ];
}

/* Plain, smooth metal look */
function matMetal()  { return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matMetalLite(){ return new THREE.MeshStandardMaterial({ color:0xb8c2cc, roughness:0.6,  metalness:0.7  }); }
function matWall()   { return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

function buildPart(def, axis='x'){
  const g = new THREE.Group();

  if (def.baseType === 'foundation'){
    const top = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
    top.position.y = def.thickness/2; g.add(top);
    // subtle braces for readability
    const ribX = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.16), matMetalLite());
    for (let z=-Math.floor(def.size.z/3); z<=Math.floor(def.size.z/3); z++){
      const r = ribX.clone(); r.position.set(0, def.thickness+0.03, z*1.5); g.add(r);
    }
    const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, def.size.z), matMetalLite());
    for (let x=-Math.floor(def.size.x/3); x<=Math.floor(def.size.x/3); x++){
      const r = ribZ.clone(); r.position.set(x*1.5, def.thickness+0.06, 0); g.add(r);
    }
    return g;
  }

  if (def.baseType === 'wall'){
    // oriented long side along local X, thin along Z; rotate group if along Z
    const wall = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), matWall());
    wall.position.y = def.size.y/2;
    g.add(wall);
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  if (def.baseType === 'ceiling'){
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
    slab.position.y = def.thickness/2; g.add(slab);
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
  // along-edge axis: if side is ±x, edge runs along Z; if ±z, edge runs along X
  return (side.endsWith('x')) ? 'z' : 'x';
}
function edgeAxis(axis){ return (axis === 'z') ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }
function cellFromWorld(p){
  const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;
  return new THREE.Vector3(snap3(p.x), 0, snap3(p.z));
}