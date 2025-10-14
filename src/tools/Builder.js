// src/tools/Builder.js — Advanced snapping for procedural parts
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

// Helper function to find the root part object from a raycast hit
function findPartRoot(object, placedObjectsGroup) {
    let current = object;
    while (current && current.parent !== placedObjectsGroup) {
        current = current.parent;
    }
    return current;
}

export class Builder {
  constructor(scene, camera, hotbar, settingsPanel){
    this.scene = scene;
    this.camera = camera;
    this.hotbar = hotbar;
    this.settingsPanel = settingsPanel;

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
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], true);
    
    if (!hits.length){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const sugg = this.suggestPlacement(def, hit);
    if (!sugg) { this.preview.visible = false; this._hover = null; return; }

    const pos = sugg.pos;
    const currentSettings = this.settingsPanel.getSettings();
    const rotationY = currentSettings.rotation;

    // The key now includes rotation to force a preview update when the slider changes
    const key = `${def.id}|${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}|${rotationY.toFixed(2)}`;

    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def);
      ghost.traverse(o=>{if(o.isMesh){const m=o.material.clone();m.transparent=true;m.opacity=0.45;m.depthWrite=false;o.material=m;}});
      this.preview.add(ghost);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    this.preview.rotation.y = rotationY; // Apply rotation to the preview
    this.preview.visible = true;
    this._hover = { pos, def, rotationY }; // Store rotation for placement

    if (placePressed) this.placeOne();
    if (removePressed) this.removeOne();
  }

  suggestPlacement(def, hit) {
    const n = hit.face.normal;
    const pos = new THREE.Vector3();
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const verticalBeamIds = ["metal_beam", "steel_beam"];

    // Case 1: Hitting the terrain (for Metal Floor)
    if (hit.object === this.terrain && def.id === "metal_floor") {
        const gridSize = def.size.x; // 4 for metal floor
        pos.x = Math.round(hit.point.x / gridSize) * gridSize;
        pos.z = Math.round(hit.point.z / gridSize) * gridSize;
        pos.y = def.size.y / 2;
        return { pos };
    }

    // Case 2: Hitting another placed part
    if (hitRoot && hitRoot.userData.part) {
        const basePart = hitRoot.userData.part;
        const basePos = hitRoot.position.clone();
        const baseSize = basePart.size;

        if (def.id === "metal_floor" && basePart.id === "metal_floor") {
            if (n.y > 0.9) { pos.copy(basePos); pos.y += baseSize.y; return { pos }; }
            else if (Math.abs(n.y) < 0.1) {
                const dir = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
                pos.copy(basePos).addScaledVector(dir, baseSize.x);
                return { pos };
            }
        }
        // Place a vertical beam on a floor
        else if (verticalBeamIds.includes(def.id) && basePart.id === "metal_floor" && n.y > 0.9) {
            const localHitPoint = hitRoot.worldToLocal(hit.point.clone());
            const uvX = (localHitPoint.x + baseSize.x / 2) / baseSize.x;
            const uvZ = (localHitPoint.z + baseSize.z / 2) / baseSize.z;
            const subTileX = Math.floor(uvX * baseSize.x);
            const subTileZ = Math.floor(uvZ * baseSize.z);
            pos.x = basePos.x - baseSize.x / 2 + subTileX + 0.5;
            pos.z = basePos.z - baseSize.z / 2 + subTileZ + 0.5;
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2;
            return { pos };
        }
        // Stack vertical beams on top of each other
        else if (verticalBeamIds.includes(def.id) && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y;
            return { pos };
        }
        // Place a horizontal beam on top of a vertical one
        else if (def.id === "steel_beam_h" && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += basePart.size.y / 2 + def.size.y / 2;
            return { pos };
        }
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, def, rotationY } = this._hover;
    const part = buildPart(def);
    
    const settings = this.settingsPanel.getSettings();

    // Apply material settings from the panel to the new part
    part.traverse(child => {
      if (child.isMesh) {
        // Clone the material to ensure we don't modify the original
        child.material = child.material.clone();
        child.material.color.set(settings.color);
        child.material.roughness = settings.roughness;
        child.material.metalness = settings.metalness;
      }
    });

    part.position.copy(pos);
    part.rotation.y = rotationY; // Apply rotation
    this.placedObjects.add(part);
  }

  removeOne(){
    if (!this._hover?.hit) return;
    const hitObj = this._hover.hit.object;
    if (hitObj !== this.terrain) {
      const partToRemove = findPartRoot(hitObj, this.placedObjects);
      if (partToRemove) {
        partToRemove.parent.remove(partToRemove);
      }
    }
  }
}
