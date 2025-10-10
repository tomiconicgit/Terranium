// src/objects/LaunchPadComplex.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Launch pad complex: bright metals, enclosed tower with decks & window bands,
 * open-frame lift on pad side (east), 4x4m car, bridge to launch deck.
 * Interaction: tap/E near call button or cab panel to move lift & open doors.
 */
export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  /* ------------ Layout (meters) ------------ */
  const hardstandSize = 56;
  const hardstandH    = 0.6;

  // Trench
  const pitClearW     = 14;
  const pitClearL     = 30;
  const pitDepth      = 11;

  // Ring mount
  const mountOuterR   = 9.2;
  const mountInnerR   = 4.8;
  const mountH        = 3.6;
  const mountBaseY    = hardstandH + 1.2;

  // Tower footprint — expanded so decks have ~2 tiles (≈4 m) walkway
  const towerBaseX    = -hardstandSize/2 + 7.5;
  const towerBaseZ    = 4;
  const towerW        = 12.0;
  const towerL        = 12.0;
  const towerH        = 46;

  // Arms / crew deck level
  const lowerArmH     = 14.0;
  const upperArmH     = 31.0;            // crew/launch deck elevation
  const LAUNCH_DECK_Y = upperArmH;

  const lowerArmReach = mountOuterR + 3.0;
  const crewReach     = mountOuterR + 5.0;

  // Lift (pad side / east)
  const liftGapX      = 2.6;
  const liftFrameW    = 4.8;             // frame outside
  const liftFrameD    = 4.8;
  const carW          = 4.0;
  const carD          = 4.0;
  const carH          = 2.5;

  /* ------------ Materials (brighter) ------------ */
  const conc     = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.95, metalness: 0.04 });
  const dark     = new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 1.0,  metalness: 0.0  });
  const blk      = new THREE.MeshStandardMaterial({ color: 0x2e2f33, roughness: 0.9,  metalness: 0.2  });

  const steelWhite = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.48, metalness: 0.95 });
  // Safe shader tweak — will only patch if the chunks exist; otherwise no-op.
  try { patchSteelWhiteSafely(steelWhite); } catch (e) { console.warn('Steel shader patch disabled:', e); }

  const clad     = new THREE.MeshStandardMaterial({ color: 0x8d97a3, roughness: 0.72, metalness: 0.6  });
  const windowMat= new THREE.MeshStandardMaterial({
    color: 0x7fa0c4, roughness: 0.25, metalness: 0.05,
    emissive: 0x2a4058, emissiveIntensity: 0.35
  });

  const pipeMat  = new THREE.MeshStandardMaterial({ color: 0xc8c59e, roughness: 0.9, metalness: 0.2 });
  const glow     = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });

  /* ------------ Hardstand around trench ------------ */
  const frame = new THREE.Group(); g.add(frame);
  const frameW = (hardstandSize - pitClearW) / 2;
  const addSlab = (w,l,x,z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hardstandH, l), conc);
    m.position.set(x, hardstandH/2, z); frame.add(m);
  };
  addSlab(frameW, hardstandSize, - (pitClearW/2 + frameW/2), 0);
  addSlab(frameW, hardstandSize,   (pitClearW/2 + frameW/2), 0);
  const capL = (hardstandSize - pitClearL) / 2;
  addSlab(pitClearW, capL, 0,  (pitClearL/2 + capL/2));
  addSlab(pitClearW, capL, 0, -(pitClearL/2 + capL/2));

  /* ------------ Ring mount ------------ */
  const ringOuter = new THREE.Mesh(new THREE.CylinderGeometry(mountOuterR, mountOuterR, mountH, 64), conc);
  ringOuter.position.y = mountBaseY + mountH/2;

  const ringInnerRim = new THREE.Mesh(new THREE.CylinderGeometry(mountInnerR, mountInnerR, mountH*0.98, 48), blk);
  ringInnerRim.position.y = ringOuter.position.y + 0.01;

  const grate = new THREE.Group();
  {
    const segCount = 16, segW = (Math.PI * 2 * (mountOuterR + mountInnerR)/2) / segCount * 0.9;
    for (let i=0;i<segCount;i++){
      const t = (i/segCount) * Math.PI*2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.18, (mountOuterR - mountInnerR) * 0.85), blk);
      const rMid = (mountOuterR + mountInnerR)/2;
      seg.position.set(Math.cos(t) * rMid, mountBaseY + mountH + 0.09, Math.sin(t) * rMid);
      seg.rotation.y = -t; grate.add(seg);
    }
  }

  const supportH = mountBaseY;
  const colG = new THREE.CylinderGeometry(1.05, 1.15, supportH, 14);
  const cols = new THREE.Group();
  const colR = mountOuterR + 1.2;
  for (let i=0;i<4;i++){
    const a = i * Math.PI/2 + Math.PI/4;
    const x = Math.cos(a) * colR;
    const z = Math.sin(a) * colR;
    const c = new THREE.Mesh(colG, dark);
    c.position.set(x, hardstandH + supportH/2, z);
    cols.add(c);
  }
  g.add(ringOuter, ringInnerRim, grate, cols);

  /* ------------ Trench with V-diverter + occluder ------------ */
  const floor = new THREE.Mesh(new THREE.BoxGeometry(pitClearW-0.6, 0.6, pitClearL-0.6), blk);
  floor.position.set(0, -pitDepth - 0.3, 0);

  const wallT = 0.6, wallH = pitDepth;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, pitClearL), dark);
  const w2 = w1.clone();
  w1.position.set(-pitClearW/2 - wallT/2, -wallH/2, 0);
  w2.position.set( pitClearW/2 + wallT/2, -wallH/2, 0);

  const halfW = (pitClearW - 1.0) / 2;
  const vLen = pitClearL - 1.0;
  const slope = Math.atan2(halfW, pitDepth - 1.0);
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry( halfW, 0.5, vLen ), dark);
  leftPanel.position.set(-halfW/2, -(pitDepth/2), 0);
  leftPanel.rotation.z =  slope;
  const rightPanel = leftPanel.clone(); rightPanel.position.x = +halfW/2; rightPanel.rotation.z = -slope;

  const end1 = new THREE.Mesh(new THREE.BoxGeometry(pitClearW + wallT*2, wallT, wallT), dark);
  const end2 = end1.clone();
  end1.position.set(0, -pitDepth, -pitClearL/2 - wallT/2);
  end2.position.set(0, -pitDepth,  pitClearL/2 + wallT/2);

  const occluder = new THREE.Mesh(new THREE.BoxGeometry(pitClearW+10, 4, pitClearL+10), blk);
  occluder.position.set(0, -pitDepth - 2.5, 0);
  g.add(floor, w1, w2, leftPanel, rightPanel, end1, end2, occluder);

  /* ------------ Enclosed tower (white frame, cladding, windows, decks) ------------ */
  const tower = new THREE.Group(); tower.name = 'tower';

  // Columns & rings (white steel)
  {
    const colBox = new THREE.BoxGeometry(0.9, towerH, 0.9);
    const corners = [
      [towerBaseX - towerW/2, towerBaseZ - towerL/2],
      [towerBaseX + towerW/2, towerBaseZ - towerL/2],
      [towerBaseX - towerW/2, towerBaseZ + towerL/2],
      [towerBaseX + towerW/2, towerBaseZ + towerL/2],
    ];
    for (const [x,z] of corners) {
      const m = new THREE.Mesh(colBox, steelWhite);
      m.position.set(x, towerH/2, z);
      tower.add(m);
    }
    for (let h=3; h<towerH; h+=3){
      const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW+1.0, 0.36, towerL+1.0), steelWhite);
      ring.position.set(towerBaseX, h, towerBaseZ);
      tower.add(ring);
    }
  }

  // Decks every 8m (walkable), window bands in between
  const deckStep = 8;
  const panelT = 0.12, inset = 0.35, winH = 1.2, winInset = 0.06;

  function panel(side, yMid, height, mat){
    if (side==='N' || side==='S'){
      const w = towerW - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, height, panelT), mat);
      p.position.set(towerBaseX, yMid, towerBaseZ + (side==='N' ? (towerL/2 - panelT/2) : -(towerL/2 - panelT/2)));
      return p;
    } else {
      const w = towerL - inset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT, height, w), mat);
      p.position.set(towerBaseX + (side==='E' ? (towerW/2 - panelT/2) : -(towerW/2 - panelT/2)), yMid, towerBaseZ);
      return p;
    }
  }
  function windowStrip(side, yMid, height){
    const mat = windowMat;
    if (side==='N' || side==='S'){
      const w = towerW - inset*2 - winInset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, height, panelT*0.55), mat);
      p.position.set(towerBaseX, yMid, towerBaseZ + (side==='N' ? (towerL/2 - panelT*0.55) : -(towerL/2 - panelT*0.55)));
      return p;
    } else {
      const w = towerL - inset*2 - winInset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT*0.55, height, w), mat);
      p.position.set(towerBaseX + (side==='E' ? (towerW/2 - panelT*0.55) : -(towerW/2 - panelT*0.55)), yMid, towerBaseZ);
      return p;
    }
  }

  for (let y=deckStep; y<towerH-2; y+=deckStep){
    const deck = new THREE.Mesh(new THREE.BoxGeometry(towerW - 1.4, 0.24, towerL - 1.4), steelWhite);
    deck.position.set(towerBaseX, y, towerBaseZ);
    tower.add(deck);

    // deck edge lights
    const edge = new THREE.Group();
    const mkStrip = (len, alongX, sign)=> {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), glow);
      s.scale.set(alongX? len : 1, 1, alongX? 1 : len);
      const px = towerBaseX + (alongX ? 0 : (sign*(towerW/2 - 0.2)));
      const pz = towerBaseZ + (alongX ? (sign*(towerL/2 - 0.2)) : 0);
      s.position.set(px, y + 0.12, pz);
      edge.add(s);
    };
    mkStrip(towerW-1.6, true, +1);  mkStrip(towerW-1.6, true, -1);
    mkStrip(towerL-1.6, false, +1); mkStrip(towerL-1.6, false, -1);
    tower.add(edge);

    // four small point lights
    for (const [dx,dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]){
      const L = new THREE.PointLight(0xffffff, 0.5, 16, 2.2);
      L.position.set(towerBaseX + dx*(towerW/2 - 0.2), y+0.6, towerBaseZ + dz*(towerL/2 - 0.2));
      tower.add(L);
    }

    // window band between decks
    const bandYMid = y + deckStep/2;
    const capH = (deckStep - 0.24 - winH) * 0.5;
    for (const side of ['N','S','E','W']){
      tower.add(panel(side, bandYMid + (winH/2 + capH/2), capH, clad));
      tower.add(panel(side, bandYMid - (winH/2 + capH/2), capH, clad));
      tower.add(windowStrip(side, bandYMid, winH));
    }
  }

  // Piping rings
  const pipeR = 0.11;
  const pipeVGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerH-1.5, 8);
  const pipeHGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerW-1.6, 8);
  const v1 = new THREE.Mesh(pipeVGeom, pipeMat);
  v1.position.set(towerBaseX + (towerW/2 - 0.55), (towerH-1.5)/2, towerBaseZ + 1.8);
  const v2 = v1.clone(); v2.position.z = towerBaseZ - 1.8;
  tower.add(v1, v2);
  for (let y=8; y<towerH; y+=8){
    const hPipe = new THREE.Mesh(pipeHGeom, pipeMat); hPipe.rotation.z = Math.PI/2;
    hPipe.position.set(towerBaseX, y, towerBaseZ + 1.8);
    const hPipe2 = hPipe.clone(); hPipe2.position.z = towerBaseZ - 1.8;
    tower.add(hPipe, hPipe2);
  }
  g.add(tower);

  /* ------------ Lift tower (open frame) on pad side (east) ------------ */
  const lift = new THREE.Group(); lift.name = 'lift';
  const shaftX = towerBaseX + towerW/2 + liftGapX + liftFrameW/2;
  const shaftZ = towerBaseZ;

  // frame posts + crossbars
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, towerH, 0.4), steelWhite);
  const posts = new THREE.Group();
  const cornersL = [
    [shaftX - liftFrameW/2, shaftZ - liftFrameD/2],
    [shaftX + liftFrameW/2, shaftZ - liftFrameD/2],
    [shaftX - liftFrameW/2, shaftZ + liftFrameD/2],
    [shaftX + liftFrameW/2, shaftZ + liftFrameD/2],
  ];
  for (const [x,z] of cornersL){
    const p = post.clone(); p.position.set(x, towerH/2, z); posts.add(p);
  }
  for (let y=0; y<towerH; y+=3){
    const ring = new THREE.Mesh(new THREE.BoxGeometry(liftFrameW+0.6, 0.24, liftFrameD+0.6), steelWhite);
    ring.position.set(shaftX, y+1.5, shaftZ);
    lift.add(ring);
  }
  lift.add(posts);

  // ground entrance gate (pad-facing / west side)
  const doorH = 2.4, doorW = 2.4, doorT = 0.08, doorY = 1.2;
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(doorW/2, doorH, doorT), steelWhite);
  const gateR = gateL.clone();
  const gateZ = shaftZ;
  const westX = shaftX - liftFrameW/2 + 0.02; // west face
  gateL.position.set(westX, doorY, gateZ - doorW/4);
  gateR.position.set(westX, doorY, gateZ + doorW/4);
  gateL.rotation.y = Math.PI/2; gateR.rotation.y = Math.PI/2;
  lift.add(gateL, gateR);

  // Ground call button
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.04,16), glow);
  callBtn.rotation.z = Math.PI/2;
  callBtn.position.set(westX - 0.2, 1.35, gateZ + doorW/2 + 0.25);
  lift.add(callBtn);

  // Car (visible) + interior panel + cab doors on both sides
  const cab = new THREE.Group(); cab.name = 'liftCab';
  const carBox = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carD), steelWhite);
  carBox.position.y = carH/2;
  cab.add(carBox);

  // rails (visual)
  const rails = new THREE.Group();
  const railGeom = new THREE.BoxGeometry(0.12, towerH, 0.12);
  const r1 = new THREE.Mesh(railGeom, steelWhite); r1.position.set(shaftX - carW/2 + 0.3, towerH/2, shaftZ - carD/2 + 0.3);
  const r2 = r1.clone(); r2.position.z = shaftZ + carD/2 - 0.3;
  const r3 = r1.clone(); r3.position.x = shaftX + carW/2 - 0.3; r3.position.z = shaftZ - carD/2 + 0.3;
  const r4 = r3.clone(); r4.position.z = shaftZ + carD/2 - 0.3;
  rails.add(r1,r2,r3,r4);
  lift.add(rails);

  // Interior panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.05), glow);
  panel.position.set(carW/2 - 0.25, 1.2, carD/2 - 0.2);
  cab.add(panel);

  // Cab sliding doors (west & east faces)
  const doorLeafW = 1.2;
  const cabDoorT = 0.06;
  const cabWestL = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, doorH, cabDoorT), steelWhite);
  const cabWestR = cabWestL.clone();
  cabWestL.position.set(-carW/2 + 0.6, doorY, 0);
  cabWestR.position.set(-carW/2 + 0.6, doorY, 0);
  cab.add(cabWestL, cabWestR);

  const cabEastL = cabWestL.clone();
  const cabEastR = cabWestL.clone();
  cabEastL.position.set(+carW/2 - 0.6, doorY, 0);
  cabEastR.position.set(+carW/2 - 0.6, doorY, 0);
  cab.add(cabEastL, cabEastR);

  // Car initial position at ground
  const GROUND_Y = doorY;
  cab.position.set(shaftX, GROUND_Y, shaftZ);
  lift.add(cab);

  // Porch light
  const porch = new THREE.PointLight(0xffffff, 0.6, 12, 2.0);
  porch.position.set(westX - 0.2, 2.7, gateZ + doorW/2 + 0.1);
  lift.add(porch);

  // Bridge from lift to tower launch deck (ramp/tunnel)
  const bridge = new THREE.Group();
  const bridgeLen = (shaftX - liftFrameW/2) - (towerBaseX + towerW/2);
  const bridgeW = 3.2, bridgeH = 2.4;
  const floorB = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.18, bridgeW), steelWhite);
  floorB.position.set((towerBaseX + towerW/2) + bridgeLen/2, LAUNCH_DECK_Y - 0.1, towerBaseZ);
  const wallsL = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, bridgeH, 0.12), steelWhite);
  wallsL.position.set(floorB.position.x, LAUNCH_DECK_Y + bridgeH/2 - 0.1, towerBaseZ - bridgeW/2);
  const wallsR = wallsL.clone(); wallsR.position.z = towerBaseZ + bridgeW/2;
  const strip1 = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen*0.9, 0.05, 0.05), glow);
  strip1.position.set(floorB.position.x, LAUNCH_DECK_Y + 1.7, towerBaseZ);
  bridge.add(floorB, wallsL, wallsR, strip1);
  g.add(lift, bridge);

  /* ------------ Arms + Crew access (bright) ------------ */
  const arms = new THREE.Group();
  arms.add(armBeam(+1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steelWhite, blk));
  arms.add(armBeam(-1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steelWhite, blk));
  g.add(arms);

  const crew = new THREE.Group();
  const spineL = crewReach;
  const spine  = new THREE.Mesh(new THREE.BoxGeometry(spineL, 1.1, 1.1), steelWhite);
  spine.position.set(towerBaseX + towerW/2 + spineL/2, upperArmH, towerBaseZ + 1.1);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 2.0), steelWhite);
  tunnel.position.set(spine.position.x + spineL/2 - 1.1, upperArmH, towerBaseZ + 1.1);
  crew.add(spine, tunnel, makeHandrail(spine, +0.7), makeHandrail(spine, -0.7));
  g.add(crew);

  /* ------------ Lift state / interaction ------------ */
  const state = {
    phase: 'idleBottom', // idleBottom | openingGround | closingGround | movingUp | idleTop | openingTop | closingTop | movingDown
    tGate: 1,            // ground outer gate open amount (0..1)
    tCabW: 1,            // cab west doors
    tCabE: 0,            // cab east doors (open at top)
    speed: 4.2,
    doorSpeed: 2.2
  };

  const callBtn = lift.children.find(o => o.geometry?.type === 'CylinderGeometry') || null;
  const callPos   = new THREE.Vector3(0,0,0);
  const panelLocal= new THREE.Vector3(0,0,0);
  // find cab panel
  cab.traverse(o=>{ if (o.geometry?.parameters?.depth === 0.05) panelLocal.copy(o.position); });

  let wantPress = false;
  document.addEventListener('keydown', (e)=>{ if (e.key.toLowerCase()==='e') wantPress = true; }, { passive:true });
  document.addEventListener('pointerdown', ()=>{ wantPress = true; }, { passive:true });

  // door setters (sliding)
  function setGate(t){    // ground west gate
    const max = 2.4/2;
    const gateL = lift.children.find(o=>o===lift.children.find(q=>q===lift.children[ lift.children.indexOf(o) ])); // keep simple – we already stored positions when created
  }
  // We keep references created above:
  const gateLRef = gateL, gateRRef = gateR;
  function _setGate(t){    // using saved refs
    const max = 2.4/2;
    gateLRef.position.z = gateZ - 2.4/4 - t*max;
    gateRRef.position.z = gateZ + 2.4/4 + t*max;
  }
  function setCabWest(t){
    const max = 1.2;
    cabWestL.position.x = -carW/2 + 0.6 - t*max*0.5;
    cabWestR.position.x = -carW/2 + 0.6 + t*max*0.5;
  }
  function setCabEast(t){
    const max = 1.2;
    cabEastL.position.x = +carW/2 - 0.6 + t*max*0.5;
    cabEastR.position.x = +carW/2 - 0.6 - t*max*0.5;
  }
  _setGate(state.tGate); setCabWest(state.tCabW); setCabEast(state.tCabE);

  g.userData.update = (dt, _elapsed, ctx={})=>{
    const player = ctx.player;
    if (!player) return;

    // proximity helpers
    const near = (p, r)=> player.mesh.position.distanceTo(p) <= r;
    if (callBtn) callPos.set(callBtn.position.x, callBtn.position.y, callBtn.position.z);
    const panelWorld = panelLocal.clone().applyMatrix4(cab.matrixWorld);

    if (wantPress){
      if (near(callPos, 1.3)){
        if (state.phase==='idleTop'){ state.phase='closingTop'; }
        else if (state.phase==='idleBottom'){ state.phase='openingGround'; }
      }
      if (near(panelWorld, 1.1)){
        if (state.phase==='idleBottom') state.phase='closingGround';
        else if (state.phase==='idleTop') state.phase='closingTop';
      }
    }
    wantPress = false;

    // FSM
    if (state.phase==='idleBottom'){
      state.tGate=1; state.tCabW=1; state.tCabE=0;
      _setGate(state.tGate); setCabWest(state.tCabW); setCabEast(state.tCabE);
    }
    else if (state.phase==='openingGround'){
      state.tGate = Math.min(1, state.tGate + dt*state.doorSpeed);
      state.tCabW = Math.min(1, state.tCabW + dt*state.doorSpeed);
      _setGate(state.tGate); setCabWest(state.tCabW); setCabEast(state.tCabE);
      if (state.tGate>=1 && state.tCabW>=1) state.phase='idleBottom';
    }
    else if (state.phase==='closingGround'){
      state.tGate = Math.max(0, state.tGate - dt*state.doorSpeed);
      state.tCabW = Math.max(0, state.tCabW - dt*state.doorSpeed);
      _setGate(state.tGate); setCabWest(state.tCabW); setCabEast(state.tCabE);
      if (state.tGate<=0 && state.tCabW<=0) state.phase='movingUp';
    }
    else if (state.phase==='movingUp'){
      const dy = LAUNCH_DECK_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)){ cab.position.y = LAUNCH_DECK_Y; state.phase='openingTop'; }
      else cab.position.y += step;
      state.tCabE=0; setCabEast(0);
    }
    else if (state.phase==='openingTop'){
      state.tCabE = Math.min(1, state.tCabE + dt*state.doorSpeed);
      setCabEast(state.tCabE);
      if (state.tCabE>=1) state.phase='idleTop';
    }
    else if (state.phase==='idleTop'){
      // wait for press
    }
    else if (state.phase==='closingTop'){
      state.tCabE = Math.max(0, state.tCabE - dt*state.doorSpeed);
      setCabEast(state.tCabE);
      if (state.tCabE<=0) state.phase='movingDown';
    }
    else if (state.phase==='movingDown'){
      const dy = GROUND_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)){ cab.position.y = GROUND_Y; state.phase='openingGround'; }
      else cab.position.y += step;
    }
  };

  return g;
}

