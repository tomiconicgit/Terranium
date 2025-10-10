// src/objects/LiftFrame.js
// Open-frame shaft + 4x4m car, animated doors, call button and cab panel.
// Exposes userData.update(dt,elapsed,{player}) so Scene can forward updates.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createLiftFrame(opts = {}) {
  const {
    name = 'lift',
    // tower reference for placement & bridge
    towerDim,                 // { baseX, baseZ, width, length, height, launchDeckY }
    side = 'south',           // 'east' | 'south' | 'west' | 'north'
    gapFromTower = 2.6,       // distance from tower frame to lift frame
    frameW = 4.8,
    frameD = 4.8,
    carW = 4.0, carD = 4.0, carH = 2.5,
    doorH = 2.4, doorY = 1.2,
    steelColor = 0xf0f2f5
  } = opts;

  if (!towerDim) {
    throw new Error('createLiftFrame requires opts.towerDim');
  }

  const steel = new THREE.MeshStandardMaterial({
    color: steelColor, roughness: 0.48, metalness: 0.95
  });

  const g = new THREE.Group();
  g.name = name;

  // --- compute shaft center based on requested side ---
  const { baseX, baseZ, width, length, height, launchDeckY } = towerDim;
  let shaftX = baseX;
  let shaftZ = baseZ;

  switch (side) {
    case 'east':
      shaftX = baseX + width / 2 + gapFromTower + frameW / 2;
      break;
    case 'west':
      shaftX = baseX - width / 2 - gapFromTower - frameW / 2;
      break;
    case 'south':
      shaftZ = baseZ + length / 2 + gapFromTower + frameD / 2;
      break;
    case 'north':
      shaftZ = baseZ - length / 2 - gapFromTower - frameD / 2;
      break;
    default:
      break;
  }

  // --- posts & rings ---
  const posts = new THREE.Group();
  const postGeom = new THREE.BoxGeometry(0.4, height, 0.4);
  const corners = [
    [shaftX - frameW / 2, shaftZ - frameD / 2],
    [shaftX + frameW / 2, shaftZ - frameD / 2],
    [shaftX - frameW / 2, shaftZ + frameD / 2],
    [shaftX + frameW / 2, shaftZ + frameD / 2],
  ];
  for (const [x, z] of corners) {
    const p = new THREE.Mesh(postGeom, steel);
    p.position.set(x, height / 2, z);
    posts.add(p);
  }
  g.add(posts);

  for (let y = 0; y < height; y += 3) {
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(frameW + 0.6, 0.24, frameD + 0.6),
      steel
    );
    ring.position.set(shaftX, y + 1.5, shaftZ);
    g.add(ring);
  }

  // Which face is the ground entrance? It must face the tower so we can walk in.
  const entranceFacing = opposite(side);
  const entranceIsXFace = (entranceFacing === 'east' || entranceFacing === 'west');
  const entranceSign = (entranceFacing === 'east' || entranceFacing === 'south') ? +1 : -1;

  // Entrance plane coordinate along the facing axis
  const faceX = shaftX + (entranceIsXFace ? (entranceSign * (frameW / 2 - 0.02)) : 0);
  const faceZ = shaftZ + (!entranceIsXFace ? (entranceSign * (frameD / 2 - 0.02)) : 0);

  // --- Visible ground gate leaves (slide apart) ---
  const gateW = 2.4;
  const gateT = 0.08;
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(gateW / 2, doorH, gateT), steel);
  const gateR = gateL.clone();

  if (entranceIsXFace) {
    // gate moves along Z on the X-face (rotate so thickness points outward)
    gateL.position.set(faceX, doorY, shaftZ - gateW / 4);
    gateR.position.set(faceX, doorY, shaftZ + gateW / 4);
    gateL.rotation.y = Math.PI / 2;
    gateR.rotation.y = Math.PI / 2;
  } else {
    // gate moves along X on the Z-face
    gateL.position.set(shaftX - gateW / 4, doorY, faceZ);
    gateR.position.set(shaftX + gateW / 4, doorY, faceZ);
  }
  g.add(gateL, gateR);

  // --- Call button beside the gate ---
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0
  });
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), glow);
  // orient the button so its flat cap faces the player
  if (entranceIsXFace) {
    callBtn.rotation.z = Math.PI / 2;
    callBtn.position.set(faceX - 0.2, 1.35, shaftZ + gateW / 2 + 0.25);
  } else {
    callBtn.rotation.x = Math.PI / 2;
    callBtn.position.set(shaftX + gateW / 2 + 0.25, 1.35, faceZ - 0.2);
  }
  g.add(callBtn);

  // --- Car (4×4×2.5) with interior panel and doors both sides ---
  const cab = new THREE.Group();
  cab.name = 'liftCab';
  const carBox = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carD), steel);
  carBox.position.y = carH / 2;
  cab.add(carBox);

  // Interior panel near the corner on entrance side
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.05), glow);
  if (entranceIsXFace) {
    const panelZ = (entranceFacing === 'north') ? (-carD / 2 + 0.2) : (carD / 2 - 0.2);
    panel.position.set(carW / 2 - 0.25, 1.2, panelZ);
  } else {
    const panelX = (entranceFacing === 'west') ? (-carW / 2 + 0.25) : (carW / 2 - 0.25);
    panel.position.set(panelX, 1.2, carD / 2 - 0.2);
  }
  cab.add(panel);

  // Sliding door leaves (entrance side + opposite side)
  const doorLeafW = 1.2;
  const cabDoorT = 0.06;

  const entL = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, doorH, cabDoorT), steel);
  const entR = entL.clone();
  const oppL = entL.clone();
  const oppR = entL.clone();

  if (entranceIsXFace) {
    // entrance on X face -> slide along X; panels sit at +/-Z
    const zEnt = (entranceFacing === 'north') ? (-carD / 2 + cabDoorT / 2) : (carD / 2 - cabDoorT / 2);
    const zOpp = -zEnt;
    entL.position.set(0, doorY, zEnt);
    entR.position.set(0, doorY, zEnt);
    oppL.position.set(0, doorY, zOpp);
    oppR.position.set(0, doorY, zOpp);
  } else {
    // entrance on Z face -> slide along Z; panels sit at +/-X
    const xEnt = (entranceFacing === 'west') ? (-carW / 2 + cabDoorT / 2) : (carW / 2 - cabDoorT / 2);
    const xOpp = -xEnt;
    entL.position.set(xEnt, doorY, 0);
    entR.position.set(xEnt, doorY, 0);
    oppL.position.set(xOpp, doorY, 0);
    oppR.position.set(xOpp, doorY, 0);
    // rotate so thin side faces outward
    entL.rotation.y = Math.PI / 2;
    entR.rotation.y = Math.PI / 2;
    oppL.rotation.y = Math.PI / 2;
    oppR.rotation.y = Math.PI / 2;
  }

  cab.add(entL, entR, oppL, oppR);

  const GROUND_Y = doorY;
  cab.position.set(shaftX, GROUND_Y, shaftZ);
  g.add(cab);

  // porch light
  const porch = new THREE.PointLight(0xffffff, 0.6, 12, 2.0);
  if (entranceIsXFace) {
    porch.position.set(faceX - 0.2, 2.7, shaftZ + 0.1);
  } else {
    porch.position.set(shaftX, 2.7, faceZ + 0.1);
  }
  g.add(porch);

  // --- State machine for movement & doors ---
  const state = {
    phase: 'idleBottom',             // idleBottom | openingGround | closingGround | movingUp | idleTop | openingTop | closingTop | movingDown
    tGate: 1,
    tCabEnt: 1,
    tCabOpp: 0,
    speed: 4.2,
    doorSpeed: 2.2
  };

  // gate & door setters
  function setGate(t) {
    const max = gateW / 2;
    if (entranceIsXFace) {
      // slide along Z
      gateL.position.z = shaftZ - gateW / 4 - t * max;
      gateR.position.z = shaftZ + gateW / 4 + t * max;
    } else {
      // slide along X
      gateL.position.x = shaftX - gateW / 4 - t * max;
      gateR.position.x = shaftX + gateW / 4 + t * max;
    }
  }

  function setEntDoors(t) {
    const max = doorLeafW;
    if (entranceIsXFace) {
      entL.position.x = -t * max * 0.5;
      entR.position.x = +t * max * 0.5;
    } else {
      entL.position.z = -t * max * 0.5;
      entR.position.z = +t * max * 0.5;
    }
  }

  function setOppDoors(t) {
    const max = doorLeafW;
    if (entranceIsXFace) {
      oppL.position.x = -t * max * 0.5;
      oppR.position.x = +t * max * 0.5;
    } else {
      oppL.position.z = -t * max * 0.5;
      oppR.position.z = +t * max * 0.5;
    }
  }

  // initialise transforms
  setGate(state.tGate);
  setEntDoors(state.tCabEnt);
  setOppDoors(state.tCabOpp);

  // input (tap or E)
  let wantPress = false;
  function onKey(e) {
    if (e && e.key && e.key.toLowerCase() === 'e') wantPress = true;
  }
  function onTap() { wantPress = true; }
  document.addEventListener('keydown', onKey, { passive: true });
  document.addEventListener('pointerdown', onTap, { passive: true });

  // proximity helpers
  const callPos = new THREE.Vector3(callBtn.position.x, callBtn.position.y, callBtn.position.z);
  const panelLocal = new THREE.Vector3(panel.position.x, panel.position.y, panel.position.z);

  // updater
  g.userData.update = function update(dt, _elapsed, ctx = {}) {
    const player = ctx.player;
    if (!player) return;

    // resolve world positions
    callPos.set(callBtn.position.x, callBtn.position.y, callBtn.position.z);
    const panelWorld = panelLocal.clone().applyMatrix4(cab.matrixWorld);

    const near = (p, r) => player.mesh.position.distanceTo(p) <= r;

    if (wantPress) {
      if (near(callPos, 1.3)) {
        if (state.phase === 'idleTop') {
          state.phase = 'closingTop';
        } else if (state.phase === 'idleBottom') {
          state.phase = 'openingGround';
        }
      }
      if (near(panelWorld, 1.1)) {
        if (state.phase === 'idleBottom') state.phase = 'closingGround';
        else if (state.phase === 'idleTop') state.phase = 'closingTop';
      }
    }
    wantPress = false;

    // FSM
    if (state.phase === 'idleBottom') {
      state.tGate = 1; state.tCabEnt = 1; state.tCabOpp = 0;
      setGate(state.tGate); setEntDoors(state.tCabEnt); setOppDoors(state.tCabOpp);
    } else if (state.phase === 'openingGround') {
      state.tGate = Math.min(1, state.tGate + dt * state.doorSpeed);
      state.tCabEnt = Math.min(1, state.tCabEnt + dt * state.doorSpeed);
      setGate(state.tGate); setEntDoors(state.tCabEnt);
      if (state.tGate >= 1 && state.tCabEnt >= 1) state.phase = 'idleBottom';
    } else if (state.phase === 'closingGround') {
      state.tGate = Math.max(0, state.tGate - dt * state.doorSpeed);
      state.tCabEnt = Math.max(0, state.tCabEnt - dt * state.doorSpeed);
      setGate(state.tGate); setEntDoors(state.tCabEnt);
      if (state.tGate <= 0 && state.tCabEnt <= 0) state.phase = 'movingUp';
    } else if (state.phase === 'movingUp') {
      const dy = launchDeckY - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)) {
        cab.position.y = launchDeckY;
        state.phase = 'openingTop';
      } else {
        cab.position.y += step;
      }
      state.tCabOpp = 0; setOppDoors(0);
    } else if (state.phase === 'openingTop') {
      state.tCabOpp = Math.min(1, state.tCabOpp + dt * state.doorSpeed);
      setOppDoors(state.tCabOpp);
      if (state.tCabOpp >= 1) state.phase = 'idleTop';
    } else if (state.phase === 'idleTop') {
      // wait for press
    } else if (state.phase === 'closingTop') {
      state.tCabOpp = Math.max(0, state.tCabOpp - dt * state.doorSpeed);
      setOppDoors(state.tCabOpp);
      if (state.tCabOpp <= 0) state.phase = 'movingDown';
    } else if (state.phase === 'movingDown') {
      const dy2 = doorY - cab.position.y; // GROUND_Y == doorY
      const step2 = Math.sign(dy2) * state.speed * dt;
      if (Math.abs(step2) >= Math.abs(dy2)) {
        cab.position.y = doorY;
        state.phase = 'openingGround';
      } else {
        cab.position.y += step2;
      }
    }
  };

  // expose placement info for bridge construction
  g.userData.placement = { side, shaftX, shaftZ, frameW, frameD };
  g.userData.launchDeckY = launchDeckY;

  return g;
}

function opposite(side) {
  if (side === 'east')  return 'west';
  if (side === 'west')  return 'east';
  if (side === 'north') return 'south';
  return 'north';
}