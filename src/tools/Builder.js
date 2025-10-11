// NMS-style builder (controller-only)
// - NO mini-grid; snap to 3×3 cells
// - Ghost preview
// - Parts: foundations, walls (full/half), ceilings (full/half)
// - Foundations only at ground y≈0; carve terrain voxels underneath
// - Walls snap to foundation edges & stack; ceilings snap above walls/foundations
// Controls: R2 place, L2 remove, R1/L1 hotbar, B rotate 90°, Y toggle attach-outwards
import * as THREE from 'three';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world = scene.getObjectByName('world');
    this.ground = scene.getObjectByName('groundInstanced');

    this.ray = new THREE.Raycaster();

    // catalog
    this.catalog = createCatalog();
    this.hotbar.setCatalog(this.catalog);

    // ghost
    this.preview = new THREE.Group();
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.prevKey = '';

    // state
    this.rot = 0;             // 0,1,2,3    (90° steps)
    this.attachOut = false;   // Y toggle
    this._lastButtons = [];
    this._hover = null;
  }

  pad(){ const pads = navigator.getGamepads?.()||[]; for (const p of pads) if (p&&p.connected) return p; return null; }
  pressed(i){
    const p=this.pad(); if(!p) return false;
    const now=!!p.buttons[i]?.pressed, prev=!!this._lastButtons[i];
    this._lastButtons[i]=now; return now && !prev;
  }

  update(){
    const def = this.catalog[this.hotbar.index];
    if (this.pressed(5)) this.hotbar.selectNext(); // R1
    if (this.pressed(4)) this.hotbar.selectPrev(); // L1
    if (this.pressed(1)) { this.rot=(this.rot+1)&3; this.prevKey=''; } // B rotate
    if (this.pressed(3)) { this.attachOut=!this.attachOut; this.prevKey=''; } // Y toggle

    // aim
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.ground], true);
    if (!hits.length || !def) { this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const targetRoot = findRoot(hit.object);
    const normal = worldNormal(hit);

    // compute placement suggestion
    const sugg = this.suggest(def, hit, targetRoot, normal);
    if (!sugg) { this.preview.visible=false; this._hover=null; return; }

    // build ghost
    const wantKey = `${def.id}|${sugg.axis}|${this.rot}`;
    if (wantKey !== this.prevKey){
      this.preview.clear();
      const ghost = makePart(def, sugg.axis);
      ghost.traverse(o=>{
        if (o.isMesh){
          const m=o.material.clone(); m.transparent=true; m.opacity=0.45; m.depthWrite=false; o.material=m;
        }
      });
      this.preview.add(ghost);
      this.prevKey = wantKey;
    }
    this.preview.position.copy(sugg.pos);
    this.preview.quaternion.copy(sugg.rot);
    this.preview.visible = true;

    this._hover = { def, sugg, targetRoot };

    if (this.pressed(7)) this.placeOne();   // R2 place
    if (this.pressed(6)) this.removeOne();  // L2 remove
  }

  /* ---------------- placement recipes ---------------- */
  suggest(def, hit, targetRoot, n){
    // rotation quaternion around Y (global) for B steps
    const qStep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this.rot * Math.PI/2);

    // Ground snap cell for foundations/ceilings when free-placing
    const snap3 = (x)=> Math.floor(x/3)*3 + 1.5;

    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();

    if (def.kind === 'foundation'){
      // must hit ground and be near y≈0
      const p = hit.point;
      const cy = 0.125; // thickness/2
      const cx = snap3(p.x), cz = snap3(p.z);
      // only permit when ray is close to floor (or below)
      if (p.y > 0.6) return null;
      pos.set(cx, cy, cz);
      rot.copy(qStep);

      // axis used to choose half-foundation long edge
      const axis = (this.rot&1) ? 'z' : 'x';
      return { pos, rot, axis, carve: { cx, cz, w:def.size.x, l:def.size.z } };
    }

    // If we hit a foundation or wall/ceiling, use that as anchor
    const anchor = targetRoot && targetRoot.userData?.part;
    const anchorCenter = anchor ? targetRoot.position.clone() : new THREE.Vector3(snap3(hit.point.x), 0, snap3(hit.point.z));

    if (def.kind === 'wall'){
      // Snap to nearest side of a foundation or wall; stack if aiming top of wall
      if (anchor?.type === 'wall' && n.y > 0.5){
        // stack above
        pos.copy(targetRoot.position).add(new THREE.Vector3(0, def.size.y, 0));
        rot.copy(qStep);
        const axis = sideAxisFromQuat(qStep);
        return { pos, rot, axis };
      }

      // find side relative to anchor center from hit point
      const local = hit.point.clone().sub(anchorCenter);
      const side = Math.abs(local.x) > Math.abs(local.z) ? (local.x>0?'+x':'-x') : (local.z>0?'+z':'-z');
      const axis = (side==='±x' || side==='+x' || side==='-x') ? 'x' : 'z';

      const dx = side.startsWith('+') ? +1 : -1;
      if (side.endsWith('x')) pos.set(anchorCenter.x + dx*(anchor?.type==='wall'?def.thickness/2:1.5 + def.thickness/2),  def.size.y/2, anchorCenter.z);
      else                    pos.set(anchorCenter.x, def.size.y/2, anchorCenter.z + dx*(anchor?.type==='wall'?def.thickness/2:1.5 + def.thickness/2));

      // rotation: face outward along the side; then apply B-steps
      const faceY = side.endsWith('x') ? (side.startsWith('+')?  Math.PI/2 : -Math.PI/2) : (side.startsWith('+')? 0 : Math.PI);
      rot.setFromAxisAngle(new THREE.Vector3(0,1,0), faceY).multiply(qStep);

      return { pos, rot, axis };
    }

    if (def.kind === 'ceiling'){
      // If anchor is wall and we're looking at/near its top, place above it.
      if (anchor?.type === 'wall' && n.y > 0.5){
        const dir = this.attachOut ? outDirFromQuat(targetRoot.quaternion) : new THREE.Vector3(0,0,0);
        pos.copy(targetRoot.position).add(new THREE.Vector3(0, anchor.size.y/2 + def.thickness/2, 0)).addScaledVector(dir, 1.5);
        rot.copy(qStep);
        const axis = (this.rot&1) ? 'z':'x';
        return { pos, rot, axis };
      }
      // else snap freely above ground/foundation
      pos.set(snap3(hit.point.x), def.thickness/2 + (anchor?.type==='foundation'?anchor.thickness:0), snap3(hit.point.z));
      rot.copy(qStep);
      const axis = (this.rot&1) ? 'z':'x';
      return { pos, rot, axis };
    }

    return null;
  }

  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg } = h;

    const mesh = makePart(def, sugg.axis);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);
    mesh.userData.part = { type: def.baseType, size: def.size, thickness: def.thickness };
    this.world.add(mesh);

    // carve ground if foundation
    if (sugg.carve) this.carveUnder(sugg.carve.cx, sugg.carve.cz, def.size.x, def.size.z);
  }

  removeOne(){
    if (!this._hover?.targetRoot) return;
    const r = this._hover.targetRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }

  carveUnder(cx, cz, w, l){
    // move ground voxels under [cx-w/2 .. cx+w/2] × [cz-l/2 .. cz+l/2] down to y=-20
    if (!this.ground) return;
    const size = this.ground.userData.size, half=this.ground.userData.half, idx=this.ground.userData.getIndex;
    const tmp = new THREE.Object3D();
    const minX = Math.floor(cx - w/2), maxX = Math.ceil(cx + w/2);
    const minZ = Math.floor(cz - l/2), maxZ = Math.ceil(cz + l/2);

    for (let x=minX; x<maxX; x++){
      for (let z=minZ; z<maxZ; z++){
        const i = idx(x, z);
        if (i < 0) continue;
        // push it far below
        tmp.position.set(x, -20, z); tmp.rotation.set(0,0,0); tmp.scale.set(1,1,1); tmp.updateMatrix();
        this.ground.setMatrixAt(i, tmp.matrix);
      }
    }
    this.ground.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- parts & helpers ---------------- */

function createCatalog(){
  return [
    // foundations
    { id:'metal_foundation', name:'Metal Foundation (3×3)', kind:'foundation', baseType:'foundation', size:{x:3,y:0.25,z:3}, thickness:0.25, preview:'#a9b6c4' },
    { id:'half_foundation',  name:'Half Foundation (2×3)', kind:'foundation', baseType:'foundation', size:{x:2,y:0.25,z:3}, thickness:0.25, preview:'#a9b6c4' },

    // walls
    { id:'metal_wall', name:'Metal Wall (3×3)', kind:'wall', baseType:'wall', size:{x:3,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },
    { id:'half_wall',  name:'Half Wall (2×3)',  kind:'wall', baseType:'wall', size:{x:2,y:3,z:0.2}, thickness:0.2, preview:'#dfe6ee' },

    // ceilings
    { id:'metal_ceiling', name:'Metal Ceiling (3×3)', kind:'ceiling', baseType:'ceiling', size:{x:3,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' },
    { id:'half_ceiling',  name:'Half Ceiling (2×3)',  kind:'ceiling', baseType:'ceiling', size:{x:2,y:0.2,z:3}, thickness:0.2, preview:'#b8c2cc' }
  ];
}

function makePart(def, axis='x'){
  // Rotate geometry if B-rotation swaps long edge
  const g = new THREE.Group();

  if (def.baseType === 'foundation'){
    const plate = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), metal());
    plate.position.y = def.thickness/2;
    g.add(plate);

    // simple beams & plates to look “procedural”
    const beam = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.18), steel());
    for (let z=-1; z<=1; z++) {
      const b = beam.clone(); b.position.set(0, def.thickness+0.03, z*1.5); g.add(b);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, def.size.z), steel());
    for (let x=-1; x<=1; x++) {
      const c = cross.clone(); c.position.set(x*1.5, def.thickness+0.06, 0); g.add(c);
    }
  }

  if (def.baseType === 'wall'){
    const wall = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), wallMetal());
    wall.position.y = def.size.y/2;
    g.add(wall);

    // ribs
    const rib = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.08), steel());
    for (let y=0.5; y<def.size.y; y+=0.5){
      const r = rib.clone(); r.position.set(0, y, def.thickness/2 + 0.01); g.add(r);
    }
  }

  if (def.baseType === 'ceiling'){
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), metal());
    slab.position.y = def.thickness/2;
    g.add(slab);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, 0.06, 0.18), steel());
    for (let z=-1; z<=1; z++){
      const b = brace.clone(); b.position.set(0, def.thickness+0.03, z*1.5); g.add(b);
    }
  }

  return g;
}

/* materials */
function metal(){  return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function wallMetal(){ return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4, metalness:0.9 }); }
function steel(){  return new THREE.MeshStandardMaterial({ color:0xb8c2cc, roughness:0.6, metalness:0.7 }); }

/* selection helpers */
function findRoot(o){ for (let p=o; p; p=p.parent){ if (p.parent && p.parent.name==='world') return p; } return null; }
function worldNormal(hit){
  const n = (hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0));
  return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
}
function outDirFromQuat(q){
  // forward of wall: +Z in local -> world dir
  return new THREE.Vector3(0,0,1).applyQuaternion(q).setY(0).normalize();
}
function sideAxisFromQuat(q){
  // use yaw to choose X/Z
  const fwd = new THREE.Vector3(0,0,1).applyQuaternion(q);
  return Math.abs(fwd.x) > Math.abs(fwd.z) ? 'x' : 'z';
}