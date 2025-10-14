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
    const rot = sugg.rot ? sugg.rot : new THREE.Euler(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');

    const rotKey = `${rot.x.toFixed(2)},${rot.y.toFixed(2)},${rot.z.toFixed(2)}`;
    const posKey = `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
    const key = `${def.id}|${posKey}|${rotKey}|${JSON.stringify(settings)}`;

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
    this.preview.rotation.copy(rot);
    this.preview.visible = true;
    this._hover = { pos, rot, def, settings };

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
        const baseRot = hitRoot.rotation;

        // 1. Placing a WALL or RAILING on the EDGE of a FLOOR
        if ((def.id === "guard_rail" || def.id === "metal_wall") && basePart.id === "metal_floor" && n.y > 0.9) {
            const localHit = hitRoot.worldToLocal(hit.point.clone());
            const halfX = baseSize.x / 2;
            const halfZ = baseSize.z / 2;

            const distances = [
                { edge: 'px', val: halfX, dist: Math.abs(localHit.x - halfX) },
                { edge: 'nx', val: -halfX, dist: Math.abs(localHit.x + halfX) },
                { edge: 'pz', val: halfZ, dist: Math.abs(localHit.z - halfZ) },
                { edge: 'nz', val: -halfZ, dist: Math.abs(localHit.z + halfZ) },
            ];
            distances.sort((a, b) => a.dist - b.dist);
            const closestEdge = distances[0];

            pos.copy(basePos);
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
            const rot = new THREE.Euler(0, 0, 0, 'YXZ');

            // Adjust position so the wall/railing outer face is flush with the floor edge
            // The wall/railing depth is def.size.z
            if (closestEdge.edge === 'px' || closestEdge.edge === 'nx') {
                pos.x = basePos.x + closestEdge.val;
                pos.z = Math.round(localHit.z / def.size.x) * def.size.x + basePos.z; // snap to grid along Z
                pos.x += Math.sign(closestEdge.val) * (def.size.z / 2); // Move outwards by half its thickness
                rot.y = Math.PI / 2;
            } else { // 'pz' or 'nz'
                pos.z = basePos.z + closestEdge.val;
                pos.x = Math.round(localHit.x / def.size.x) * def.size.x + basePos.x; // snap to grid along X
                pos.z += Math.sign(closestEdge.val) * (def.size.z / 2); // Move outwards by half its thickness
                rot.y = 0;
            }
            return { pos, rot };
        }

        // 2. Placing a FLOOR on TOP of a WALL
        if (def.id === "metal_floor" && basePart.id === "metal_wall" && n.y > 0.9) {
            const topOfWall = basePos.y + baseSize.y / 2;
            const rot = new THREE.Euler(0, baseRot.y, 0, 'YXZ');

            // Find which edge of the wall top is closer
            const localHit = hitRoot.worldToLocal(hit.point.clone());
            // Wall's thin axis is Z (def.size.z), its length is X (def.size.x)
            // Hit point z is relative to wall's local center.
            const wallLocalZ = localHit.z; 

            pos.copy(basePos);
            pos.y = topOfWall + def.size.y / 2 + Z_FIGHT_OFFSET;
            
            // Wall has thickness baseSize.z. Floor has thickness def.size.z
            // Wall is positioned at basePos. The floor needs to snap its *edge* to the wall's *edge*.
            // Assume wall is oriented along X (rotation.y = 0 or PI), so its Z is thin dimension.
            // If wall is rotated by PI/2, its X is thin dimension.
            const wallThinDim = basePart.size.z; // This is the depth of the wall
            const floorThinDim = def.size.z;     // This is the depth of the floor
            
            // The floor's edge should align with the wall's outer face.
            // The floor's center will be offset from the wall's center by (floorThinDim / 2 - wallThinDim / 2)
            
            // Calculate direction vector from wall center to hit point, in wall's local XZ plane.
            const localHitDir = new THREE.Vector3(localHit.x, 0, localHit.z).normalize();
            
            // Transform the wall's local Z direction (which is its thin dimension) into world space
            const wallNormalWorld = new THREE.Vector3(0, 0, 1).applyEuler(baseRot); // Default: wall is along X, thin along Z
            
            // If the wall was rotated by 90 degrees, its local X would be the thin dimension.
            // We need to check baseRot.y to know if the wall's 'Z' dimension is aligned with world X or Z.
            let wallFaceNormal = new THREE.Vector3();
            if (Math.abs(baseRot.y) < 0.1) { // Wall is mostly along world X (thin along world Z)
                wallFaceNormal.set(0, 0, Math.sign(wallLocalZ)); // Face along world Z
            } else { // Wall is mostly along world Z (thin along world X)
                wallFaceNormal.set(Math.sign(localHit.x), 0, 0); // Face along world X
            }
            wallFaceNormal.applyEuler(baseRot);
            
            const offsetAmount = (floorThinDim / 2) - (wallThinDim / 2);
            pos.addScaledVector(wallFaceNormal, offsetAmount);

            return { pos, rot };
        }

        // 3. Stacking floors
        if (def.id === "metal_floor" && basePart.id === "metal_floor") {
            if (n.y > 0.9) { pos.copy(basePos); pos.y += baseSize.y + Z_FIGHT_OFFSET; return { pos }; }
            else if (Math.abs(n.y) < 0.1) {
                const dir = new THREE.Vector3(Math.round(n.x), 0, Math.round(n.z));
                pos.copy(basePos).addScaledVector(dir, baseSize.x);
                return { pos };
            }
        }
        // 4. Placing a vertical beam on a floor (corner snapping)
        else if (verticalBeamIds.includes(def.id) && basePart.id === "metal_floor" && n.y > 0.9) {
            const localHitPoint = hitRoot.worldToLocal(hit.point.clone());
            const uvX = (localHitPoint.x + baseSize.x / 2) / baseSize.x;
            const uvZ = (localHitPoint.z + baseSize.z / 2) / baseSize.z;
            
            // Snap to the nearest 1x1 grid corner, not the center of a tile
            const cornerX = Math.round(uvX * baseSize.x);
            const cornerZ = Math.round(uvZ * baseSize.z);

            pos.x = basePos.x - baseSize.x / 2 + cornerX;
            pos.z = basePos.z - baseSize.z / 2 + cornerZ;
            pos.y = basePos.y + baseSize.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
            return { pos };
        }
        // 5. Stacking vertical beams
        else if (verticalBeamIds.includes(def.id) && verticalBeamIds.includes(basePart.id) && n.y > 0.9) {
            pos.copy(basePos);
            pos.y += baseSize.y + Z_FIGHT_OFFSET;
            return { pos };
        }
        // 6. Placing a horizontal beam on a vertical one (flush snapping)
        else if (def.id === "steel_beam_h" && verticalBeamIds.includes(basePart.id)) {
            const rot = new THREE.Euler(settings.rotationX, settings.rotationY, settings.rotationZ, 'YXZ');
            const topOfVerticalBeam = basePos.y + baseSize.y / 2;
            
            // Project hit.point onto the face of the vertical beam it hit
            const localHitPoint = hitRoot.worldToLocal(hit.point.clone());
            const faceNormal = hit.face.normal.clone().applyQuaternion(hitRoot.quaternion.clone().invert());
            
            // Determine if the hit is on a side face (not top/bottom)
            if (Math.abs(faceNormal.y) < 0.1) { // Hit on a side face of the vertical beam
                pos.y = topOfVerticalBeam; // Align to the top of the vertical beam
                
                // Position the horizontal beam such that its center is aligned with the vertical beam's face
                // and its own end is flush with that face.
                const horizontalBeamThickness = def.size.z; // Assuming Z is the thin axis of horizontal beam
                const verticalBeamFaceNormal = hit.face.normal.clone();
                
                pos.copy(hit.point);
                pos.addScaledVector(verticalBeamFaceNormal, horizontalBeamThickness / 2);
                
                // Align the horizontal beam's Y rotation with the vertical beam's face normal
                // (this ensures it sits flat against the face)
                if (Math.abs(verticalBeamFaceNormal.x) > Math.abs(verticalBeamFaceNormal.z)) {
                    rot.y = verticalBeamFaceNormal.x > 0 ? Math.PI / 2 : -Math.PI / 2;
                } else {
                    rot.y = verticalBeamFaceNormal.z > 0 ? 0 : Math.PI;
                }
                
                // Ensure no Z-fighting for height
                pos.y += Z_FIGHT_OFFSET;

                return { pos, rot };
            }
        }
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, rot, def, settings } = this._hover;
    const part = buildPart(def, settings, this.dynamicEnvMap);
    
    part.traverse(child => {
      if (child.isMesh) {
        this.customizeMaterial(child.material, settings);
      }
    });

    part.position.copy(pos);
    part.rotation.copy(rot);
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}