/* ------------ helpers ------------ */
function makeHandrail(spine, offsetZ){
  const len = spine.geometry.parameters.width;
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05,0.05,len*0.95,8),
    new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness:0.65, metalness:0.65 })
  );
  rail.position.set(spine.position.x, spine.position.y + 0.7, spine.position.z + offsetZ);
  rail.rotation.z = Math.PI/2; return rail;
}

function armBeam(side, h, reach, towerBaseX, towerBaseZ, towerW, steel, blk){
  const len = reach;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.8), steel);
  beam.position.set(towerBaseX + side*(towerW/2) + len/2, h, towerBaseZ);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), blk);
  pad.position.set(beam.position.x + len/2 - 0.4, h, towerBaseZ);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(len*0.9, 0.12, 0.4), blk);
  tray.position.set(beam.position.x, h + 0.4, towerBaseZ + 0.7);
  const cables = new THREE.Group();
  for (let i=0;i<4;i++){
    const dz = (i - 1.5) * 0.08;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,len,8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 1.0 }));
    cable.position.set(beam.position.x, h + 0.45, towerBaseZ + 0.7 + dz);
    cable.rotation.z = Math.PI/2; cables.add(cable);
  }
  const grp = new THREE.Group(); grp.add(beam, pad, tray, cables); return grp;
}

