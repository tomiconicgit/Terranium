// src/tools/Builder.js — Overhauled snapping logic for stacking and adjacency
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.world = scene.getObjectByName('world');
    this.terrain = scene.getObjectByName('terrainPlane');
    this.catalog = makeCatalog();
    this.hotbar.setCatalog(this.catalog);

    this.ray = new THREE.Raycaster();
    this.preview = new THREE.Group();
    this.preview.name = 'ghost';
    this.scene.add(this.preview);

    this.prevKey = '';
    this.rot = 0;
    this._lastButtons = [];
    this._hover = null;
  }

  pad(){ const a=navigator.getGamepads?.()||[]; for(const p of a) if(p&&p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed,b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n&&!b; }

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

    const key = `${def.id}|${sugg.pos.x.toFixed(2)},${sugg.pos.y.toFixed(2)},${sugg.pos.z.toFixed(2)}|${sugg.rot.y?.toFixed?.(2)??0}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
      ghost.traverse(o=>{if(o.isMesh){const m=o.material.clone();m.transparent=true;m.opacity=0.45;m.depthWrite=false;o.material=m;}});
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

  suggest(def, hitPoint, n, anchorRoot, hitObject){
    const rotYaw = this.rot * Math.PI / 2;
    const rotQ = new THREE.Quaternion().setFromAxisAngle(Y, rotYaw);

    if (def.baseType === 'flat') {
      const isHittingFlat = anchorRoot?.userData?.part?.baseType === 'flat';
      if (isHittingFlat && n.y > 0.9) {
        const base = anchorRoot;
        const pos = base.position.clone();
        pos.y += base.userData.part.size.y;
        return { pos, rot: rotQ, foundationCenter: base.userData.foundationCenter.clone() };
      }
      if (isHittingFlat && Math.abs(n.y) < 0.1) {
        const base = anchorRoot;
        const out = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
        const pos = base.position.clone().addScaledVector(out, 3);
        pos.y = base.position.y;
        return { pos, rot: rotQ, foundationCenter: new THREE.Vector3(pos.x, 0, pos.z) };
      }
      if (hitObject === this.terrain) {
        const snap3 = (v) => Math.round(v / 3) * 3;
        const cx = snap3(hitPoint.x), cz = snap3(hitPoint.z);
        let adjacentY = null;
        for (const child of this.world.children) {
          if (child.userData?.part?.baseType === 'flat') {
            if (Math.hypot(child.position.x - cx, child.position.z - cz) < 3.1) {
              adjacentY = child.position.y;
              break;
            }
          }
        }
        const finalY = (adjacentY !== null)
          ? adjacentY
          : this.scene.getTerrainHeightAt(cx, cz) + def.size.y / 2;
        const pos = new THREE.Vector3(cx, finalY, cz);
        return { pos, rot: rotQ, foundationCenter: new THREE.Vector3(cx, 0, cz) };
      }
    }
    
    if (def.baseType === 'wall'){
      if (!anchorRoot) return null;
      if (anchorRoot.userData.part.baseType === 'wall' && n.y > 0.9) {
        const baseWall = anchorRoot;
        const pos = baseWall.position.clone();
        pos.y += baseWall.userData.part.size.y;
        return { pos, rot: baseWall.quaternion.clone(), foundationCenter: baseWall.userData.foundationCenter.clone() };
      }
      if (anchorRoot.userData.part.baseType === 'flat' && n.y > 0.9) {
        const flat = anchorRoot;
        const cellCenter = flat.userData.foundationCenter;
        const side = pickSide(hitPoint, cellCenter);
        const out = outwardVector(side);
        const yaw = yawForSide(side);
        const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
        const pos = cellCenter.clone().addScaledVector(out, 1.5 - (def.size.z / 2));
        pos.y = flat.position.y + (flat.userData.part.size.y / 2) + (def.size.y / 2);
        return { pos, rot, foundationCenter: cellCenter.clone() };
      }
      return null;
    }

    return null;
  }

  placeOne(){
    const h = this._hover; if (!h) return;
    const { def, sugg, anchorRoot } = h;
    const mesh = buildPart(def);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    mesh.userData.part = def;
    mesh.userData.foundationCenter = sugg.foundationCenter.clone();
    this.world.add(mesh);
    if (def.baseType === 'flat' && this.scene.pressSand && (!anchorRoot || anchorRoot.name === 'terrainPlane')) {
      const bottomY = mesh.position.y - def.size.y / 2;
      const innerR = 1.6, outerR = 4.5;
      this.scene.pressSand(new THREE.Vector3(sugg.foundationCenter.x, 0, sugg.foundationCenter.z), bottomY, innerR, outerR, 0.1);
    }
  }

  removeOne(){
    if (!this._hover?.anchorRoot) return;
    const r = this._hover.anchorRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }
}

const Y = new THREE.Vector3(0,1,0);
function findPlacedRoot(obj){ let p=obj; while(p){ if(p.parent?.name==='world')return p; p=p.parent; } return null; }
function worldNormal(hit){ const n=(hit.face?.normal?.clone()||new THREE.Vector3(0,1,0)); return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(); }
function pickSide(point, cellCenter){ const d=point.clone().sub(cellCenter); return(Math.abs(d.x)>Math.abs(d.z))?(d.x>=0?'+x':'-x'):(d.z>=0?'+z':'-z'); }
function outwardVector(side){ switch(side){ case'+x':return new THREE.Vector3(1,0,0); case'-x':return new THREE.Vector3(-1,0,0); case'+z':return new THREE.Vector3(0,0,1); case'-z':return new THREE.Vector3(0,0,-1);} return new THREE.Vector3(1,0,0); } // BUG FIX: Return a default vector
function yawForSide(side){ switch(side){ case'+x':return Math.PI/2; case'-x':return-Math.PI/2; case'+z':return 0; case'-z':return Math.PI; } return 0; }
