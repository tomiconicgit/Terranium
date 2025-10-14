// src/tools/Builder.js â Simplified to basic grid placement
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

export class Builder {
  constructor(scene, camera, hotbar){
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;

    // We will add placed objects directly to the scene for simplicity
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

    // Only listen for place (RT) and remove (LT) buttons
    const placePressed = this.pressed(7);
    const removePressed = this.pressed(6);

    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    // Raycast against terrain and previously placed objects
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], false);
    
    if (!hits.length){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.01));
    
    // Simple grid snapping
    pos.x = Math.round(pos.x);
    pos.y = Math.round(pos.y);
    pos.z = Math.round(pos.z);
    
    // Adjust position based on block size
    pos.y = Math.max(0.5, pos.y); // Ensure it's not below ground
    
    const key = `${pos.x},${pos.y},${pos.z}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
      ghost.traverse(o=>{if(o.isMesh){const m=o.material.clone();m.transparent=true;m.opacity=0.45;m.depthWrite=false;o.material=m;}});
      this.preview.add(ghost);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    this.preview.visible = true;
    this._hover = { pos: pos, def: def, hit: hit };

    if (placePressed) this.placeOne();
    if (removePressed) this.removeOne();
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
