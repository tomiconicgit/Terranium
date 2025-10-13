// src/tools/Builder.js
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

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

    const key = `${def.id}|${sugg.pos.x.toFixed(2)},${sugg.pos.y.toFixed(2)},${sugg.pos.z.toFixed(2)}|${sugg.rot.y?.toFixed?.(2) ?? 0}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
      ghost.traverse(o => {
        if (o.isMesh){
          // Make ghost material slightly emissive for visibility in dark areas
          const m = o.material.clone();
          m.transparent = true; m.opacity = 0.45; m.depthWrite = false;
          if (m.emissive) m.emissive.multiplyScalar(0.5);
          else { m.emissive = new THREE.Color(0x888888); m.emissiveIntensity = 0.2; }
          o.material = m;
        }
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
    const snap3 = (v) => Math.round(v / 3) * 3;

    // ===== BEAM (now uses 'wall' logic but with smaller footprint) =====
    if (def.baseType === 'beam') {
      // On terrain
      if (hitObject === this.terrain) {
        const cx = snap3(hitPoint.x);
        const cz = snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.size.y / 2, cz);
        return { pos, rot: rotQ, foundationCenter: new THREE.Vector3(cx, 0, cz) };
      }
      // On top of a flat
      if (anchorRoot?.userData?.part?.baseType === 'flat' && n.y > 0.9) {
          const flat = anchorRoot;
          // Snap beam to corners/center of the flat tile
          const fc = flat.userData.foundationCenter;
          const localHit = hitPoint.clone().sub(fc);
          const snapX = Math.round(localHit.x / 1.5) * 1.5;
          const snapZ = Math.round(localHit.z / 1.5) * 1.5;
          const pos = new THREE.Vector3(fc.x + snapX, 0, fc.z + snapZ);
          pos.y = flat.position.y + (flat.userData.part.size.y / 2) + (def.size.y / 2);
          return { pos, rot: rotQ, foundationCenter: flat.userData.foundationCenter.clone() };
      }
       // Stack on another beam/wall (top face)
      if (anchorRoot && n.y > 0.9 && (anchorRoot.userData.part.baseType === 'beam' || anchorRoot.userData.part.baseType === 'wall')) {
        const base = anchorRoot;
        const pos = base.position.clone();
        pos.y += base.userData.part.size.y / 2 + def.size.y / 2;
        const foundationCenter = base.userData.foundationCenter?.clone() || new THREE.Vector3(Math.round(pos.x/3)*3, 0, Math.round(pos.z/3)*3);
        return { pos, rot: rotQ, foundationCenter };
      }
      return null;
    }

    // ===== FLATS =====
    if (def.baseType === 'flat'){
      if (anchorRoot?.userData?.part?.baseType === 'wall' && n.y > 0.9) {
        const wall = anchorRoot;
        const foundationCenter = wall.userData.foundationCenter;
        const pos = new THREE.Vector3(foundationCenter.x, 0, foundationCenter.z);
        pos.y = wall.position.y + (wall.userData.part.size.y / 2) + (def.size.y / 2);
        return { pos, rot: rotQ, foundationCenter: foundationCenter.clone() };
      }
      if (hitObject === this.terrain) {
        const cx = snap3(hitPoint.x);
        const cz = snap3(hitPoint.z);
        const pos = new THREE.Vector3(cx, def.size.y / 2, cz);
        return { pos, rot: rotQ, foundationCenter: new THREE.Vector3(cx, 0, cz) };
      }
      if (anchorRoot?.userData?.part?.baseType === 'flat' && Math.abs(n.y) < 0.1) {
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
      if (anchorRoot.userData.part.baseType === 'wall' && n.y > 0.9) {
        const baseWall = anchorRoot;
        const pos = baseWall.position.clone();
        pos.y += baseWall.userData.part.size.y;
        const rot = baseWall.quaternion.clone();
        const foundationCenter = baseWall.userData.foundationCenter.clone();
        return { pos, rot, foundationCenter };
      }
      if (anchorRoot.userData.part.baseType === 'flat' && n.y > 0.9) {
        const flat = anchorRoot;
        const cellCenter = flat.userData.foundationCenter;
        const side = pickSide(hitPoint, cellCenter);
        const out = outwardVector(side);
        const yaw = yawForSide(side);
        const rot = new THREE.Quaternion().setFromAxisAngle(Y, yaw);

        // Use def.size.z for thickness
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
    const { def, sugg } = h;

    const mesh = buildPart(def);
    mesh.position.copy(sugg.pos);
    mesh.quaternion.copy(sugg.rot);

    // Store the original definition on the object for later reference
    mesh.userData.part = def;
    mesh.userData.foundationCenter = sugg.foundationCenter.clone();

    this.world.add(mesh);
  }

  removeOne(){
    if (!this._hover?.anchorRoot) return;
    const r = this._hover.anchorRoot;
    if (r.parent === this.world) r.parent.remove(r);
  }
}

/* ---------- helpers ---------- */
const Y = new THREE.Vector3(0,1,0);
function findPlacedRoot(obj){ let p=obj; while(p){ if (p.parent && p.parent.name==='world') return p; p=p.parent; } return null; }
function worldNormal(hit){ const n=(hit.face?.normal?hit.face.normal.clone():new THREE.Vector3(0,1,0)); return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(); }
function pickSide(point, cellCenter){ const d=point.clone().sub(cellCenter); return (Math.abs(d.x)>Math.abs(d.z))?(d.x>=0?'+x':'-x'):(d.z>=0?'+z':'-z'); }
function outwardVector(side){ switch(side){ case '+x':return new THREE.Vector3(1,0,0); case '-x':return new THREE.Vector3(-1,0,0); case '+z':return new THREE.Vector3(0,0,1); case '-z':return new THREE.Vector3(0,0,-1);} return new THREE.Vector3(1,0,0); }
function yawForSide(side){ switch(side){ case '+x':return Math.PI/2; case '-x':return -Math.PI/2; case '+z':return 0; case '-z':return Math.PI; } return 0; }
