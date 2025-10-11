// Metal Flat + Walls — no vertical gap, smooth flats
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

    // ghost
    this.preview = new THREE.Group(); this.preview.visible = false;
    this.preview.name = 'ghost';
    this.scene.add(this.preview);
    this.prevKey = '';

    this.rot = 0;
    this._lastButtons = [];
    this._hover = null;
  }

  pad(){ const a=navigator.getGamepads?.()||[]; for (const p of a) if (p && p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed, b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n && !b; }

  update(){
    const def = this.catalog[this.hotbar.index];
    if (this.pressed(5)) this.hotbar.selectNext();
    if (this.pressed(4)) this.hotbar.selectPrev();
    if (this.pressed(1)) { this.rot = (this.rot + 1) & 3; this.prevKey=''; }

    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.world, this.terrain], true);
    if (!hits.length || !def){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const anchorRoot = findPlacedRoot(hit.object);
    const normal = worldNormal(hit);

    const sugg = this.suggest(def, hit.point, normal, anchorRoot, hit.object);
    if (!sugg){ this.preview.visible=false; this._hover=null; return; }

    // build/refresh ghost
    const key = `${def.id}|${sugg.axis}|${this.rot}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def, sugg.axis);
      ghost.traverse(o=>{
        if (o.isMesh){ const m=o.material.clone(); m.transparent=true; m.opacity=0.45; m.depthWrite=false; o.material=m; }
      });
      this.preview.add(ghost);
      this.prevKey = key;
    }
    this.preview.position.copy(sugg.pos);
    this.preview.quaternion.copy(sugg.rot);
    this.preview.visible = true;

    this._hover = { def, sugg, anchorRoot };

    if (this.pressed(7)) this.placeOne();
    if (this.pressed(6)) this.removeOne();
  }

  /* ---------- snapping ---------- */
  suggest(def, hitPoint, n, anchorRoot, hitObject){
    const rotYaw = this.rot * Math.PI/2;
    const rotQ = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);
    const snap3 = (x)=> Math.floor((x+1.5)/3)*3 + 1.5;
    const EPSY = 1e-4;

    // ===== METAL FLAT =====
    if (def.baseType === 'flat'){
      // place on terrain -> group.y = 0 (bottom sits on ground)
      if (!anchorRoot && hitObject === this.terrain && Math.abs(hitPoint.y) < 0.6){
        const cx=snap3(hitPoint.x), cz=snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, 0, cz);               // bottom at ground
        const axis = (this.rot & 1) ? 'z' : 'x';
        return { pos, rot: rotQ, axis, foundationCenter: new THREE.Vector3(cx,0,cz) };
      }
      // extend from existing flat -> keep same baseline (group.y)
      if (anchorRoot?.userData?.part?.type === 'flat'){
        const base = anchorRoot;
        const side = pickSide(hitPoint, base.position);
        const out  = outwardVector(side);
        const pos  = base.position.clone().addScaledVector(out, 3);
        pos.y = base.position.y;                                 // inherit baseline
        const axis = (this.rot & 1) ? 'z' : 'x';
        const newCell = base.position.clone().addScaledVector(out, 3);
        return { pos, rot: rotQ, axis, foundationCenter: newCell };
      }
      return null;
    }

    // ===== WALLS =====
    if (def.baseType === 'wall'){
      // must anchor to flat or to a wall tied to a flat
      let cellCenter = null;
      let wallBaseY  = 0;

      if (anchorRoot?.userData?.part?.type === 'flat'){
        cellCenter = anchorRoot.position.clone(); cellCenter.y = 0;
        const flat = anchorRoot.userData.part;
        // CORRECTED BUG #1: 'wallBaseY' must be the Y-coordinate of the flat's TOP surface.
        // This is the flat's bottom position (anchorRoot.position.y) plus its thickness.
        // The old code incorrectly set this to 0 for flats on the ground.
        wallBaseY = anchorRoot.position.y + flat.thickness;
      } else if (anchorRoot?.userData?.part?.type === 'wall' && anchorRoot.userData.foundationCenter){
        cellCenter = anchorRoot.userData.foundationCenter.clone();
        wallBaseY  = anchorRoot.userData.wallBaseY ?? anchorRoot.userData.baseTopY ?? 0;
      } else {
        return null; // disallow wall-on-terrain-alone
      }

      // stack on top if looking at a wall's top
      if (anchorRoot?.userData?.part?.type === 'wall' && Math.abs(n.y) > 0.5){
        const w = anchorRoot;
        const pos2 = w.position.clone(); pos2.y += w.userData.part.size.y; // Use existing wall's height
        const rot2 = new THREE.Quaternion().setFromAxisAngle(Y, yawForSide(w.userData.meta.side));
        const ax2  = w.userData.meta.axis;
        if (w.userData.meta.halfOffset) pos2.addScaledVector(edgeAxis(ax2), w.userData.meta.halfOffset);
        return { pos:pos2, rot:rot2, axis:ax2, side:w.userData.meta.side, halfOffset:w.userData.meta.halfOffset,
                 foundationCenter: w.userData.foundationCenter.clone(), wallBaseY };
      }

      // snap to flat edge
      const side = pickSide(hitPoint, cellCenter);
      const yaw  = yawForSide(side);
      const rot  = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const axis = axisForSide(side);

      const out  = outwardVector(side);
      const pos  = cellCenter.clone()
        .addScaledVector(out, 1.5 + def.thickness/2);

      // CORRECTED BUG #2: The wall's group origin is its bottom.
      // So, we just need to set its y-position directly to the calculated base height.
      // The old code incorrectly added half the wall's height (`def.size.y/2`), pushing it way up.
      pos.y = wallBaseY;

      // half wall: left/right selection
      const local = hitPoint.clone().sub(cellCenter);
      if (def.size.x === 1.5){
        const along = (axis === 'z') ? local.z : local.x;
        const halfOffset = (along >= 0 ? +0.75 : -0.75);
        pos.addScaledVector(edgeAxis(axis), halfOffset);
        return { pos, rot, axis, side, halfOffset, foundationCenter: cellCenter.clone(), wallBaseY };
      }

      return { pos, rot, axis, side, foundationCenter: cellCenter.clone(), wallBaseY };
    }

    return null;
  }

  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg } = h;

    const mesh = buildPart(def, sugg.axis);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    mesh.userData.part = { type:def.baseType, size:def.size, thickness:def.thickness };
    mesh.userData.meta = { axis:sugg.axis, side:sugg.side, halfOffset:sugg.halfOffset };
    mesh.userData.foundationCenter = sugg.foundationCenter
      ? sugg.foundationCenter.clone()
      : cellFromWorld(mesh.position);

    // CORRECTED BUG #3: When caching the base height for future stacking, it must be the object's
    // TOP surface, which is its bottom position plus its thickness/height.
    // The old code incorrectly set this to 0 for flats on the ground.
    if (def.baseType === 'flat'){
      mesh.userData.wallBaseY = mesh.position.y + def.thickness;
    } else if (def.baseType === 'wall'){
      mesh.userData.wallBaseY = mesh.position.y + def.size.y;
    }

    this.world.add(mesh);
  }

  removeOne(){
    if (!this._hover?.anchorRoot) return;
    const r = this._hover.anchorRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }
}

/* ---------- catalog + builders ---------- */
function makeCatalog(){
  return [
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

function matMetal(){ return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matWall(){  return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

function buildPart(def, axis='x'){
  const g = new THREE.Group();
  const EPS = 0.04; // remove corner seam

  if (def.baseType === 'wall'){
    const len = def.size.x + EPS;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, def.size.y, def.thickness), matWall());
    // The group's origin is the BOTTOM of the wall.
    wall.position.y = def.size.y/2;
    g.add(wall);
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  if (def.baseType === 'flat'){
    // The group's origin is the BOTTOM of the flat.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
    slab.position.y = def.thickness/2;
    g.add(slab);
    if (axis === 'z') g.rotation.y = Math.PI/2;
    return g;
  }

  return g;
}

/* ---------- helpers ---------- */
const Y = new THREE.Vector3(0,1,0);
function findPlacedRoot(obj){ let p=obj; while(p){ if (p.parent && p.parent.name==='world') return p; p=p.parent; } return null; }
function worldNormal(hit){ const n=(hit.face?.normal?hit.face.normal.clone():new THREE.Vector3(0,1,0)); return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(); }
function pickSide(point, cellCenter){ const d=point.clone().sub(cellCenter); return (Math.abs(d.x)>Math.abs(d.z))?(d.x>=0?'+x':'-x'):(d.z>=0?'+z':'-z'); }
function outwardVector(side){ switch(side){ case '+x':return new THREE.Vector3(1,0,0); case '-x':return new THREE.Vector3(-1,0,0); case '+z':return new THREE.Vector3(0,0,1); case '-z':return new THREE.Vector3(0,0,-1);} return new THREE.Vector3(1,0,0); }
function yawForSide(side){ switch(side){ case '+x':return Math.PI/2; case '-x':return -Math.PI/2; case '+z':return 0; case '-z':return Math.PI; } return 0; }
function axisForSide(side){ return (side.endsWith('x')) ? 'z' : 'x'; }
function edgeAxis(axis){ return (axis === 'z') ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }
function cellFromWorld(p){ const snap3=(x)=> Math.floor((x+1.5)/3)*3 + 1.5; return new THREE.Vector3(snap3(p.x),0,snap3(p.z)); }
