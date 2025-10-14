// src/tools/Builder.js — Advanced snapping and global editing
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

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
    this.dynamicEnvMap = scene.dynamicEnvMap;

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
    
    this.settingsPanel.onChange(() => this.applyGlobalSettings());
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
    const settings = this.settingsPanel.getSettings();
    const key = `${def.id}|${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}|${JSON.stringify(settings)}`;

    if (key !== this.prevKey){
      this.preview.clear();
      const ghost = buildPart(def, settings, this.dynamicEnvMap);
      ghost.traverse(o=>{
        if(o.isMesh){
            this.customizeMaterial(o.material, settings);
            o.material.transparent = true; 
            o.material.opacity = 0.6; 
            o.material.depthWrite = false;
        }
      });
      this.preview.add(ghost);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    // ✅ CHANGED: Apply both Y and X rotations
    this.preview.rotation.y = settings.rotationY;
    this.preview.rotation.x = settings.rotationX;
    this.preview.visible = true;
    this._hover = { pos, def, settings, hit }; // Pass hit object for removal

    if (placePressed) this.placeOne();
    if (removePressed) this.removeOne();
  }

  applyGlobalSettings() {
    const currentDef = this.catalog[this.hotbar.index];
    if (!currentDef) return;
  
    const settings = this.settingsPanel.getSettings();
    const objectsToUpdate = this.placedObjects.children.filter(
      child => child.userData.part?.id === currentDef.id
    );
  
    objectsToUpdate.forEach(child => {
      child.traverse(obj => {
        if (obj.isMesh && obj.material) {
          this.customizeMaterial(obj.material, settings);
        }
      });
      // ✅ CHANGED: Update rotation on existing objects
      child.rotation.y = settings.rotationY;
      child.rotation.x = settings.rotationX;
      Object.assign(child.userData.settings, settings);
    });
  
    this.prevKey = '';
  }
  
  customizeMaterial(material, settings) {
    material.color.set(settings.color);
    material.roughness = settings.roughness;
    material.metalness = settings.metalness;
    material.envMapIntensity = settings.reflectivity;

    // ✅ REMOVED: Bump logic is gone
  }
  
  suggestPlacement(def, hit) {
    const n = hit.face.normal;
    const pos = new THREE.Vector3();
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const verticalBeamIds = ["metal_beam", "steel_beam"];

    if (hit.object === this.terrain && def.id === "metal_floor") {
        const gridSize = def.size.x;
        pos.x = Math.round(hit.point.x / gridSize) * gridSize;
        pos.z = Math.round(hit.point.z / gridSize) * gridSize;
        pos.y = def.size.y / 2;
        return { pos };
    }

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
        else if (verticalBeamIds.includes(def.id) && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y;
            return { pos };
        }
        // ✅ FIXED: Horizontal beam snapping logic
        else if (def.id === "steel_beam_h" && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            // Set Y pos to be flush on top of the vertical beam
            const y = basePos.y + baseSize.y / 2 + def.size.y / 2;
            // Use the raycast hit point for X and Z to avoid auto-centering
            pos.set(hit.point.x, y, hit.point.z);
            return { pos };
        }
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, def, settings } = this._hover;
    const part = buildPart(def, settings, this.dynamicEnvMap);
    
    part.traverse(child => {
      if (child.isMesh) {
        this.customizeMaterial(child.material, settings);
      }
    });

    part.position.copy(pos);
    // ✅ CHANGED: Apply both rotations when placing object
    part.rotation.y = settings.rotationY;
    part.rotation.x = settings.rotationX;
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }

  removeOne(){
    if (!this._hover?.hit) return;
    const hitObj = this._hover.hit.object;
    if (hitObj !== this.terrain) {
      const partToRemove = findPartRoot(hitObj, this.placedObjects);
      if (partToRemove) {
        partToRemove.parent.remove(partToRemove);
        partToRemove.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
      }
    }
  }
}
