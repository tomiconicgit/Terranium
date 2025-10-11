// src/tools/Builder.js
// Controller-only builder with NMS-like snapping.
// Terrain is a flat plane named 'terrain' (y=0).
// Parts: foundations (3×3, half 2×3), walls (3×3, half 1.5×3, thin, vertical), ceilings (3×3, half 1.5×3).
// Rules:
//  - Foundations can only be placed on terrain (y≈0). They snap to a 3-unit grid (centers at ...,-1.5,1.5,4.5,...).
//  - Full wall attaches to a foundation edge (spans the whole side). Half wall attaches to LEFT or RIGHT half
//    of the side depending on where you look; two halves fill one side.
//  - Looking at the TOP of a wall stacks a new wall above with the same side/orientation. Half walls stack
//    using the same half (left/right) you looked at.
//  - Ceilings snap flat on top of foundations. Looking at a wall (from above or below) places the ceiling on
//    the adjacent 3×3 cell *outside* that wall’s side; half ceilings pick left/right half automatically.
//  - R2 place once, L2 remove once. R1/L1 next/prev. B rotates 90° (affects foundations & ceilings).
import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene  = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world   = scene.getObjectByName('world');
    this.terrain = scene.getObjectByName('terrain');

    this.catalog = makeCatalog();
    this.hotbar.setCatalog(this.catalog);

    this.ray = new THREE.Raycaster();

    // Ghost preview
    this.preview = new THREE.Group(); this.preview.visible = false;
    this.scene.add(this.preview);
    this.prevKey = '';

    // state
    this.rot = 0;                 // 0,1,2,3 (90° steps) for foundations/ceilings
    this._lastButtons = [];
    this._hover = null;
  }

  // ---- gamepad helpers ----
  pad(){ const a=navigator.getGamepads?.()||[]; for (const p of a) if (p && p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed, b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n && !b; }

  // ---- frame update ----
  update(){
    const def = this.catalog[this.hotbar.index];

    if (this.pressed(5)) this.hotbar.selectNext(); // R1
    if (this.pressed(4)) this.hotbar.selectPrev(); // L1
    if (this.pressed(1)) { this.rot = (this.rot + 1) & 3; this.prevKey=''; } // B rotate

    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.terrain], true);
    if (!hits.length || !def) { this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const anchorRoot = findPlacedRoot(hit.object);
    const normal = worldNormal(hit);

    const sugg = this.suggest(def, hit.point, normal, anchorRoot);
    if (!sugg) { this.preview.visible=false; this._hover=null; return; }

    // ghost mesh
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

    if (this.pressed(7)) this.placeOne();   // R2
    if (this.pressed(6)) this.removeOne();  // L2
  }

  // ---- placement rules ----
  suggest(def, hitPoint, n, anchorRoot){
    const rotYaw = this.rot * Math.PI/2;
    const qStep = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);

    // 3-unit grid centers: ...,-1.5, 1.5, 4.5, ...
    const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;

    // ------------- FOUNDATION -------------
    if (def.baseType === 'foundation'){
      // must be the terrain and near y=0
      if (!anchorRoot && Math.abs(hitPoint.y) < 0.6) {
        const cx = snap3(hitPoint.x), cz = snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.thickness/2, cz);
        const rot = qStep.clone();
        const axis = (this.rot & 1) ? 'z' : 'x';
        return { pos, rot, axis };
      }
      // allow snapping next to an existing foundation by looking at ground close to its edge
      if (anchorRoot?.userData?.part?.type === 'foundation'){
        const base = anchorRoot.userData.meta;
        const side = pickSide(hitPoint, anchorRoot.position);
        const outward = outwardVector(side);
        const pos = anchorRoot.position.clone()
          .addScaledVector(outward, (def.size.x===3?3: (this.rot&1)?3:2)); // full or half/rotated span
        pos.y = def.thickness/2;
        const rot = qStep.clone();
        const axis = (this.rot & 1) ? 'z':'x';
        return { pos, rot, axis };
      }
      return null;
    }

    // ---------- derive an "anchor cell" (foundation center) ----------
    let cellCenter = null;   // center of the 3×3 cell we’re attaching to
    let side = null;         // '+x','-x','+z','-z'
    let anchor = null;

    // if we hit a placed thing, crawl up to its foundation if it has one
    if (anchorRoot?.userData?.part){
      anchor = anchorRoot;
      if (anchor.userData.part.type === 'foundation') {
        cellCenter = anchor.position.clone();
      } else if (anchor.userData.part.type === 'wall') {
        cellCenter = anchor.userData.foundationCenter.clone();
      } else if (anchor.userData.part.type === 'ceiling') {
        cellCenter = anchor.userData.foundationCenter.clone();
      }
    }

    // if still no cell, snap to terrain cell under the look point (for ceilings)
    if (!cellCenter) {
      cellCenter = new THREE.Vector3(snap3(hitPoint.x), 0, snap3(hitPoint.z));
    }

    // ------------- WALLS -------------
    if (def.baseType === 'wall'){
      // Decide which side of the cell we’re looking at
      side = pickSide(hitPoint, cellCenter);

      // Are we stacking on an existing wall with same side?
      if (anchor?.userData?.part?.type === 'wall' && Math.abs(n.y) > 0.5) {
        // Use anchor’s side/orientation and half-offset (if any)
        const aMeta = anchor.userData.meta;
        const pos = anchor.position.clone();
        pos.y += def.size.y; // next storey
        const rot = new THREE.Quaternion().setFromAxisAngle(Y, yawForSide(aMeta.side));
        const axis = aMeta.axis;
        if (aMeta.halfOffset) pos.addScaledVector(edgeAxis(axis), aMeta.halfOffset);
        return { pos, rot, axis };
      }

      // Otherwise attach to the chosen side of the cell center
      const yaw = yawForSide(side);
      const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const axis = axisForSide(side);       // along-edge axis: 'x' or 'z'

      // base position sits on the edge with outward offset = thickness/2
      const outward = outwardVector(side);
      const pos = cellCenter.clone()
        .addScaledVector(outward, 1.5 + def.thickness/2);
      pos.y = def.size.y / 2;

      // figure half/full placement along the side using local coordinate
      const local = hitPoint.clone().sub(cellCenter);
      let halfOffset = 0; // for half walls ±0.75 along the edge
      if (def.size.x === 1.5) {
        const along = (axis === 'z') ? local.z : local.x;
        halfOffset = (along >= 0) ? +0.75 : -0.75;
        pos.addScaledVector(edgeAxis(axis), halfOffset);
      }

      return { pos, rot, axis, side, halfOffset };
    }

    // ------------- CEILINGS -------------
    if (def.baseType === 'ceiling'){
      // If looking at a wall (from above/below), ceiling goes on the adjacent cell OUTSIDE that wall’s side.
      if (anchor?.userData?.part?.type === 'wall'){
        const aMeta = anchor.userData.meta;
        const out = outwardVector(aMeta.side);
        const newCell = anchor.userData.foundationCenter.clone().addScaledVector(out, 3);
        const yaw = this.rot * Math.PI/2; // you can rotate the ceiling relative to the cell
        const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
        const axis = (this.rot & 1) ? 'z' : 'x';

        const pos = newCell.clone();
        pos.y = def.thickness/2 + anchor.userData.part.size.y; // sits atop wall height

        // for half ceilings, choose left/right half along edge based on look point
        if (def.size.x === 1.5){
          const local = hitPoint.clone().sub(newCell);
          const along = (axis === 'z') ? local.z : local.x;
          const offset = (along >= 0) ? +0.75 : -0.75;
          pos.addScaledVector(edgeAxis(axis), offset);
        }
        return { pos, rot, axis, foundationCenter:newCell };
      }

      // Otherwise: snap above the current cell (foundation or terrain)
      const yaw = this.rot * Math.PI/2;
      const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const axis = (this.rot & 1) ? 'z' : 'x';
      const pos = cellCenter.clone(); pos.y = def.thickness / 2;
      // If there’s a foundation at this cell, lift to its top for visual continuity
      if (anchor?.userData?.part?.type === 'foundation') pos.y += anchor.userData.part.thickness;

      // half option: pick left/right by where you looked on the cell
      if (def.size.x === 1.5){
        const local = hitPoint.clone().sub(cellCenter);
        const along = (axis === 'z') ? local.z : local.x;
        const offset = (along >= 0) ? +0.75 : -0.75;
        pos.addScaledVector(edgeAxis(axis), offset);
      }
      return { pos, rot, axis, foundationCenter:cellCenter.clone() };
    }

    return null;
  }

  // ---- actions ----
  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg } = h;

    const mesh = buildPart(def, sugg.axis);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    // annotate meta for future snaps/stacks
    mesh.userData.part = { type:def.baseType, size:def.size, thickness:def.thickness };
    const meta = { axis:sugg.axis };
    if (sugg.side) meta.side = sugg.side;
    if (sugg.halfOffset) meta.halfOffset = sugg.halfOffset;
    mesh.userData.meta = meta;

    // remember the “cell” this part belongs to for stacking/ceilings-from-walls
    mesh.userData.foundationCenter = cellFromWorld(mesh.position);

    this.world.add(mesh);
  }

  removeOne(){
    if (!this._hover?.anchorRoot) return;
    const r = this._hover.anchorRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }
}

