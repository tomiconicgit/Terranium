// src/tools/Builder.js
// Builder — advanced tools, snapping for new parts, and pit building logic
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

const Z_FIGHT_OFFSET = 0.001;

function findPartRoot(object, placedGroup) {
  if (!object || object === placedGroup) return null;
  let current = object;
  while (current.parent && current.parent !== placedGroup) {
    current = current.parent;
  }
  return (current.parent === placedGroup) ? current : null;
}

export class Builder {
  constructor(scene, camera, settingsPanel, assetLibrary){
    this.scene = scene;
    this.camera = camera;
    this.settingsPanel = settingsPanel;
    this.assetLibrary = assetLibrary;
    this.dynamicEnvMap = scene.dynamicEnvMap;
    this.tile = scene.userData.tile || 4;
    this.terrain = scene.getObjectByName('terrainPlane');
    this.placedObjects = new THREE.Group();
    this.scene.add(this.placedObjects);
    this.catalog = makeCatalog();
    this.assetLibrary.setCatalog(this.catalog);
    this.activeAssetDef = null;
    this.ray = new THREE.Raycaster();
    this.preview = new THREE.Group();
    this.scene.add(this.preview);
    this.pitHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    this.pitHighlight.rotation.x = -Math.PI/2;
    this.scene.add(this.pitHighlight);
    this.animatedObjects = [];
    this.prevKey = '';
    this._lastButtons = [];
    this._hover = null;
    this.settingsPanel.onChange(() => { this.prevKey = ''; });
  }

  setActiveAsset(def) { this.activeAssetDef = def; this.prevKey = ''; }

  getGamepad() {
    const gamepads = navigator.getGamepads?.() || [];
    for (const gp of gamepads) {
        if (gp && gp.connected) return gp;
    }
    return null;
  }

  pressed(i) {
    const gp = this.getGamepad();
    const isPressed = gp ? (gp.buttons[i] && gp.buttons[i].pressed) : false;
    const wasPressed = this._lastButtons[i] || false;
    if (gp) {
      this._lastButtons = gp.buttons.map(b => b.pressed);
    } else if (this._lastButtons.length > 0) {
      this._lastButtons = [];
    }
    return isPressed && !wasPressed;
  }

