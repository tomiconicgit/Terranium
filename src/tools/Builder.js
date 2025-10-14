// Builder — snapping restored & upgraded; pit digger highlight; stacking logic
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

const Z_FIGHT_OFFSET = 0.001;

function findPartRoot(object, placedObjectsGroup) {
  let current = object;
  while (current && current.parent !== placedObjectsGroup) current = current.parent;
  return current;
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
    this.preview.name = 'previewObject';
    this.scene.add(this.preview);

    // Pit highlight
    this.pitHighlight = new THREE.Mesh(
      new THREE.BoxGeometry(this.tile, 0.04, this.tile),
      new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.pitHighlight.rotation.x = -Math.PI/2;
    this.pitHighlight.visible = false;
    this.scene.add(this.pitHighlight);

    this.prevKey = '';
    this._lastButtons = [];
    this._hover = null;
    
    this.settingsPanel.onChange(() => this.applyGlobalSettings());
  }

  setActiveAsset(def) { this.activeAssetDef = def; this.prevKey = ''; }

  pad(){ const a=navigator.getGamepads?.()||[]; for(const p of a) if(p&&p.connected) return p; return null; }
  pressed(i){ const p=this.pad(); if(!p) return false; const n=!!p.buttons[i]?.pressed,b=!!this._lastButtons[i]; this._lastButtons[i]=n; return n&&!b; }

  update(){
    const def = this.activeAssetDef;
    if (!def) { this.preview.visible = false; this.pitHighlight.visible = false; return; }

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
    if (!hits.length){ this.preview.visible=false; this._hover=null; this.pitHighlight.visible = false; return; }

    const hit = hits[0];
    const settings = this.settingsPanel.getSettings();
    const sugg = this.suggestPlacement(def, hit, settings);
    if (!sugg) { this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false; return; }

    const { pos, rot, showPitHighlight } = sugg;

    // Pit digger uses highlight only
    if (def.baseType === 'tool' && def.id === 'tool_pit_digger') {
      this.preview.visible = false;
      this.pitHighlight.visible = true;
      this.pitHighlight.position.set(pos.x, 0.02, pos.z);
      if (placePressed) {
        // Dig ~8 tiles deep (~32 units). Radius = 0.45 tile for nice cylinder.
        this.scene.digPit(new THREE.Vector3(pos.x, 0, pos.z), 32, this.tile*0.45);
      }
      return;
    }

    // Normal preview
    const key = `${def.id}|${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}|${(rot?.y||0).toFixed(2)}|${JSON.stringify(settings)}`;
    if (key !== this.prevKey){
      this.preview.clear();
      const previewPart = buildPart(def, settings, this.dynamicEnvMap);
      this.preview.add(previewPart);
      this.prevKey = key;
    }
    this.preview.position.copy(pos);
    if (rot) this.preview.rotation.copy(rot);
    this.preview.visible = true;
    this.pitHighlight.visible = !!showPitHighlight;
    this._hover = { pos, rot, def, settings };

    if (placePressed) this.placeOne();
  }

  applyGlobalSettings() { this.prevKey = ''; }
  
  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler(0, 0, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);

    // Helpers
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;

    switch (def.baseType) {
      case 'tool': {
        if (hit.object === this.terrain) {
          pos.set(snapTile(hit.point.x), 0, snapTile(hit.point.z));
          return { pos, rot, showPitHighlight: true };
        }
        return null;
      }

      case 'floor': {
        if (hit.object === this.terrain) {
          pos.set(snapTile(hit.point.x), def.size.y/2, snapTile(hit.point.z));
          return { pos, rot };
        }
        if (hitRoot && (hitRoot.userData.part?.baseType === 'floor' || hitRoot.userData.part?.baseType === 'wall')) {
          pos.copy(hitRoot.position);
          pos.y += hitRoot.userData.part.size.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
          return { pos, rot };
        }
        return null;
      }

      case 'wall': {
        // Snap flush to FLOOR edge; stack on WALL/TRUSS top
        if (hitRoot && hitRoot.userData.part?.baseType === 'floor') {
          const basePos = hitRoot.position;
          const baseSize = hitRoot.userData.part.size;
          const localHit = hitRoot.worldToLocal(hit.point.clone());
          // choose nearest edge
          const edges = [
            { vec: new THREE.Vector3(1,0,0),  rotY: 0,           dist: Math.abs(localHit.x - baseSize.x/2) },
            { vec: new THREE.Vector3(-1,0,0), rotY: Math.PI,     dist: Math.abs(localHit.x + baseSize.x/2) },
            { vec: new THREE.Vector3(0,0,1),  rotY: -Math.PI/2,  dist: Math.abs(localHit.z - baseSize.z/2) },
            { vec: new THREE.Vector3(0,0,-1), rotY: Math.PI/2,   dist: Math.abs(localHit.z + baseSize.z/2) },
          ].sort((a,b)=>a.dist-b.dist)[0];

          // place OUTSIDE the tile edge by half wall thickness to be flush, no z-fight
          const out = def.size.z/2 - Z_FIGHT_OFFSET;
          pos.copy(basePos).addScaledVector(edges.vec, baseSize.x/2 + out);
          pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
          rot.y = edges.rotY;
          return { pos, rot };
        }

        if (hitRoot && (hitRoot.userData.part?.baseType === 'wall' || hitRoot.userData.part?.subType === 'truss')) {
          // stack on top
          pos.copy(hitRoot.position);
          pos.y += hitRoot.userData.part.size.y/2 + def.size.y/2 + Z_FIGHT_OFFSET;
          rot.copy(hitRoot.rotation);
          return { pos, rot };
        }
        return null;
      }

      case 'railing': {
        if (hitRoot && hitRoot.userData.part?.baseType === 'floor') {
          const basePos = hitRoot.position;
          const baseSize = hitRoot.userData.part.size;
          const localHit = hitRoot.worldToLocal(hit.point.clone());
          const edges = [
            { vec:new THREE.Vector3(1,0,0),  rotY:0,          dist:Math.abs(localHit.x - baseSize.x/2) },
            { vec:new THREE.Vector3(-1,0,0), rotY:Math.PI,    dist:Math.abs(localHit.x + baseSize.x/2) },
            { vec:new THREE.Vector3(0,0,1),  rotY:-Math.PI/2, dist:Math.abs(localHit.z - baseSize.z/2) },
            { vec:new THREE.Vector3(0,0,-1), rotY:Math.PI/2,  dist:Math.abs(localHit.z + baseSize.z/2) },
          ].sort((a,b)=>a.dist-b.dist)[0];

          const out = def.size.z/2 - Z_FIGHT_OFFSET;
          pos.copy(basePos).addScaledVector(edges.vec, baseSize.x/2 + out);
          pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
          rot.y = edges.rotY;
          return { pos, rot };
        }
        return null;
      }

      case 'pipe': {
        // Snap to any floor tile center; orientation to closest axis
        if (hit.object === this.terrain || (hitRoot && hitRoot.userData.part?.baseType === 'floor')) {
          const baseY = (hitRoot ? hitRoot.position.y + hitRoot.userData.part.size.y/2 : 0);
          pos.set(snapTile(hit.point.x), baseY + def.size.y/2 + 0.02, snapTile(hit.point.z));
          // choose axis based on camera facing or normal; simple quantize
          const towardX = Math.abs((hit.face?.normal?.x) || 0) >= Math.abs((hit.face?.normal?.z) || 0);
          rot.y = towardX ? 0 : Math.PI/2;
          return { pos, rot };
        }
        return null;
      }

      case 'light': {
        // floor or wall attach
        if (hit.object === this.terrain || (hitRoot && hitRoot.userData.part?.baseType === 'floor')) {
          const baseY = (hitRoot ? hitRoot.position.y + hitRoot.userData.part.size.y/2 : 0);
          pos.set(snapTile(hit.point.x), baseY + def.size.y/2 + 0.02, snapTile(hit.point.z));
          return { pos, rot };
        }
        if (hitRoot && hitRoot.userData.part?.baseType === 'wall') {
          pos.copy(hit.point).addScaledVector(hit.face.normal, def.size.z/2 + 0.02);
          rot.y = Math.atan2(hit.face.normal.x, hit.face.normal.z);
          return { pos, rot };
        }
        return null;
      }
    }
    return null;
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, rot, def, settings } = this._hover;

    if (def.baseType === 'tool') {
      // tool handled in update (dig on place)
      return;
    }

    const part = buildPart(def, settings, this.dynamicEnvMap);
    part.position.copy(pos);
    if (rot) part.rotation.copy(rot);
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}