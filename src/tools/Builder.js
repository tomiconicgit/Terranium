// Builder — precise edge/corner snapping, elbow↔full pipe chaining, pit highlight+dig
import * as THREE from 'three';
import { makeCatalog, buildPart } from '../assets/Catalog.js';

const Z_FIGHT_OFFSET = 0.001;

function findPartRoot(object, placedGroup) {
  let cur = object;
  while (cur && cur.parent !== placedGroup) cur = cur.parent;
  return cur;
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

    this.pitHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(this.tile, this.tile),
      new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    this.pitHighlight.rotation.x = -Math.PI/2;
    this.pitHighlight.visible = false;
    this.scene.add(this.pitHighlight);
    
    this.reticleEl = document.getElementById('reticle');

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

    if (removePressed) { this.removeAimedObject(); return; }
    
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects([this.terrain, ...this.placedObjects.children], true);
    if (!hits.length){
        this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false;
        if(this.reticleEl) this.reticleEl.style.display = 'none';
        return;
    }
    if(this.reticleEl) this.reticleEl.style.display = 'block';

    const hit = hits[0];
    const settings = this.settingsPanel.getSettings();

    if (def.baseType === 'tool' && def.id === 'tool_pit_digger') {
      this.handlePitDigger(hit, placePressed);
      return;
    }

    const sugg = this.suggestPlacement(def, hit, settings);
    if (!sugg) { this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false; return; }

    this.updatePreview(def, sugg.pos, sugg.rot, settings);
    if (placePressed) this.placeOne();
  }

  handlePitDigger(hit, placePressed) {
    this.preview.visible = false;
    if (hit.object === this.terrain) {
        const snapTile = (v) => Math.round(v / this.tile) * this.tile;
        const snappedPos = new THREE.Vector3(snapTile(hit.point.x), hit.point.y, snapTile(hit.point.z));
        this.pitHighlight.position.copy(snappedPos).y += 0.02;
        this.pitHighlight.visible = true;
        if (placePressed) {
            this.scene.digPit(snappedPos, this.tile, this.tile);
        }
    } else {
        this.pitHighlight.visible = false;
    }
  }

  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler(0, settings.rotationY, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;

    if (def.baseType === 'floor' && hitRoot && hitRoot.userData.part?.baseType === 'wall') {
        const wallDef = hitRoot.userData.part;
        pos.copy(hitRoot.position);
        pos.y = hitRoot.position.y + wallDef.size.y / 2 + def.size.y / 2 + Z_FIGHT_OFFSET;
        return { pos, rot: hitRoot.rotation.clone() };
    }

    if (def.baseType === 'pipe') {
      const pipeSnap = this.getPipeSnap(def, hit, hitRoot);
      if (pipeSnap) return pipeSnap;
    }

    if (['wall', 'railing'].includes(def.baseType)) {
      const edgeSnap = this.getEdgeSnap(def, hit, hitRoot, rot);
      if (edgeSnap) return edgeSnap;
    }
    
    if (hit.object === this.terrain || (hitRoot && hitRoot.userData.part?.baseType === 'floor')) {
        const y = (hitRoot ? hitRoot.position.y + hitRoot.userData.part.size.y / 2 : 0);
        pos.set(snapTile(hit.point.x), y + def.size.y/2 + Z_FIGHT_OFFSET, snapTile(hit.point.z));
        return { pos, rot };
    }
    return null;
  }

  getEdgeSnap(def, hit, hitRoot, currentRot) {
    if (!hitRoot) return null;
    const baseDef = hitRoot.userData.part;
    if (!baseDef) return null;
    
    // **FIX**: Defined snapTile function locally to prevent ReferenceError.
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;

    if (baseDef.baseType === 'wall') {
        return {
            pos: hitRoot.position.clone().setY(hitRoot.position.y + baseDef.size.y/2 + def.size.y/2 + Z_FIGHT_OFFSET),
            rot: hitRoot.rotation.clone()
        };
    }

    if (baseDef.baseType === 'floor') {
        const basePos = hitRoot.position;
        const baseSize = baseDef.size;
        const pos = new THREE.Vector3(snapTile(hit.point.x), 0, snapTile(hit.point.z));
        pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
        return { pos, rot: currentRot };
    }
    return null;
  }

  getPipeSnap(def, hit, hitRoot) {
      const snapTile = (v) => Math.round(v / this.tile) * this.tile;
      const pos = new THREE.Vector3();
      const rot = new THREE.Euler(0, 0, 0, 'YXZ');

      if (hitRoot && hitRoot.userData.part?.baseType === 'pipe') {
          const epA = hitRoot.getObjectByName('endpointA')?.getWorldPosition(new THREE.Vector3());
          const epB = hitRoot.getObjectByName('endpointB')?.getWorldPosition(new THREE.Vector3());
          if (!epA || !epB) return null;

          const targetPos = hit.point.distanceTo(epA) < hit.point.distanceTo(epB) ? epA : epB;
          const otherPos = targetPos === epA ? epB : epA;
          const dir = targetPos.clone().sub(otherPos).normalize();
          
          pos.copy(targetPos);
          rot.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir));

          return { pos, rot };
      }
      
      const baseDef = hitRoot?.userData?.part;
      if (def.subType === 'elbow' && (hit.object === this.terrain || baseDef?.baseType === 'floor')) {
          const baseY = (hitRoot ? hitRoot.position.y + baseDef.size.y/2 : 0);
          pos.set(snapTile(hit.point.x), baseY + def.size.y/2 + Z_FIGHT_OFFSET, snapTile(hit.point.z));
          return { pos, rot };
      }
      return null;
  }

  updatePreview(def, pos, rot, settings) {
    const key = `${def.id}|${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}|${(rot?.y||0).toFixed(2)}`;
    if (key !== this.prevKey){
      this.preview.clear();
      this.preview.add(buildPart(def, settings, this.dynamicEnvMap));
      this.prevKey = key;
    }
    this.preview.position.copy(pos);
    if (rot) this.preview.rotation.copy(rot);
    this.preview.visible = true;
    this.pitHighlight.visible = false;
    this._hover = { pos, rot, def, settings };
  }

  placeOne(){
    if (!this._hover) return;
    const { pos, rot, def, settings } = this._hover;
    if (def.baseType === 'tool') return;

    const part = buildPart(def, settings, this.dynamicEnvMap);
    part.position.copy(pos);
    if (rot) part.rotation.copy(rot);
    this.placedObjects.add(part);
  }

  removeAimedObject() {
      this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
      const hits = this.ray.intersectObjects(this.placedObjects.children, true);
      if (hits.length > 0) {
          const partToRemove = findPartRoot(hits[0].object, this.placedObjects);
          if (partToRemove) {
              partToRemove.removeFromParent();
          }
      }
  }

  applyGlobalSettings() { this.prevKey = ''; }
}
