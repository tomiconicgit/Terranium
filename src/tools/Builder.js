// src/tools/Builder.js — Advanced snapping for procedural parts
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    this.terrain = scene.getObjectByName('terrainPlane');
    this.placedObjects = new THREE.Group();
    this.scene.add(this.placedObjects);
    
    this.catalog = makeCatalog();
    this.hotbar.setCatalog(this.catalog);

    this.ray = new THREE.Raycaster();
    this.preview = new THREE.Group();
    this.preview.name = 'ghost';
    this.scene.add(this.preview);

    this.prevKey = '';
    this._lastButtons = [];
    this._hover = null;
  }

  pad(){ const a=navigator.getGamepads?.()||[]; for(const p of a) if(p&&p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed,b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n&&!b; }

  update(){
    const def = this.catalog[this.hotbar.index];
    if (!def) return;

    const placePressed = this.pressed(7);
    const removePressed = this.pressed(6);

    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], false);
    
    if (!hits.length){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const sugg = this.suggestPlacement(def, hit);
    if (!sugg) { this.preview.visible = false; this._hover = null; return; }

    const pos = sugg.pos;
    const key = `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;

    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
      ghost.traverse(o=>{if(o.isMesh){const m=o.material.clone();m.transparent=true;m.opacity=0.45;m.depthWrite=false;o.material=m;}});
      this.preview.add(ghost);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    this.preview.visible = true;
    this._hover = { pos, def, hit };

    if (placePressed) this.placeOne();
    if (removePressed) this.removeOne();
  }

  suggestPlacement(def, hit) {
    const hitObj = hit.object;
    const n = hit.face.normal;
    const gridSize = def.size.x; // Assumes square parts

    // Case 1: Hitting the terrain
    if (hitObj === this.terrain) {
        const pos = new THREE.Vector3();
        // Snap to a grid, adjusting for the center of the 4x4 tile
        pos.x = Math.round(hit.point.x / gridSize) * gridSize;
        pos.z = Math.round(hit.point.z / gridSize) * gridSize;
        pos.y = def.size.y / 2; // Place on top of the ground
        return { pos };
    }

    // Case 2: Hitting another placed part
    if (hitObj.userData.part) {
        const basePos = hitObj.position.clone();
        const partSize = hitObj.userData.part.size;
        let pos;

        // On top of the part
        if (n.y > 0.9) {
            pos = basePos.clone();
            pos.y += partSize.y;
        }
        // On the side of the part
        else if (Math.abs(n.y) < 0.1) {
            const dir = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
            pos = basePos.clone().addScaledVector(dir, gridSize);
        } else {
            return null; // Don't place on bottom faces
        }
        return { pos };
    }

    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, def } = this._hover;
    const mesh = buildPart(def);
    mesh.position.copy(pos);
    this.placedObjects.add(mesh);
  }

  removeOne(){
    if (!this._hover?.hit) return;
    const obj = this._hover.hit.object;
    if (obj !== this.terrain) {
      obj.parent.remove(obj);
    }
  }
}
