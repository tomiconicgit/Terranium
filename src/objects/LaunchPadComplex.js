// src/objects/LaunchPadComplex.js
// Orchestrator: assembles PadBase + TowerEnclosed + LiftFrame, adds arms & a bridge,
// and exposes update(dt,elapsed,{player,camera}) to the Scene.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createPadBase }       from './PadBase.js';
import { createTowerEnclosed } from './TowerEnclosed.js';
import { createLiftFrame }     from './LiftFrame.js';

export function createLaunchPadComplex() {
  const g = new THREE.Group(); g.name = 'launchPad';

  // --- Pad base (ring, trench, slabs)
  const padBase = createPadBase();
  g.add(padBase);

  // --- Tower (enclosed bright metal)
  const tower = createTowerEnclosed({
    baseX: -56/2 + 7.5,   // left-of-center (same as before)
    baseZ: 4,
    width: 12,
    length: 12,
    height: 46,
    launchDeckY: 31
  });
  g.add(tower);

  // --- Lift on the SOUTH side (per your screenshot mark)
  const lift = createLiftFrame({
    towerDim: tower.userData.dim,
    side: 'south',                // change to 'east'|'west'|'north' to relocate
    gapFromTower: 2.6
  });
  g.add(lift);

  // --- Bridge from lift to the tower launch deck (auto-oriented)
  const bridge = makeBridge(tower.userData.dim, lift.userData.placement, lift.userData.launchDeckY);
  g.add(bridge);

  // --- Arms (reuse the bright steel from tower via simple material)
  const steel = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.48, metalness: 0.95 });
  const blk   = new THREE.MeshStandardMaterial({ color: 0x2e2f33, roughness: 0.9,  metalness: 0.2  });

  const lowerArmH     = 14.0;
  const mountOuterR   = padBase.userData.mountOuterR ?? 9.2;
  const lowerArmReach = mountOuterR + 3.0;

  const arms = new THREE.Group();
  arms.add(armBeam(+1, lowerArmH, lowerArmReach, tower.userData.dim.baseX, tower.userData.dim.baseZ, tower.userData.dim.width, steel, blk));
  arms.add(armBeam(-1, lowerArmH, lowerArmReach, tower.userData.dim.baseX, tower.userData.dim.baseZ, tower.userData.dim.width, steel, blk));
  g.add(arms);

  // --- Per-frame update: forward to lift
  g.userData.update = (dt, elapsed, { player }={})=>{
    lift.userData.update?.(dt, elapsed, { player });
  };

  return g;
}

/* bridge builder (ramp/tunnel walls + light strip) */
function makeBridge(towerDim, liftPlace, y){
  const { baseX, baseZ, width, length } = towerDim;
  const { side, shaftX, shaftZ, frameW, frameD } = liftPlace;

  const bridge = new THREE.Group(); bridge.name = 'liftBridge';
  const steel = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.48, metalness: 0.95 });
  const glow  = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });

  const bridgeW = 3.2, wallT = 0.12, bridgeH = 2.4;

  let len = 0, fx=0, fz=0, alongX = true;
  if (side==='east'){
    len = (shaftX - frameW/2) - (baseX + width/2);
    fx = (baseX + width/2) + len/2; fz = baseZ; alongX = true;
  } else if (side==='west'){
    len = (baseX - width/2) - (shaftX + frameW/2);
    fx = (shaftX + frameW/2) + len/2; fz = baseZ; alongX = true;
  } else if (side==='south'){
    len = (shaftZ - frameD/2) - (baseZ + length/2);
    fx = baseX; fz = (baseZ + length/2) + len/2; alongX = false;
  } else { // north
    len = (baseZ - length/2) - (shaftZ + frameD/2);
    fx = baseX; fz = (shaftZ + frameD/2) + len/2; alongX = false;
  }
  len = Math.abs(len);

  // floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(alongX? len : bridgeW, 0.18, alongX? bridgeW : len), steel);
  floor.position.set(fx, y - 0.1, fz);

  // walls
  const wallLenGeom = new THREE.BoxGeometry(alongX? len : wallT, bridgeH, alongX? wallT : len);
  const wallA = new THREE.Mesh(wallLenGeom, steel);
  const wallB = new THREE.Mesh(wallLenGeom, steel);
  if (alongX){
    wallA.position.set(fx, y + bridgeH/2 - 0.1, fz - bridgeW/2);
    wallB.position.set(fx, y + bridgeH/2 - 0.1, fz + bridgeW/2);
  } else {
    wallA.position.set(fx - bridgeW/2, y + bridgeH/2 - 0.1, fz);
    wallB.position.set(fx + bridgeW/2, y + bridgeH/2 - 0.1, fz);
  }

  // ceiling strip light
  const strip = new THREE.Mesh(new THREE.BoxGeometry(alongX? len*0.9 : 0.05, 0.05, alongX? 0.05 : len*0.9), glow);
  strip.position.set(fx, y + 1.7, fz);

  bridge.add(floor, wallA, wallB, strip);
  return bridge;
}

function armBeam(side, h, reach, baseX, baseZ, width, steel, blk){
  const len = reach;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.8), steel);
  beam.position.set(baseX + side*(width/2) + len/2, h, baseZ);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), blk);
  pad.position.set(beam.position.x + len/2 - 0.4, h, baseZ);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(len*0.9, 0.12, 0.4), blk);
  tray.position.set(beam.position.x, h + 0.4, baseZ + 0.7);

  const cables = new THREE.Group();
  for (let i=0;i<4;i++){
    const dz = (i - 1.5) * 0.08;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,len,8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 1.0 }));
    cable.position.set(beam.position.x, h + 0.45, baseZ + 0.7 + dz);
    cable.rotation.z = Math.PI/2; cables.add(cable);
  }
  const grp = new THREE.Group(); grp.add(beam, pad, tray, cables); return grp;
}