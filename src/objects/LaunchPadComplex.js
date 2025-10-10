import { createTowerFrame } from './TowerFrame.js';
import { createPadBase }    from './PadBase.js';     // your pad ring / trench
import { createLiftFrame }  from './LiftFrame.js';   // your open-frame lift

export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  const pad = createPadBase(); g.add(pad);

  // Use the same baseX/baseZ you place the tower at in PadBase so the
  // feet land on the pad.
  const tower = createTowerFrame({
    baseX: -pad.userData.hardstandSize/2 + 7.5, // or your existing tower base
    baseZ: 4,
    height: 46,
    outerW: 12,
    outerL: 12
  });
  g.add(tower);

  // lift on the “pad side” (east), align its bridge to tower.userData.launchDeckY
  const lift = createLiftFrame({
    towerRef: tower,
    deckY: tower.userData.launchDeckY
  });
  g.add(lift);

  // …keep your g.userData.update to tick the lift state machine…
  g.userData.update = (dt, elapsed, ctx)=> {
    lift.userData?.update?.(dt, elapsed, ctx);
  };

  return g;
}