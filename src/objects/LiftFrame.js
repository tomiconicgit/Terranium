// src/objects/LiftFrame.js
// Open-frame shaft + 4x4m car, animated doors, call button and cab panel.
// Can be placed on any side of the tower. Exposes userData.update(dt,elapsed,{player})
// so the scene can forward updates.

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

  if (!towerDim) throw new Error('createLiftFrame requires opts.towerDim');

  const steel = new THREE.MeshStandardMaterial({ color: steelColor, roughness: 0.48, metalness: 0.95 });

  const g = new THREE.Group(); g.name = name;

  // --- compute shaft center based on requested side ---
  const { baseX, baseZ, width, length, height, launchDeckY } = towerDim;
  let shaftX = baseX, shaftZ = baseZ;
  switch (side) {
    case 'east':  shaftX = baseX + width/2 + gapFromTower + frameW/2; break;
    case 'west':  shaftX = baseX - width/2 - gapFromTower - frameW/2; break;
    case 'south': shaftZ = baseZ + length/2 + gapFromTower + frameD/2; break;
    case 'north': shaftZ = baseZ - length/2 - gapFromTower - frameD/2; break;
  }

  // --- posts & rings ---
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, height, 0.4), steel);
  const posts = new THREE.Group();
  const corners = [
    [shaftX - frameW/2, shaftZ - frameD/2],
    [shaftX + frameW/2, shaftZ - frameD/2],
    [shaftX - frameW/2, shaftZ + frameD/2],
    [shaftX + frameW/2, shaftZ + frameD/2],
  ];
  for (const [x,z] of corners){
    const p = post.clone(); p.position.set(x, height/2, z); posts.add(p);
  }
  g.add(posts);
  for (let y=0; y<height; y+=3){
    const ring = new THREE.Mesh(new THREE.BoxGeometry(frameW+0.6, 0.24, frameD+0.6), steel);
    ring.position.set(shaftX, y+1.5, shaftZ);
    g.add(ring);
  }

  // Which face is the ground entrance? It must face the tower so we can walk in.
  // For south shaft, the entrance faces north (toward tower). For east -> west, west -> east, north -> south.
  const entranceFacing = opposite(side);
  const axis = (entranceFacing === 'east' || entranceFacing === 'west') ? 'x' : 'z';
  const entranceSign = (entranceFacing === 'east' || entranceFacing === 'south') ? +1 : -1;

  // Calculate entrance plane coordinate
  const faceX = shaftX + (axis==='x' ? (entranceSign * (frameW/2 - 0.02)) : 0);
  const faceZ = shaftZ + (axis==='z' ? (entranceSign * (frameD/2 - 0.02)) : 0);

  // Visible ground gate leaves (slide away from center)
  const gateW = 2.4, gateT = 0.08;
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(gateW/2, doorH, gateT), steel);
  const gateR = gateL.clone();
  if (axis === 'x') {
    // gate moves along Z on the X-face
    gateL.position.set(faceX, doorY, shaftZ - gateW/4);
    gateR.position.set(faceX, doorY, shaftZ + gateW/4);
    gateL.rotation.y = Math.PI/2; gateR.rotation.y = Math.PI/2;
  } else {
    // gate moves along X on the Z-face
    gateL.position.set(shaftX - gateW/4, doorY, faceZ);
    gateR.position.set(shaftX + gateW/4, doorY, faceZ);
  }
  g.add(gateL, gateR);

  // Call button beside the gate
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.04,16), glow);
  callBtn.rotation.x = (axis === 'x') ? 0 : Math.PI/2;
  callBtn.rotation.z = (axis === 'x') ? Math.PI/2 : 0;
  callBtn.position.set(
    (axis==='x') ? (faceX - 0.2) : (shaftX + gateW/2 + 0.25),
    1.35,
    (axis==='x') ? (shaftZ + gateW/2 + 0.25) : (faceZ - 0.2)
  );
  g.add(callBtn);

  // Car (4×4×2.5) with interior panel and doors both sides (entrance + opposite)
  const cab = new THREE.Group(); cab.name = 'liftCab';
  const carBox = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carD), steel);
  carBox.position.y = carH/2; cab.add(carBox);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.05), glow);
  // Put panel near the corner on the entrance side INSIDE the cab
  if (axis === 'x') {
    const panelZ = (entranceFacing === 'north') ? (-carD/2 + 0.2) : (carD/2 - 0.2);
    panel.position.set(carW/2 - 0.25, 1.2, panelZ);
  } else {
    const panelX = (entranceFacing === 'west') ? (-carW/2 + 0.25) : (carW/2 - 0.25);
    panel.position.set(panelX, 1.2, carD/2 - 0.2);
  }
  cab.add(panel);

  // Sliding door helpers — position pairs on both sides
  const doorLeafW = 1.2, cabDoorT = 0.06;
  // entrance side pair:
  const entL = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, doorH, cabDoorT), steel);
  const entR = entL.clone();
  // opposite side pair:
  const oppL = entL.clone(), oppR = entL.clone();

  if (axis === 'x') {
    // entrance on X face -> doors slide along X, leaves live at ±Z center
    const zEnt = (entranceFacing === 'north') ? -carD/2 + cabDoorT/2 : carD/2 - cabDoorT/2;
    const zOpp = -zEnt;
    entL.position.set(+0.0, doorY, zEnt);
    entR.position.set(+0.0, doorY, zEnt);
    oppL.position.set(+0.0, doorY, zOpp);
    oppR.position.set(+0.0, doorY, zOpp);
  } else {
    // entrance on Z face -> slide along Z at ±X center
    const xEnt = (entranceFacing === 'west') ? -carW/2 + cabDoorT/2 : carW/2 - cabDoorT/2;
    const xOpp = -xEnt;
    entL.position.set(xEnt, doorY, 0);
    entR.position.set(xEnt, doorY, 0);
    oppL.position.set(xOpp, doorY, 0);
    oppR.position.set(xOpp, doorY, 0);
    // rotate those panels 90° so the thin side faces outward
    entL.rotation.y = entR.rotation.y = oppL.rotation.y = oppR.rotation.y = Math.PI/2;
  }

  cab.add(entL, entR, oppL, oppR);

  const GROUND_Y = doorY;
  cab.position.set(shaftX, GROUND_Y, shaftZ);
  g.add(cab);

  // small porch light
  const porch = new THREE.PointLight(0xffffff, 0.6, 12, 2.0);
  porch.position.set(
    (axis==='x') ? (faceX - 0.2) : shaftX,
    2.7,
    (axis==='x') ? shaftZ : (faceZ + 0.1)
  );
  g.add(porch);

  // --- State machine for movement & doors ---
  const state