/* ------ safe brushed-steel material patch ------ */
function patchSteelWhiteSafely(mat){
  mat.onBeforeCompile = (shader) => {
    const fs = shader.fragmentShader;
    const vs = shader.vertexShader;

    // Only patch if the target chunks exist (prevents string-replace crashes)
    if (!fs.includes('roughnessmap_fragment') || !fs.includes('metalnessmap_fragment')) return;

    shader.vertexShader =
      'varying vec3 vWPos;\n' +
      vs.replace('#include <worldpos_vertex>',
                 '#include <worldpos_vertex>\n vWPos = worldPosition.xyz;');

    shader.fragmentShader = `
      varying vec3 vWPos;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + fs
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
               'vec3 tint=diffuse.rgb; float b=vnoise(vWPos.xz*.12); float f=vnoise(vWPos.xz*3.3);' +
               'tint*=0.985+b*0.015; tint*=0.99+f*0.01; vec4 diffuseColor=vec4(tint,opacity);')
      .replace('#include <roughnessmap_fragment>',
               '#include <roughnessmap_fragment>\n' +
               'roughnessFactor = clamp(roughnessFactor - 0.07*(0.5+0.5*sin(vWPos.x*5.0))' +
               ' + vnoise(vWPos.xz*2.3)*0.04, 0.06, 0.85);')
      .replace('#include <metalnessmap_fragment>',
               '#include <metalnessmap_fragment>\n' +
               'metalnessFactor = clamp(metalnessFactor * (0.98 + vnoise(vWPos.xz*0.9)*0.05), 0.75, 1.0);');
  };
}