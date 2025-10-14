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
    this.preview.name = 'previewObject';
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
    const placePressed = this.pressed(7);
    const removePressed = this.pressed(6);

    if (removePressed) {
      this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
      const hits = this.ray.intersectObjects(this.placedObjects.children, true);

      if (hits.length > 0) {
        const partToRemove = findPartRoot(hits[0].object, this.placedObjects);
        if (partToRemove) {
          partToRemove.parent.remove(partToRemove);
          partToRemove.traverse(obj => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) obj.material.dispose();
          });
          return;
        }
      }
    }
    
    if (!def) return;
    
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], true);
    
    if (!hits.length){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const settings = this.settingsPanel.getSettings();
    const sugg = this.suggestPlacement(def, hit, settings);
    if (!sugg) { this.preview.visible = false; this._hover = null; return; }

    const pos = sugg.pos;
    const key = `${def.id}|${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}|${JSON.stringify(settings)}`;

    if (key !== this.prevKey){
      this.preview.clear();
      const previewPart = buildPart(def, settings, this.dynamicEnvMap);
      
      previewPart.traverse(o=>{
        if(o.isMesh){
            this.customizeMaterial(o.material, settings);
        }
      });

      this.preview.add(previewPart);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    this.preview.rotation.set(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');
    this.preview.visible = true;
    this._hover = { pos, def, settings };

    if (placePressed) this.placeOne();
  }

  applyGlobalSettings() {
    this.prevKey = '';
  }
  
  customizeMaterial(material, settings) {
    material.color.set(settings.color);
    material.roughness = settings.roughness;
    material.metalness = settings.metalness;
    material.envMapIntensity = settings.reflectivity;
  }
  
  suggestPlacement(def, hit, settings) {
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
        // ✅ FIXED: Correct logic for stacking vertical beams
        else if (verticalBeamIds.includes(def.id) && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y / 2 + def.size.y / 2;
            return { pos };
        }
        // ✅ FIXED: Robust snapping for horizontal beams on vertical supports
        else if (def.id === "steel_beam_h" && verticalBeamIds.includes(basePart.id)) {
            const v_rotation = new THREE.Quaternion();
            hitRoot.getWorldQuaternion(v_rotation);
            
            const v_up = new THREE.Vector3(0, 1, 0).applyQuaternion(v_rotation);
            const v_top_center = basePos.clone().add(v_up.clone().multiplyScalar(baseSize.y / 2));

            const vecFromCenterToHit = hit.point.clone().sub(basePos);
            const distAlongUp = vecFromCenterToHit.dot(v_up);
            const isNearTop = Math.abs(distAlongUp - (baseSize.y / 2)) < 1.0; // Increased tolerance

            if (isNearTop) {
                const h_rotation = new THREE.Euler(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');
                const h_up = new THREE.Vector3(0, 1, 0).applyEuler(h_rotation);
                const h_right = new THREE.Vector3(1, 0, 0).applyEuler(h_rotation);
                
                const h_vertical_offset = h_up.multiplyScalar(def.size.y / 2);
                const h_horizontal_offset = h_right.multiplyScalar(def.size.x / 2);
                
                const snap_center_base = v_top_center.clone().add(h_vertical_offset);
                const snapPosition1 = snap_center_base.clone().add(h_horizontal_offset);
                const snapPosition2 = snap_center_base.clone().sub(h_horizontal_offset);

                if (hit.point.distanceTo(snapPosition1) < hit.point.distanceTo(snapPosition2)) {
                    pos.copy(snapPosition1);
                } else {
                    pos.copy(snapPosition2);
                }
                
                return { pos };
            }
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
    part.rotation.set(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}