  update(dt){
    const def = this.activeAssetDef;
    if (!def) { this.preview.visible = false; this.pitHighlight.visible = false; return; }
    const placePressed = this.pressed(7);
    const removePressed = this.pressed(6);
    
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], true);

    if (removePressed) { this.removeAimedObject(hits); return; }
    
    if (!hits.length){
        this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false;
        return;
    }
    const hit = hits[0];
    const settings = this.settingsPanel.getSettings();

    if (def.baseType === 'tool') {
        this.handleTool(def, hit, placePressed);
    } else {
        const sugg = this.suggestPlacement(def, hit, settings);
        if (sugg) {
            this.updatePreview(def, sugg.pos, sugg.rot, settings);
            if (placePressed) this.placeOne();
        } else {
            this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false; 
        }
    }
    this.animatedObjects.forEach(obj => obj.userData.update?.(dt));
  }

  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    let rot = new THREE.Euler(0, settings.rotationY, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;
    const snapSubTile = (v) => Math.round(v / (this.tile / 4)) * (this.tile / 4);

    const placeableTypes = ['wall', 'railing', 'floor', 'ramp'];
    const hitIsPlaceable = hitRoot && placeableTypes.includes(hitRoot.userData.part.baseType);

    // --- Stacking Logic: Place object on top of another ---
    if (hitIsPlaceable && placeableTypes.includes(def.baseType)) {
      const hitDef = hitRoot.userData.part;
      pos.copy(hitRoot.position);
      pos.y += hitDef.size.y / 2 + def.size.y / 2;
      // If placing a wall on another wall, align its base position but adjust for height.
      if (def.baseType === 'wall' && hitDef.baseType === 'wall') {
        rot.copy(hitRoot.rotation);
      }
      return { pos, rot };
    }
    
    // --- Edge Snapping Logic: Walls, trusses, railings on floors ---
    const edgeSnapTypes = ['wall', 'railing'];
    if (edgeSnapTypes.includes(def.baseType) && hitRoot && hitRoot.userData.part.baseType === 'floor') {
        const floorPos = hitRoot.position;
        const floorSize = hitRoot.userData.part.size;
        const localHit = hitRoot.worldToLocal(hit.point.clone());
        
        const dx = Math.abs(localHit.x);
        const dz = Math.abs(localHit.z);

        pos.copy(floorPos);
        pos.y += floorSize.y / 2 + def.size.y / 2;
        
        if (dx > dz) { // Snapping to X-axis edge
            rot.y = Math.PI / 2;
            pos.x += Math.sign(localHit.x) * (floorSize.x / 2 - def.size.z / 2);
            pos.z = snapTile(pos.z);
        } else { // Snapping to Z-axis edge
            rot.y = 0;
            pos.z += Math.sign(localHit.z) * (floorSize.z / 2 - def.size.z / 2);
            pos.x = snapTile(pos.x);
        }
        rot.y += settings.rotationY; // Allow user rotation to flip 180 deg
        return { pos, rot };
    }

    // --- Column Snapping Logic: Snap to 1x1 sub-grid on floors ---
    if (def.subType === 'column_round_flatcaps') {
        pos.set(snapSubTile(hit.point.x), hit.point.y + def.size.y / 2, snapSubTile(hit.point.z));
        return {pos, rot};
    }

    // --- Pipe Snapping Logic: Place vertically on walls ---
    if (def.baseType === 'pipe' && Math.abs(hit.face.normal.y) < 0.1) {
        pos.copy(hit.point).addScaledVector(hit.face.normal, def.size.x / 2); // use x as diameter
        rot.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.face.normal));
        rot.z += settings.rotationY; // Allow user to spin it
        return { pos, rot };
    }

    // --- Default snapping on ground ---
    if (hit.object === this.terrain) {
      pos.set(snapTile(hit.point.x), hit.point.y + def.size.y / 2 + Z_FIGHT_OFFSET, snapTile(hit.point.z));
      return { pos, rot };
    }

    return null; // No valid placement found
  }

  // ... other methods like handleTool, buildBlastPit, etc. remain the same
  
  updatePreview(def, pos, rot, settings) {
    const key = `${def.id}_${JSON.stringify(settings)}`;
    if (this.prevKey !== key) {
        this.prevKey = key;
        this.preview.clear();
        const part = buildPart(def, settings, this.dynamicEnvMap);
        if (!part) return;

        part.traverse(child => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.6;
                child.castShadow = false;
            }
        });
        this.preview.add(part);
    }
    
    if (this.preview.children.length > 0) {
        this.preview.position.copy(pos);
        this.preview.rotation.copy(rot);
        this.preview.visible = true;
    } else {
        this.preview.visible = false;
    }
  }

  placeOne() {
    if (!this.preview.visible || !this.activeAssetDef) return;
    const settings = this.settingsPanel.getSettings();
    const part = buildPart(this.activeAssetDef, settings, this.dynamicEnvMap);

    part.position.copy(this.preview.position);
    part.rotation.copy(this.preview.rotation);

    if (part.userData.update) {
        this.animatedObjects.push(part);
    }
    this.placedObjects.add(part);
  }
  
  removeAimedObject(hits) {
    this.preview.visible = false;
    this.pitHighlight.visible = false;
    if (!hits || !hits.length) return;

    const hitRoot = findPartRoot(hits[0].object, this.placedObjects);
    if (hitRoot) {
        const animIndex = this.animatedObjects.indexOf(hitRoot);
        if (animIndex > -1) this.animatedObjects.splice(animIndex, 1);

        hitRoot.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else if (obj.material) {
                    obj.material.dispose();
                }
            }
        });
        this.placedObjects.remove(hitRoot);
    }
  }

  // HandleTool, buildBlastPit etc are unchanged.
  handleTool(def, hit, placePressed) {
    this.preview.visible = false;
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;
    const snappedPos = new THREE.Vector3(snapTile(hit.point.x), 0, snapTile(hit.point.z));
    
    this.pitHighlight.scale.set(def.size.x, def.size.z, 1);
    this.pitHighlight.position.copy(snappedPos).y = 0.02;
    this.pitHighlight.visible = (hit.object === this.terrain);

    if (!placePressed || !this.pitHighlight.visible) return;

    if (def.id === 'tool_pit_digger') {
        this.scene.digPit(snappedPos, this.tile, this.tile);
    }
    if (def.id === 'tool_blast_pit') {
        this.scene.digPit(snappedPos, def.size.x, def.size.y);
        this.buildBlastPit(snappedPos, def);
    }
  }

  buildBlastPit(center, toolDef) {
    const floorDef = this.catalog.find(p => p.id === 'floor_plate_01');
    const wallDef = this.catalog.find(p => p.id === 'wall_flat_smooth');
    if (!floorDef || !wallDef) return;

    const pitY = -toolDef.size.y;
    const count = toolDef.size.x / this.tile;

    // Place Floors
    for(let i = -count/2; i < count/2; i++) {
        for(let j = -count/2; j < count/2; j++) {
            const pos = new THREE.Vector3(
                center.x + (i + 0.5) * this.tile,
                pitY + floorDef.size.y / 2,
                center.z + (j + 0.5) * this.tile
            );
            const part = buildPart(floorDef, {}, this.dynamicEnvMap);
            part.position.copy(pos);
            this.placedObjects.add(part);
        }
    }
    // Place Walls
    for(let i = -count/2; i < count/2; i++) {
        const p = center.x + (i + 0.5) * this.tile;
        const p2 = center.z + (i + 0.5) * this.tile;
        const halfWallH = wallDef.size.y / 2;
        
        let wall = buildPart(wallDef, {}, this.dynamicEnvMap);
        wall.position.set(p, pitY + halfWallH, center.z - count/2 * this.tile + wallDef.size.z/2);
        this.placedObjects.add(wall);
        wall = buildPart(wallDef, {}, this.dynamicEnvMap);
        wall.position.set(p, pitY + halfWallH, center.z + count/2 * this.tile - wallDef.size.z/2);
        this.placedObjects.add(wall);
        wall = buildPart(wallDef, {}, this.dynamicEnvMap);
        wall.position.set(center.x - count/2 * this.tile + wallDef.size.z/2, pitY + halfWallH, p2);
        wall.rotation.y = Math.PI/2;
        this.placedObjects.add(wall);
        wall = buildPart(wallDef, {}, this.dynamicEnvMap);
        wall.position.set(center.x + count/2 * this.tile - wallDef.size.z/2, pitY + halfWallH, p2);
        wall.rotation.y = Math.PI/2;
        this.placedObjects.add(wall);
    }
  }
}
