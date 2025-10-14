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
      new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.pitHighlight.rotation.x = -Math.PI/2;
    this.pitHighlight.visible = false;
    this.scene.add(this.pitHighlight);
    
    // **FIX**: Get reticle element to hide/show it
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
        if(this.reticleEl) this.reticleEl.style.display = 'none'; // **FIX**: Hide reticle
        return;
    }
    if(this.reticleEl) this.reticleEl.style.display = 'block'; // **FIX**: Show reticle

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
        this.pitHighlight.position.copy(hit.point).y += 0.02;
        this.pitHighlight.visible = true;
        if (placePressed) {
            this.scene.digPit(hit.point, this.tile, this.tile * 0.5);
        }
    } else {
        this.pitHighlight.visible = false;
    }
  }

  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler(0, 0, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;

    // **FIX**: Complete snapping logic overhaul for pipes and walls/truss/railings
    if (def.baseType === 'pipe') {
      // Logic for snapping pipe to another pipe or the floor
      const pipeSnap = this.getPipeSnap(def, hit, hitRoot);
      if (pipeSnap) return pipeSnap;
    }

    if (['wall', 'railing'].includes(def.baseType)) {
      // Logic for snapping walls/railings to floor edges or stacking
      const edgeSnap = this.getEdgeSnap(def, hit, hitRoot);
      if (edgeSnap) return edgeSnap;
    }
    
    // Default floor snapping
    if (hit.object === this.terrain) {
      pos.set(snapTile(hit.point.x), def.size.y/2, snapTile(hit.point.z));
      return { pos, rot };
    }
    return null;
  }

  getEdgeSnap(def, hit, hitRoot) {
    if (!hitRoot) return null;
    const baseDef = hitRoot.userData.part;
    if (!baseDef) return null;

    // Stack on top of another wall-like object
    if (baseDef.baseType === 'wall') {
        return {
            pos: hitRoot.position.clone().setY(hitRoot.position.y + baseDef.size.y/2 + def.size.y/2 + Z_FIGHT_OFFSET),
            rot: hitRoot.rotation.clone()
        };
    }

    // Snap to the edge of a floor
    if (baseDef.baseType === 'floor') {
        const basePos = hitRoot.position;
        const baseSize = baseDef.size;
        const local = hitRoot.worldToLocal(hit.point.clone());

        const edges = [
            { axis: 'x', dir: 1,  dist: Math.abs(local.x - baseSize.x/2) }, { axis: 'x', dir: -1, dist: Math.abs(local.x + baseSize.x/2) },
            { axis: 'z', dir: 1,  dist: Math.abs(local.z - baseSize.z/2) }, { axis: 'z', dir: -1, dist: Math.abs(local.z + baseSize.z/2) },
        ].sort((a,b) => a.dist - b.dist)[0];

        const pos = basePos.clone();
        const rot = new THREE.Euler(0, 0, 0, 'YXZ');
        const wallDepth = def.size.z / 2;

        if (edges.axis === 'x') {
            pos.x += edges.dir * (baseSize.x/2 + wallDepth);
            rot.y = (edges.dir > 0) ? Math.PI / 2 : -Math.PI / 2;
        } else {
            pos.z += edges.dir * (baseSize.z/2 + wallDepth);
            rot.y = (edges.dir > 0) ? 0 : Math.PI;
        }
        pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
        return { pos, rot };
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

          const targetPos = hit.point.distanceTo(wA) < hit.point.distanceTo(wB) ? wA : wB;
          const otherPos = targetPos === wA ? wB : wA;
          const dir = targetPos.clone().sub(otherPos).normalize();
          
          pos.copy(targetPos);
          rot.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir));

          return { pos, rot };
      }
      
      // Place on floor
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
              // Add disposal logic if needed
          }
      }
  }

  applyGlobalSettings() { this.prevKey = ''; }
}
