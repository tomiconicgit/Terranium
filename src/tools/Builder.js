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
    const key = `${def.id}|${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;

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
    const pos = new THREE.Vector3();

    // Case 1: Hitting the terrain (for Metal Floor)
    if (hitObj === this.terrain && def.id === "metal_floor") {
        const gridSize = def.size.x; // 4 for metal floor
        pos.x = Math.round(hit.point.x / gridSize) * gridSize;
        pos.z = Math.round(hit.point.z / gridSize) * gridSize;
        pos.y = def.size.y / 2;
        return { pos };
    }

    // Case 2: Hitting another placed part
    if (hitObj.userData.part) {
        const basePart = hitObj.userData.part;
        const basePos = hitObj.position.clone();
        const baseSize = basePart.size;

        // Placing Metal Floor on top of another Metal Floor
        if (def.id === "metal_floor" && basePart.id === "metal_floor" && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y;
            return { pos };
        }
        // Placing Metal Floor next to another Metal Floor
        else if (def.id === "metal_floor" && basePart.id === "metal_floor" && Math.abs(n.y) < 0.1) {
            const dir = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
            pos.copy(basePos).addScaledVector(dir, baseSize.x);
            return { pos };
        }
        // ✨ NEW LOGIC: Placing Metal Beam on top of Metal Floor
        else if (def.id === "metal_beam" && basePart.id === "metal_floor" && n.y > 0.9) {
            // Calculate world position based on hit point
            const worldHitPoint = hit.point;
            
            // Convert world hit point to local coordinates of the floor object
            const localHitPoint = hitObj.worldToLocal(worldHitPoint.clone());
            
            // Normalize local hit point from -baseSize/2 to +baseSize/2 range
            // to a 0-1 range across the face of the block
            const uvX = (localHitPoint.x + baseSize.x / 2) / baseSize.x;
            const uvZ = (localHitPoint.z + baseSize.z / 2) / baseSize.z;

            // Determine which 1x1 sub-tile was hit on the 4x4 floor
            const subTileX = Math.floor(uvX * baseSize.x); // 0, 1, 2, 3
            const subTileZ = Math.floor(uvZ * baseSize.z); // 0, 1, 2, 3

            // Calculate the world position for the center of this 1x1 sub-tile
            // and add the beam's height
            pos.x = basePos.x - baseSize.x / 2 + subTileX + 0.5;
            pos.z = basePos.z - baseSize.z / 2 + subTileZ + 0.5;
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2; // Beam sits on top

            return { pos };
        }
        // Placing Metal Beam on top of another Metal Beam
        else if (def.id === "metal_beam" && basePart.id === "metal_beam" && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y;
            return { pos };
        }
    }

    return null; // No valid placement suggested
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
