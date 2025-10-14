// src/tools/Builder.js — Advanced snapping and global editing
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

const Z_FIGHT_OFFSET = 0.001; // Small offset to prevent Z-fighting

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
              if (obj.material) {
                  if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                  else obj.material.dispose();
              }
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
    const rot = sugg.rot ? sugg.rot : new THREE.Euler(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');

    const rotKey = `${rot.x.toFixed(2)},${rot.y.toFixed(2)},${rot.z.toFixed(2)}`;
    const posKey = `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
    const key = `${def.id}|${posKey}|${rotKey}|${JSON.stringify(settings)}`;

    if (key !== this.prevKey){
      this.preview.clear();
      const previewPart = buildPart(def, settings, this.dynamicEnvMap);
      
      this.customizeMaterial(previewPart, settings);

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
  
  customizeMaterial(part, settings) {
    const id = part.userData.part?.id;
    if (!id) return;
    
    const colors = {
        'metal_floor': settings.floorColors,
        'metal_wall': settings.wallColors,
    }[id];

    part.traverse(child => {
        if (child.isMesh) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat, index) => {
                mat.roughness = settings.roughness;
                mat.metalness = settings.metalness;
                mat.envMapIntensity = settings.reflectivity;
                if (colors && colors[index]) {
                    mat.color.set(colors[index]);
                    if (id === 'metal_floor' && index === 3) { // Special case for floor lights
                        mat.emissive.set(colors[index]);
                        mat.emissiveIntensity = 2;
                    }
                } else {
                    mat.color.set(settings.primaryColor);
                }
            });
        }
    });
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
        const baseRot = hitRoot.rotation;

        if (def.id === "sci_fi_ramp" && basePart.id === "metal_floor" && Math.abs(n.y) < 0.1) {
            const rot = new THREE.Euler(0, 0, 0, 'YXZ');
            rot.y = Math.atan2(n.x, n.z);

            // Position ramp's center on the floor's edge
            pos.copy(basePos).addScaledVector(n, baseSize.x / 2);

            // Align ramp's top surface with floor's top surface
            pos.y += (baseSize.y / 2) - (def.size.y / 2);

            // Move ramp out so its end is flush with the floor edge
            const rampOffset = new THREE.Vector3(0, 0, def.size.z / 2).applyEuler(rot);
            pos.add(rampOffset);
            
            return { pos, rot };
        }

        if ((def.id === "guard_rail" || def.id === "metal_wall") && basePart.id === "metal_floor" && n.y > 0.9) {
            const localHit = hitRoot.worldToLocal(hit.point.clone());
            const halfX = baseSize.x / 2;
            const halfZ = baseSize.z / 2;

            const distances = [
                { edge: 'px', dist: Math.abs(localHit.x - halfX) }, { edge: 'nx', dist: Math.abs(localHit.x + halfX) },
                { edge: 'pz', dist: Math.abs(localHit.z - halfZ) }, { edge: 'nz', dist: Math.abs(localHit.z + halfZ) },
            ];
            distances.sort((a, b) => a.dist - b.dist);
            const closestEdge = distances[0].edge;

            const rot = new THREE.Euler(0, 0, 0, 'YXZ');
            pos.copy(basePos);
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
            
            if (closestEdge === 'px') {
                rot.y = Math.PI / 2;
                pos.x += halfX - (def.size.z / 2);
            } else if (closestEdge === 'nx') {
                rot.y = Math.PI / 2;
                pos.x -= halfX - (def.size.z / 2);
            } else if (closestEdge === 'pz') {
                rot.y = 0;
                pos.z += halfZ - (def.size.z / 2);
            } else if (closestEdge === 'nz') {
                rot.y = 0;
                pos.z -= halfZ - (def.size.z / 2);
            }
            return { pos, rot };
        }

        if (def.id === "metal_floor" && basePart.id === "metal_wall" && n.y > 0.9) {
            const rot = new THREE.Euler(0, baseRot.y, 0, 'YXZ');
            const wallNormal = new THREE.Vector3(0, 0, 1).applyEuler(baseRot);
            const offset = (def.size.z / 2) - (baseSize.z / 2);

            pos.copy(basePos);
            pos.y += baseSize.y/2 + def.size.y/2 + Z_FIGHT_OFFSET;
            pos.addScaledVector(wallNormal, offset);
            return { pos, rot };
        }
        
        if (def.id === "metal_floor" && basePart.id === "metal_floor") {
            if (n.y > 0.9) { pos.copy(basePos); pos.y += baseSize.y + Z_FIGHT_OFFSET; return { pos }; }
            else if (Math.abs(n.y) < 0.1) {
                const dir = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
                pos.copy(basePos).addScaledVector(dir, baseSize.x);
                return { pos };
            }
        }
        else if (verticalBeamIds.includes(def.id) && basePart.id === "metal_floor" && n.y > 0.9) {
            const localHitPoint = hitRoot.worldToLocal(hit.point.clone());
            const halfSizeX = baseSize.x / 2;
            const halfSizeZ = baseSize.z / 2;
            pos.x = basePos.x + Math.round(localHitPoint.x / halfSizeX) * halfSizeX;
            pos.z = basePos.z + Math.round(localHitPoint.z / halfSizeZ) * halfSizeZ;
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
            return { pos };
        }
        else if (verticalBeamIds.includes(def.id) && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y + Z_FIGHT_OFFSET;
            return { pos };
        }
        
        else if (def.id === "steel_beam_h" && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            const rot = new THREE.Euler(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');
            pos.copy(basePos);
            pos.y += baseSize.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
            const offset = new THREE.Vector3(-1, 0, 0);
            offset.applyEuler(rot);
            offset.multiplyScalar(def.size.x / 2);
            pos.add(offset);
            return { pos, rot };
        }
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, rot, def, settings } = this._hover;
    const part = buildPart(def, settings, this.dynamicEnvMap);
    
    this.customizeMaterial(part, settings);

    part.position.copy(pos);
    part.rotation.copy(rot);
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}
