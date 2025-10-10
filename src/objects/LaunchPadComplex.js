import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Stable Launch Pad Complex — white metal frame, expanded tower, open-frame lift,
 * working lift logic, no shader patches or undefined refs.
 */
export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  // --- basic constants ---
  const towerH = 46;
  const towerW = 12;
  const towerL = 12;
  const towerBaseX = -20;
  const towerBaseZ = 4;
  const LAUNCH_DECK_Y = 31;

  const steelWhite = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.45, metalness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });

  // --- main tower frame ---
  const tower = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.9, towerH, 0.9);
  for (const [sx, sz] of [
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ]) {
    const post = new THREE.Mesh(postGeo, steelWhite);
    post.position.set(towerBaseX + sx * towerW / 2, towerH / 2, towerBaseZ + sz * towerL / 2);
    tower.add(post);
  }
  for (let y = 3; y < towerH; y += 3) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW + 1, 0.3, towerL + 1), steelWhite);
    ring.position.set(towerBaseX, y, towerBaseZ);
    tower.add(ring);
  }
  g.add(tower);

  // --- lift shaft ---
  const lift = new THREE.Group(); lift.name = 'lift';
  const shaftX = towerBaseX + towerW / 2 + 6;
  const shaftZ = towerBaseZ;
  const liftH = towerH;
  const liftW = 4.8;
  const liftD = 4.8;
  const carW = 4, carD = 4, carH = 2.5;
  const doorH = 2.4, doorY = 1.2;

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, liftH, 0.4), steelWhite);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = post.clone();
    p.position.set(shaftX + sx * liftW / 2, liftH / 2, shaftZ + sz * liftD / 2);
    lift.add(p);
  }

  // --- lift car ---
  const cab = new THREE.Group();
  const car = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carD), steelWhite);
  car.position.y = carH / 2;
  cab.add(car);

  // interior panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.05), glow);
  panel.position.set(carW / 2 - 0.25, 1.2, carD / 2 - 0.2);
  cab.add(panel);

  // doors
  const doorMat = steelWhite;
  const cabWestL = new THREE.Mesh(new THREE.BoxGeometry(1.2, doorH, 0.06), doorMat);
  const cabWestR = cabWestL.clone();
  cabWestL.position.set(-carW / 2 + 0.6, doorY, 0);
  cabWestR.position.set(-carW / 2 + 0.6, doorY, 0);
  cab.add(cabWestL, cabWestR);

  const cabEastL = cabWestL.clone(), cabEastR = cabWestL.clone();
  cabEastL.position.set(+carW / 2 - 0.6, doorY, 0);
  cabEastR.position.set(+carW / 2 - 0.6, doorY, 0);
  cab.add(cabEastL, cabEastR);

  const GROUND_Y = doorY;
  cab.position.set(shaftX, GROUND_Y, shaftZ);
  lift.add(cab);

  // outer gates
  const westX = shaftX - liftW / 2 + 0.02;
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(1.2, doorH, 0.08), doorMat);
  const gateR = gateL.clone();
  gateL.position.set(westX, doorY, shaftZ - 1.2 / 2);
  gateR.position.set(westX, doorY, shaftZ + 1.2 / 2);
  gateL.rotation.y = Math.PI / 2;
  gateR.rotation.y = Math.PI / 2;
  lift.add(gateL, gateR);

  // call button
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), glow);
  callBtn.rotation.z = Math.PI / 2;
  callBtn.position.set(westX - 0.3, 1.3, shaftZ + 1.4);
  lift.add(callBtn);

  g.add(lift);

  // --- bridge ---
  const bridgeLen = (shaftX - liftW / 2) - (towerBaseX + towerW / 2);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.2, 3.2), steelWhite);
  bridge.position.set((towerBaseX + towerW / 2) + bridgeLen / 2, LAUNCH_DECK_Y, towerBaseZ);
  g.add(bridge);

  // --- simple light ---
  const light = new THREE.PointLight(0xffffff, 1.0, 12, 2.0);
  light.position.set(shaftX, 5, shaftZ);
  g.add(light);

  // --- lift state machine ---
  const state = { phase: 'idleBottom', tGate: 1, tCabW: 1, tCabE: 0, speed: 4.2, doorSpeed: 2.2 };

  // sliding helpers
  function setGate(t) {
    const max = 1.2;
    gateL.position.z = shaftZ - 0.6 - t * max;
    gateR.position.z = shaftZ + 0.6 + t * max;
  }
  function setCabWest(t) {
    const max = 1.2;
    cabWestL.position.x = -carW / 2 + 0.6 - t * max * 0.5;
    cabWestR.position.x = -carW / 2 + 0.6 + t * max * 0.5;
  }
  function setCabEast(t) {
    const max = 1.2;
    cabEastL.position.x = +carW / 2 - 0.6 + t * max * 0.5;
    cabEastR.position.x = +carW / 2 - 0.6 - t * max * 0.5;
  }

  // shared trigger (declared once)
  let wantPress = false;
  if (!window.__launchpadListenersAttached) {
    window.__launchpadListenersAttached = true;
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'e') wantPress = true;
    });
    document.addEventListener('pointerdown', () => (wantPress = true));
  }

  g.userData.update = (dt, _elapsed, { player }) => {
    if (!player) return;
    const near = (p, r) => player.mesh.position.distanceTo(p) <= r;

    const callPos = callBtn.position.clone();
    const panelWorld = panel.position.clone().applyMatrix4(cab.matrixWorld);

    if (wantPress) {
      if (near(callPos, 1.3)) {
        if (state.phase === 'idleBottom') state.phase = 'closingGround';
        else if (state.phase === 'idleTop') state.phase = 'closingTop';
      }
      if (near(panelWorld, 1.1)) {
        if (state.phase === 'idleBottom') state.phase = 'closingGround';
        else if (state.phase === 'idleTop') state.phase = 'closingTop';
      }
    }
    wantPress = false;

    // FSM
    if (state.phase === 'idleBottom') {
      setGate(1); setCabWest(1); setCabEast(0);
    } else if (state.phase === 'closingGround') {
      state.tGate = Math.max(0, state.tGate - dt * state.doorSpeed);
      state.tCabW = Math.max(0, state.tCabW - dt * state.doorSpeed);
      setGate(state.tGate); setCabWest(state.tCabW);
      if (state.tGate <= 0 && state.tCabW <= 0) state.phase = 'movingUp';
    } else if (state.phase === 'movingUp') {
      const dy = LAUNCH_DECK_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)) { cab.position.y = LAUNCH_DECK_Y; state.phase = 'openingTop'; }
      else cab.position.y += step;
    } else if (state.phase === 'openingTop') {
      state.tCabE = Math.min(1, state.tCabE + dt * state.doorSpeed);
      setCabEast(state.tCabE);
      if (state.tCabE >= 1) state.phase = 'idleTop';
    } else if (state.phase === 'closingTop') {
      state.tCabE = Math.max(0, state.tCabE - dt * state.doorSpeed);
      setCabEast(state.tCabE);
      if (state.tCabE <= 0) state.phase = 'movingDown';
    } else if (state.phase === 'movingDown') {
      const dy = GROUND_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)) { cab.position.y = GROUND_Y; state.phase = 'openingGround'; }
      else cab.position.y += step;
    } else if (state.phase === 'openingGround') {
      state.tGate = Math.min(1, state.tGate + dt * state.doorSpeed);
      state.tCabW = Math.min(1, state.tCabW + dt * state.doorSpeed);
      setGate(state.tGate); setCabWest(state.tCabW);
      if (state.tGate >= 1 && state.tCabW >= 1) state.phase = 'idleBottom';
    }
  };

  return g;
}