/* =============================================
   Catalog + Part builders
============================================= */
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

function buildPart(def, axis='x'){
  const g = new THREE.Group();

  if (def.baseType === 'foundation'){
    const top = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), metal());
    top.position.y = def.thickness/2; g.add(top);

    // Beams/ribs for look
    const ribX = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.16), steel());
    for (let z=-Math.floor(def.size.z/3); z<=Math.floor(def.size.z/3); z++){
      const r = ribX.clone(); r.position.set(0, def.thickness+0.03, z*1.5); g.add(r);
    }
    const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, def.size.z), steel());
    for (let x=-Math.floor(def.size.x/3); x<=Math.floor(def.size.x/3); x++){
      const r = ribZ.clone(); r.position.set(x*1.5, def.thickness+0.06, 0); g.add(r);
    }
    return g;
  }

  if (def.baseType === 'wall'){
    // oriented so length runs along local X; thin along Z
    const wall = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), wallMetal());
    wall.position.y = def.size.y/2;
    g.add(wall);

    // rotate 90° if the along-edge axis is Z
    if (axis === 'z') g.rotation.y = Math.PI/2;

    // small ribs on front face
    const rib = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.08), steel());
    for (let y=0.5; y<def.size.y; y+=0.5){
      const r = rib.clone(); r.position.set(0, y, def.thickness/2 + 0.01); g.add(r);
    }
    return g;
  }

  if (def.baseType === 'ceiling'){
    // oriented square (or 1.5×3). Axis only changes visual ribs direction
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), metal());
    slab.position.y = def.thickness/2; g.add(slab);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.16), steel());
    for (let z=-Math.floor(def.size.z/3); z<=Math.floor(def.size.z/3); z++){
      const b = brace.clone(); b.position.set(0, def.thickness+0.03, z*1.5); g.add(b);
    }
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  return g;
}

/* =============================================
   Small helpers
============================================= */
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
  // along-edge axis: if we’re on +x/-x side, edge runs along Z
  return (side.endsWith('x')) ? 'z' : 'x';
}
function edgeAxis(axis){ return (axis === 'z') ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }

function cellFromWorld(p){
  const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;
  return new THREE.Vector3(snap3(p.x), 0, snap3(p.z));
}

/* materials */
function metal(){  return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function wallMetal(){ return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4, metalness:0.9 }); }
function steel(){  return new THREE.MeshStandardMaterial({ color:0xb8c2cc, roughness:0.6, metalness:0.7 }); }