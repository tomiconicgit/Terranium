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
    const key = `${def.id}|${sugg.pos.x.toFixed(2)},${sugg.pos.y.toFixed(2)},${sugg.pos.z.toFixed(2)}|${sugg.rot.y.toFixed(2)}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
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
    if (this.pressed(6)) this.removeOne(); // <<< RE-ADDED THIS LINE
  }

  /* ---------- snapping ---------- */
  suggest(def, hitPoint, n, anchorRoot, hitObject){
    const rotYaw = this.rot * Math.PI/2;
    const rotQ = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);
    const snap3 = (v) => Math.round(v / 3) * 3;

    // ===== METAL FLAT =====
    if (def.baseType === 'flat'){
      // Case 1: Place on top of a wall (ceiling)
      if (anchorRoot?.userData?.part?.type === 'wall' && n.y > 0.9) {
        const wall = anchorRoot;
        const foundationCenter = wall.userData.foundationCenter;
        const pos = new THREE.Vector3(foundationCenter.x, 0, foundationCenter.z);
        // Position flat's center on top of the wall's top surface
        pos.y = wall.position.y + (wall.userData.part.size.y / 2) + (def.thickness / 2);
        return { pos, rot: rotQ, foundationCenter: foundationCenter.clone() };
      }

      // Case 2: Place on terrain
      if (hitObject === this.terrain) {
        const cx = snap3(hitPoint.x);
        const cz = snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.thickness / 2, cz);
        return { pos, rot: rotQ, foundationCenter: new THREE.Vector3(cx, 0, cz) };
      }

      // Case 3: Extend from an existing flat (on the side)
      if (anchorRoot?.userData?.part?.type === 'flat' && Math.abs(n.y) < 0.1) {
        const base = anchorRoot;
        const out = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
        const pos = base.position.clone().addScaledVector(out, 3);
        pos.y = base.position.y;
        const foundationCenter = new THREE.Vector3(pos.x, 0, pos.z);
        return { pos, rot: rotQ, foundationCenter };
      }

      return null;
    }

    // ===== WALLS =====
    if (def.baseType === 'wall'){
      if (!anchorRoot) return null;

      // Case 1: Stack on top of another wall
      if (anchorRoot.userData.part.type === 'wall' && n.y > 0.9) {
        const baseWall = anchorRoot;
        const pos = baseWall.position.clone();
        pos.y += baseWall.userData.part.size.y; // Stack center on center
        const rot = baseWall.quaternion.clone();
        const foundationCenter = baseWall.userData.foundationCenter.clone();
        return { pos, rot, foundationCenter };
      }

      // Case 2: Place on the edge of a flat
      if (anchorRoot.userData.part.type === 'flat' && n.y > 0.9) {
        const flat = anchorRoot;
        const cellCenter = flat.userData.foundationCenter;
        const side = pickSide(hitPoint, cellCenter);
        const out = outwardVector(side);
        const yaw = yawForSide(side);
        const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);

        // Position wall's outer face flush with the grid boundary
        const pos = cellCenter.clone().addScaledVector(out, 1.5 - (def.thickness / 2));
        // Position wall's center on top of the flat's top surface
        pos.y = flat.position.y + (flat.userData.part.thickness / 2) + (def.size.y / 2);

        return { pos, rot, foundationCenter: cellCenter.clone() };
      }
      
      return null;
    }

    return null;
  }

  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg } = h;

    const mesh = buildPart(def);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    mesh.userData.part = { type: def.baseType, size: def.size, thickness: def.thickness };
    mesh.userData.foundationCenter = sugg.foundationCenter.clone();

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
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:'#b8c2cc' },
    { id:'metal_wall', name:'Metal Wall (3×3)', baseType:'wall', kind:'wall',
      size:{x:3, y:3, z:0.2}, thickness:0.2, preview:'#dfe6ee' },
  ];
}

function matMetal(){ return new THREE.MeshStandardMaterial({ color:0x9ea6af, roughness:0.45, metalness:0.85 }); }
function matWall(){  return new THREE.MeshStandardMaterial({ color:0xe6edf5, roughness:0.4,  metalness:0.9  }); }

function buildPart(def){
  const g = new THREE.Group();
  let mesh;

  if (def.baseType === 'wall'){
    mesh = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness), matWall());
  } else if (def.baseType === 'flat'){
    mesh = new THREE.Mesh(new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z), matMetal());
  }

  if (mesh) g.add(mesh);
  // The mesh's origin IS the group's origin now (center of the box)
  return g;
}

/* ---------- helpers ---------- */
const Y = new THREE.Vector3(0,1,0);
function findPlacedRoot(obj){ let p=obj; while(p){ if (p.parent && p.parent.name==='world') return p; p=p.parent; } return null; }
function worldNormal(hit){ const n=(hit.face?.normal?hit.face.normal.clone():new THREE.Vector3(0,1,0)); return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(); }
function pickSide(point, cellCenter){ const d=point.clone().sub(cellCenter); return (Math.abs(d.x)>Math.abs(d.z))?(d.x>=0?'+x':'-x'):(d.z>=0?'+z':'-z'); }
function outwardVector(side){ switch(side){ case '+x':return new THREE.Vector3(1,0,0); case '-x':return new THREE.Vector3(-1,0,0); case '+z':return new THREE.Vector3(0,0,1); case '-z':return new THREE.Vector3(0,0,-1);} return new THREE.Vector3(1,0,0); }
function yawForSide(side){ switch(side){ case '+x':return Math.PI/2; case '-x':return -Math.PI/2; case '+z':return 0; case '-z':return Math.PI; } return 0; }
