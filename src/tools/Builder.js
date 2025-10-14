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

    // Pit highlight (flat on terrain)
    this.pitHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(this.tile, this.tile),
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

    const placePressed = this.pressed(7); // RT
    const removePressed = this.pressed(6); // LT

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

    // Tool: pit digger (highlight + dig on RT)
    if (def.baseType === 'tool' && def.id === 'tool_pit_digger') {
      this.preview.visible = false;
      if (hit.object === this.terrain) {
        this.pitHighlight.position.copy(hit.point).y += 0.02; // Place highlight just above the surface
        this.pitHighlight.visible = true;
        if (placePressed) {
          const digRadius = this.tile * 0.5; // Dig a circle that fits the square highlight
          const digDepth = this.tile * 0.75; // Dig down 3 units
          this.scene.digPit(hit.point, digDepth, digRadius);
        }
      } else {
        this.pitHighlight.visible = false;
      }
      return;
    }

    const sugg = this.suggestPlacement(def, hit, settings);
    if (!sugg) { this.preview.visible = false; this._hover = null; this.pitHighlight.visible = false; return; }

    const { pos, rot } = sugg;

    // Build preview
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
    this.pitHighlight.visible = false; // Pit highlight is handled separately
    this._hover = { pos, rot, def, settings };

    if (placePressed) this.placeOne();
  }

  applyGlobalSettings() { this.prevKey = ''; }
  
  suggestPlacement(def, hit, settings) {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler(0, 0, 0, 'YXZ');
    const hitRoot = findPartRoot(hit.object, this.placedObjects);
    const snapTile = (v) => Math.round(v / this.tile) * this.tile;

    switch (def.baseType) {
      case 'tool': { // Tool suggestion is now handled in the update loop
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
        if (def.subType === 'column_round_flatcaps' && hitRoot && hitRoot.userData.part?.baseType === 'floor') {
            const basePos = hitRoot.position;
            const baseSize = hitRoot.userData.part.size;
            const w2 = baseSize.x / 2, d2 = baseSize.z / 2;
            const corners = [
                basePos.clone().add(new THREE.Vector3( w2, 0,  d2)), basePos.clone().add(new THREE.Vector3(-w2, 0,  d2)),
                basePos.clone().add(new THREE.Vector3( w2, 0, -d2)), basePos.clone().add(new THREE.Vector3(-w2, 0, -d2)),
            ];
            corners.sort((a,b) => hit.point.distanceToSquared(a) - hit.point.distanceToSquared(b));
            pos.copy(corners[0]);
            pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
            return { pos, rot };
        }

        if (hitRoot && hitRoot.userData.part?.baseType === 'floor') {
          const basePos = hitRoot.position;
          const baseSize = hitRoot.userData.part.size;
          const local = hitRoot.worldToLocal(hit.point.clone());
          const edges = [
            { vec: new THREE.Vector3(1,0,0),  rotY: 0,          dist: Math.abs(local.x - baseSize.x/2) },
            { vec: new THREE.Vector3(-1,0,0), rotY: Math.PI,    dist: Math.abs(local.x + baseSize.x/2) },
            { vec: new THREE.Vector3(0,0,1),  rotY: -Math.PI/2, dist: Math.abs(local.z - baseSize.z/2) },
            { vec: new THREE.Vector3(0,0,-1), rotY: Math.PI/2,  dist: Math.abs(local.z + baseSize.z/2) },
          ].sort((a,b)=>a.dist-b.dist)[0];

          const out = def.size.z/2 - Z_FIGHT_OFFSET;
          pos.copy(basePos).addScaledVector(edges.vec, baseSize.x/2 + out);
          pos.y = basePos.y + baseSize.y/2 + def.size.y/2;
          rot.y = edges.rotY;
          return { pos, rot };
        }

        if (hitRoot && (hitRoot.userData.part?.baseType === 'wall')) {
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
          const local = hitRoot.worldToLocal(hit.point.clone());
          const edges = [
            { vec:new THREE.Vector3(1,0,0),  rotY:0,          dist:Math.abs(local.x - baseSize.x/2) },
            { vec:new THREE.Vector3(-1,0,0), rotY:Math.PI,    dist:Math.abs(local.x + baseSize.x/2) },
            { vec:new THREE.Vector3(0,0,1),  rotY:-Math.PI/2, dist:Math.abs(local.z - baseSize.z/2) },
            { vec:new THREE.Vector3(0,0,-1), rotY:Math.PI/2,  dist:Math.abs(local.z + baseSize.z/2) },
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
        if (def.subType === 'full' && hitRoot && hitRoot.userData.part?.subType === 'elbow') {
          const epA = hitRoot.getObjectByName('endpointA');
          const epB = hitRoot.getObjectByName('endpointB');
          if (!epA || !epB) return null;
          const wA = epA.getWorldPosition(new THREE.Vector3());
          const wB = epB.getWorldPosition(new THREE.Vector3());
          const target = (hit.point.distanceTo(wA) < hit.point.distanceTo(wB)) ? wA : wB;
          pos.copy(target);
          
          const selfEP = (def.size.z || 4) / 2;
          const dir = (target === wA ? epB : epA).getWorldPosition(new THREE.Vector3()).sub(target).normalize();
          pos.addScaledVector(dir, selfEP);

          rot.setFromRotationMatrix(new THREE.Matrix4().lookAt(target, target.clone().add(dir), new THREE.Vector3(0,1,0)));
          
          return { pos, rot };
        }

        // **FIX**: Elbow pipe can now snap to the END of a FULL pipe
        if (def.subType === 'elbow' && hitRoot && hitRoot.userData.part?.subType === 'full') {
            const epA = hitRoot.getObjectByName('endpointA');
            const epB = hitRoot.getObjectByName('endpointB');
            if (!epA || !epB) return null;

            const wA = epA.getWorldPosition(new THREE.Vector3());
            const wB = epB.getWorldPosition(new THREE.Vector3());
            const targetPos = (hit.point.distanceTo(wA) < hit.point.distanceTo(wB)) ? wA : wB;
            const otherPos = (targetPos === wA) ? wB : wA;
            pos.copy(targetPos);

            const awayDir = targetPos.clone().sub(otherPos).normalize();
            rot.y = Math.atan2(awayDir.x, awayDir.z) + Math.PI;

            return { pos, rot };
        }

        if (def.subType === 'elbow' && (hit.object === this.terrain || (hitRoot && hitRoot.userData.part?.baseType === 'floor'))) {
          const baseY = (hitRoot ? hitRoot.position.y + hitRoot.userData.part.size.y/2 : 0);
          pos.set(snapTile(hit.point.x), baseY + def.size.y/2 + 0.02, snapTile(hit.point.z));
          rot.y = 0;
          return { pos, rot };
        }

        return null;
      }

      case 'light': {
        if (hit.object === this.terrain || (hitRoot && hitRoot.userData.part?.baseType === 'floor')) {
          const baseY = (hitRoot ? hitRoot.position.y + hitRoot.userData.part.size.y/2 : 0);
          pos.set(snapTile(hit.point.x), baseY + def.size.y/2, snapTile(hit.point.z));
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
    if (def.baseType === 'tool') return;

    const part = buildPart(def, settings, this.dynamicEnvMap);
    part.position.copy(pos);
    if (rot) part.rotation.copy(rot);
    part.userData.settings = { ...settings };
    this.placedObjects.add(part);
  }
}
