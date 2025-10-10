import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createPadBase }    from './PadBase.js';
import { createTowerFrame } from './TowerFrame.js';
import { createLiftFrame }  from './LiftFrame.js';

export function createLaunchPadComplex(){
  const g = new THREE.Group(); g.name = 'launchPad';

  const pad = createPadBase(); g.add(pad);

  const tower = createTowerFrame({
    baseX: -pad.userData.hardstandSize/2 + 7.5,
    baseZ: 4,
    height: 46,
    outerW: 12,
    outerL: 12
  });
  g.add(tower);

  // Position the lift on the face you want: 'south' | 'east' | 'west' | 'north'
  const lift = createLiftFrame({
    towerDim: tower.userData.dim,
    side: 'south',          // ← change if needed
    gapFromTower: 2.6
  });
  g.add(lift);

  g.userData.update = (dt, t, ctx)=> lift.userData?.update?.(dt, t, ctx);
  return g;
}