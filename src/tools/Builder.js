// src/tools/Builder.js — Advanced snapping and asset placement
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

const Z_FIGHT_OFFSET = 0.001;

function findPartRoot(object, placedObjectsGroup) {
    let current = object;
    while (current && current.parent !== placedObjectsGroup) {
        current = current.parent;
    }
    return current;
}

export class Builder {
  constructor(scene, camera, settingsPanel, assetLibrary){
    this.scene = scene;
    this.camera = camera;
    this.settingsPanel = settingsPanel;
    this.assetLibrary = assetLibrary;
    this.dynamicEnvMap = scene.dynamicEnvMap;

    this.terrain = scene.getObjectByName('terrainPlane');
    this.placedObjects = new THREE.Group();
    this.scene.add(this.placedObjects);
    
    this.catalog = makeCatalog();
    this.assetLibrary.setCatalog(this.catalog);
    this.activeAssetDef = null;

    this.ray = new THREE.Raycaster();
    this.preview = new THREE.Group();
    this.preview.name = 'previewObject';
    this.scene.add(this.preview);

    this.prevKey = '';
    this._lastButtons = [];
    this._hover = null;
    
    this.settingsPanel.onChange(() => this.applyGlobalSettings());
  }

  setActiveAsset(def) {
    this.activeAssetDef = def;
    this.prevKey = ''; // Force preview rebuild
  }

  pad(){ const a=navigator.getGamepads?.()||[]; for(const p of a) if(p&&p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed,b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n&&!b; }

  update(){
    const def = this.activeAssetDef;
    if (!def) {
        this.preview.visible = false;
        return;
    }

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
              if (obj.material) {
                  if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                  else obj.material.dispose();
              }
          });
          return;
        }
      }
    }
    
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], true);
    
    if (!hits.length){ this.preview.visible=false; this._hover=null; return; }

    const hit = hits[0];
    const settings = this.settingsPanel.getSettings();
    const sugg = this.suggestPlacement(def, hit, settings);
    if (!sugg) { this.preview.visible = false; this._hover = null; return; }

    const pos = sugg.pos;
    const rot = sugg.rot ? sugg.rot : new THREE.Euler(settings.rotationY, 0, 0, 'YXZ'); // Simplified rotation

    const key = `${def.id}|${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}|${rot.y.toFixed(2)}|${JSON.stringify(settings)}`;
    
    if (key !== this.prevKey){
      this.preview.clear();
      const previewPart = buildPart(def, settings, this.dynamicEnvMap);
      this.preview.add(previewPart);
      this.prevKey = key;
    }
    
    this.preview.position.copy(pos);
    this.preview.rotation.copy(rot);
    this.preview.visible = true;
    this._hover = { pos, rot, def, settings };

    if (placePressed) this.placeOne();
  }

  applyGlobalSettings() {
    this.prevKey = '';
  }
  
  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler(0, 0, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);

    switch (def.baseType) {
        case 'tool':
            if (hit.object === this.terrain) {
                pos.copy(hit.point).setY(0);
                return { pos, rot };
            }
            return null;

        case 'floor':
            if (hit.object === this.terrain) {
                pos.x = Math.round(hit.point.x / def.size.x) * def.size.x;
                pos.z = Math.round(hit.point.z / def.size.z) * def.size.z;
                pos.y = def.size.y / 2;
                return { pos, rot };
            }
            if (hitRoot && (hitRoot.userData.part?.baseType === 'floor' || hitRoot.userData.part?.baseType === 'wall')) {
                pos.copy(hitRoot.position);
                pos.y += hitRoot.userData.part.size.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
                return { pos, rot };
            }
            return null;
        
        case 'wall':
        case 'door':
        case 'railing':
            if (hitRoot && hitRoot.userData.part?.baseType === 'floor') {
                const basePos = hitRoot.position;
                const baseSize = hitRoot.userData.part.size;
                const localHit = hitRoot.worldToLocal(hit.point.clone());
                
                const edges = [
                    { name: 'px', dist: Math.abs(localHit.x - baseSize.x/2), vec: new THREE.Vector3(1,0,0), rotY: 0 },
                    { name: 'nx', dist: Math.abs(localHit.x + baseSize.x/2), vec: new THREE.Vector3(-1,0,0), rotY: Math.PI },
                    { name: 'pz', dist: Math.abs(localHit.z - baseSize.z/2), vec: new THREE.Vector3(0,0,1), rotY: -Math.PI/2 },
                    { name: 'nz', dist: Math.abs(localHit.z + baseSize.z/2), vec: new THREE.Vector3(0,0,-1), rotY: Math.PI/2 },
                ];
                edges.sort((a,b) => a.dist - b.dist);
                const edge = edges[0];

                pos.copy(basePos).addScaledVector(edge.vec, baseSize.x/2);
                pos.y += baseSize.y/2 + def.size.y/2;
                rot.y = edge.rotY;
                return {pos, rot};
            }
            return null;

        case 'ramp':
             if (hitRoot && hitRoot.userData.part?.baseType === 'floor') {
                const basePos = hitRoot.position;
                const baseSize = hitRoot.userData.part.size;
                const n = hit.face.normal.clone().applyQuaternion(hitRoot.quaternion.clone().invert());
                n.set(Math.round(n.x), 0, Math.round(n.z)).normalize();

                if (Math.abs(n.y) > 0.1) return null; // Not a side face

                rot.y = Math.atan2(n.x, n.z);
                const offset = (baseSize.x / 2) + (def.size.z / 2);
                pos.copy(basePos).addScaledVector(n, offset);
                pos.y += baseSize.y / 2 - def.size.y / 2; // Align top of ramp with floor
                return { pos, rot };
             }
             return null;
        
        case 'light':
            if (def.subType === 'wall_light' && hitRoot && hitRoot.userData.part?.baseType === 'wall') {
                pos.copy(hit.point).addScaledVector(hit.face.normal, def.size.z / 2);
                rot.y = Math.atan2(hit.face.normal.x, hit.face.normal.z);
                return { pos, rot };
            }
            if (def.subType === 'lamp_post' && hitRoot && hitRoot.userData.part?.baseType === 'floor') {
                pos.copy(hit.point);
                pos.y = hitRoot.position.y + hitRoot.userData.part.size.y / 2 + def.size.y / 2;
                return { pos, rot };
            }
            return null;
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, rot, def, settings } = this._hover;

    if (def.baseType === 'tool') {
        if (def.id === 'tool_pit_digger' && this.scene.digPit) {
            this.scene.digPit(pos, def.size);
        }
        return; // Don't place a mesh for tools
    }

    const part = buildPart(def, settings, this.dynamicEnvMap);
    part.position.copy(pos);
    part.rotation.copy(rot);
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}

