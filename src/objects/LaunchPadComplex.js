import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  // ---------- layout / sizes ----------
  const hardstandSize = 50;
  const hardstandH    = 0.6;

  const pitClearW     = 14;
  const pitClearL     = 30;
  const pitDepth      = 11.0;

  // ring mount
  const mountOuterR   = 9.2;
  const mountInnerR   = 4.8;
  const mountH        = 3.6;
  const mountBaseY    = hardstandH + 1.2;

  // tower footprint / height
  const towerBaseX    = -hardstandSize/2 + 7.5;
  const towerBaseZ    = 4;
  const towerW        = 7.5;
  const towerL        = 7.5;
  const towerH        = 46;

  // arms / crew deck (top stop target)
  const lowerArmH     = 14.0;
  const upperArmH     = 31.0;              // crew access deck
  const lowerArmReach = mountOuterR + 3.0;
  const crewReach     = mountOuterR + 5.0;

  const LAUNCH_DECK_Y = upperArmH - 1.5;   // stop just under deck slab center

  // ---------- materials ----------
  const conc   = new THREE.MeshStandardMaterial({ color: 0xa2a7ad, roughness: 0.95, metalness: 0.04 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 1.0,  metalness: 0.0  });
  const blk    = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.9,  metalness: 0.2  });

  // White steel frame with subtle brushed/procedural feel
  const steelWhite = new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.55, metalness: 0.9 });
  patchSteelWhite(steelWhite);

  // cladding & windows
  const clad   = new THREE.MeshStandardMaterial({ color: 0x707883, roughness: 0.75, metalness: 0.6  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0b1420, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0x0b1420), emissiveIntensity: 0.25
  });

  // pipes + lights
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb2b08a, roughness: 0.9, metalness: 0.2 });
  const glow    = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });

  // ---------- hardstand (frame around trench) ----------
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

  // ---------- ring mount ----------
  const ringOuter = new THREE.Mesh(new THREE.CylinderGeometry(mountOuterR, mountOuterR, mountH, 64), conc);
  ringOuter.position.y = mountBaseY + mountH/2;

  const ringInnerRim = new THREE.Mesh(new THREE.CylinderGeometry(mountInnerR, mountInnerR, mountH*0.98, 48), blk);
  ringInnerRim.position.y = ringOuter.position.y + 0.01;

  // radial grates on top
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

  // supports under ring
  const supportH = mountBaseY;
  const colG = new THREE.CylinderGeometry(1.0, 1.1, supportH, 12);
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

  // ---------- pit with V-diverter and occluder ----------
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

  const rightPanel = leftPanel.clone();
  rightPanel.position.x = +halfW/2;
  rightPanel.rotation.z = -slope;

  const end1 = new THREE.Mesh(new THREE.BoxGeometry(pitClearW + wallT*2, wallT, wallT), dark);
  const end2 = end1.clone();
  end1.position.set(0, -pitDepth, -pitClearL/2 - wallT/2);
  end2.position.set(0, -pitDepth,  pitClearL/2 + wallT/2);

  const occluder = new THREE.Mesh(new THREE.BoxGeometry(pitClearW+10, 4, pitClearL+10), blk);
  occluder.position.set(0, -pitDepth - 2.5, 0);

  g.add(floor, w1, w2, leftPanel, rightPanel, end1, end2, occluder);

  // ---------- ENCLOSED TOWER (white frame, cladding, windows, decks, pipes, lights) ----------
  const tower = new THREE.Group(); tower.name = 'tower';

  // frame columns & rings (WHITE steel)
  {
    const colBox = new THREE.BoxGeometry(0.8, towerH, 0.8);
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
      const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW+0.8, 0.35, towerL+0.8), steelWhite);
      ring.position.set(towerBaseX, h, towerBaseZ);
      tower.add(ring);
    }
  }

  // cladding & windows between floors; open decks every 9m
  const floorStep = 3, deckEvery = 9;
  const panelT = 0.12, inset = 0.25, winH = 0.9, winInset = 0.05;

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
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, height, panelT*0.6), mat);
      p.position.set(towerBaseX, yMid, towerBaseZ + (side==='N' ? (towerL/2 - panelT*0.6) : -(towerL/2 - panelT*0.6)));
      return p;
    } else {
      const w = towerL - inset*2 - winInset*2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(panelT*0.6, height, w), mat);
      p.position.set(towerBaseX + (side==='E' ? (towerW/2 - panelT*0.6) : -(towerW/2 - panelT*0.6)), yMid, towerBaseZ);
      return p;
    }
  }

  const edgeLightGeom = new THREE.BoxGeometry(1.0, 0.05, 0.05);
  for (let y=floorStep; y<towerH; y+=floorStep){
    const isDeck = (y % deckEvery) === 0;
    const yMid = y - floorStep/2;

    if (isDeck){
      const slab = new THREE.Mesh(new THREE.BoxGeometry(towerW - 0.8, 0.2, towerL - 0.8), steelWhite);
      slab.position.set(towerBaseX, yMid, towerBaseZ);
      tower.add(slab);

      const strips = new THREE.Group();
      const lenX = towerW - 0.6, lenZ = towerL - 0.6;
      const mkStrip = (len, alongX, sign)=> {
        const s = new THREE.Mesh(edgeLightGeom, glow);
        s.scale.set(alongX? len : 1, 1, alongX? 1 : len);
        const px = towerBaseX + (alongX ? 0 : (sign*(towerW/2 - 0.1)));
        const pz = towerBaseZ + (alongX ? (sign*(towerL/2 - 0.1)) : 0);
        s.position.set(px, yMid+0.15, pz);
        strips.add(s);
      };
      mkStrip(lenX, true, +1);  mkStrip(lenX, true, -1);
      mkStrip(lenZ, false, +1); mkStrip(lenZ, false, -1);
      tower.add(strips);

      for (const [dx,dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]){
        const L = new THREE.PointLight(0xffffff, 0.4, 14, 2.0);
        L.position.set(towerBaseX + dx*(towerW/2 - 0.2), yMid+0.6, towerBaseZ + dz*(towerL/2 - 0.2));
        tower.add(L);
      }
    } else {
      const isWindowBand = ((y/floorStep) % 2) === 0;
      if (!isWindowBand){
        tower.add(panel('N', yMid, floorStep-0.15, clad));
        tower.add(panel('S', yMid, floorStep-0.15, clad));
        tower.add(panel('E', yMid, floorStep-0.15, clad));
        tower.add(panel('W', yMid, floorStep-0.15, clad));
      } else {
        const bandH = winH;
        const capH  = (floorStep-0.15 - bandH)/2;
        for (const side of ['N','S','E','W']){
          tower.add(panel(side, yMid + (bandH/2 + capH/2), capH, clad));
          tower.add(panel(side, yMid - (bandH/2 + capH/2), capH, clad));
          tower.add(windowStrip(side, yMid, bandH));
        }
      }
    }
  }

  // piping
  const pipeR = 0.10;
  const pipeVGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerH-1.5, 8);
  const pipeHGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerW-1.4, 8);
  const v1 = new THREE.Mesh(pipeVGeom, pipeMat);
  v1.position.set(towerBaseX + (towerW/2 - 0.45), (towerH-1.5)/2, towerBaseZ + 1.2);
  const v2 = v1.clone(); v2.position.z = towerBaseZ - 1.2;
  tower.add(v1, v2);
  for (let y=floorStep; y<towerH; y+=9){
    const hPipe = new THREE.Mesh(pipeHGeom, pipeMat);
    hPipe.position.set(towerBaseX, y - floorStep/2 + 0.45, towerBaseZ + 1.2);
    hPipe.rotation.z = Math.PI/2;
    const hPipe2 = hPipe.clone(); hPipe2.position.z = towerBaseZ - 1.2;
    tower.add(hPipe, hPipe2);
  }
  g.add(tower);

  // ---------- LIFT TOWER (left side of main tower) ----------
  // Position: to the WEST (-X) of the tower frame
  const lift = new THREE.Group(); lift.name = 'lift';
  const gapX = 2.4; // distance from tower frame
  const shaftW = 3.0, shaftD = 2.2, shaftWallT = 0.12;
  const shaftX = towerBaseX - towerW/2 - gapX - shaftW/2;
  const shaftZ = towerBaseZ;

  // shaft walls (simple box shell)
  const shaftShell = new THREE.Mesh(new THREE.BoxGeometry(shaftW, towerH, shaftD), clad);
  shaftShell.position.set(shaftX, towerH/2, shaftZ);
  lift.add(shaftShell);

  // Ground entrance (east face of lift shaft)
  const doorH = 2.2, doorW = 1.6, doorT = 0.08;
  const doorY = 1.1;
  const doorX = shaftX + shaftW/2 - shaftWallT/2; // east face
  const doorZ = shaftZ;

  const doorL = new THREE.Mesh(new THREE.BoxGeometry(doorW/2, doorH, doorT), steelWhite);
  const doorR = doorL.clone();
  doorL.position.set(doorX - doorW/4, doorY, doorZ);
  doorR.position.set(doorX + doorW/4, doorY, doorZ);
  lift.add(doorL, doorR);

  // Call button (outside)
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.04,16), glow);
  callBtn.rotation.x = Math.PI/2;
  callBtn.position.set(doorX + 0.35, 1.3, doorZ + 0.75);
  lift.add(callBtn);

  // Interior cab (moves)
  const cab = new THREE.Group(); cab.name = 'liftCab';
  const cabW = shaftW - 0.25, cabD = shaftD - 0.25, cabH = 2.2;
  const cabBox = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), steelWhite);
  cabBox.position.y = cabH/2;
  cab.add(cabBox);

  // Interior panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.04), glow);
  panel.position.set(cabW/2 - 0.25, 1.1, cabD/2 - 0.15);
  cab.add(panel);

  // Interior sliding doors (east side when at ground; west side when at deck)
  const inDoorL = new THREE.Mesh(new THREE.BoxGeometry(doorW/2, doorH, doorT), steelWhite);
  const inDoorR = inDoorL.clone();
  // east face inside cab (local)
  inDoorL.position.set(+cabW/2 - doorW/4, doorY, 0);
  inDoorR.position.set(+cabW/2 + doorW/4 - doorW/2, doorY, 0);
  cab.add(inDoorL, inDoorR);

  // Opposite-side deck doors (WEST face at the Launch Deck level)
  const deckDoorL = new THREE.Mesh(new THREE.BoxGeometry(doorW/2, doorH, doorT), steelWhite);
  const deckDoorR = deckDoorL.clone();
  // placed in the shaft at deck height, west face
  deckDoorL.position.set(shaftX - shaftW/2 + shaftWallT/2 + (-doorW/4), LAUNCH_DECK_Y, shaftZ);
  deckDoorR.position.set(shaftX - shaftW/2 + shaftWallT/2 + (+doorW/4), LAUNCH_DECK_Y, shaftZ);

  lift.add(deckDoorL, deckDoorR);

  // Cab initial position at ground
  const GROUND_Y = doorY; // visually aligns with ground door
  cab.position.set(shaftX, GROUND_Y, shaftZ);
  lift.add(cab);

  // Small downlight over ground entrance
  const porch = new THREE.PointLight(0xffffff, 0.5, 10, 2.0);
  porch.position.set(doorX + 0.2, 2.6, doorZ + 0.8);
  lift.add(porch);

  g.add(lift);

  // ---------- ARMS ----------
  const arms = new THREE.Group();
  arms.add(armBeam(+1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steelWhite, blk));
  arms.add(armBeam(-1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steelWhite, blk));
  g.add(arms);

  // ---------- CREW ACCESS ----------
  const crew = new THREE.Group();
  const spineL = crewReach;
  const spine  = new THREE.Mesh(new THREE.BoxGeometry(spineL, 1.1, 1.1), steelWhite);
  spine.position.set(towerBaseX + towerW/2 + spineL/2, upperArmH, towerBaseZ + 1.1);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 2.0), steelWhite);
  tunnel.position.set(spine.position.x + spineL/2 - 1.1, upperArmH, towerBaseZ + 1.1);
  crew.add(spine, tunnel, makeHandrail(spine, +0.7), makeHandrail(spine, -0.7));
  g.add(crew);

  // ================== LIFT STATE / INTERACTION ==================
  const state = {
    phase: 'idleBottom', // 'idleBottom' | 'doorsOpeningGround' | 'doorsClosingGround' | 'movingUp' | 'idleTop' | 'doorsOpeningTop' | 'doorsClosingTop' | 'movingDown'
    tDoors: 0,           // 0..1 for door animation
    speed: 4.2,          // m/s cab
    doorSpeed: 2.4,      // 1/s (for tDoors)
  };

  // Helper: proximity to a 3D point (no raycasting needed)
  function near(player, p, r=1.2){
    return player && player.mesh.position.distanceTo(p) <= r;
  }

  // Ground call button world pos & interior panel world pos (computed each update)
  const callPos = new THREE.Vector3(callBtn.position.x, callBtn.position.y, callBtn.position.z);
  const panelLocal = new THREE.Vector3(panel.position.x, panel.position.y, panel.position.z);

  // Input: E-key OR any pointer when near an interactive
  let wantPress = false;
  document.addEventListener('keydown', (e)=> { if (e.key.toLowerCase()==='e') wantPress = true; }, { passive:true });
  document.addEventListener('pointerdown', ()=> { wantPress = true; }, { passive:true });

  // Doors set function (0 closed, 1 open)
  function setGroundDoors(t){
    const maxSlide = doorW/2; // each leaf slides half width
    doorL.position.x = doorX - doorW/4 - t*maxSlide;
    doorR.position.x = doorX + doorW/4 + t*maxSlide;
  }
  function setCabDoors(t){
    // cab east doors (open at ground)
    const max = doorW/2;
    inDoorL.position.x = +cabW/2 - doorW/4 - t*max;
    inDoorR.position.x = +cabW/2 + doorW/4 - doorW/2 + t*max;
  }
  function setDeckDoors(t){
    const max = doorW/2;
    deckDoorL.position.x = (shaftX - shaftW/2 + shaftWallT/2 - doorW/4) - t*max;
    deckDoorR.position.x = (shaftX - shaftW/2 + shaftWallT/2 + doorW/4) + t*max;
  }

  // Initialize doors closed at both levels
  setGroundDoors(0); setCabDoors(0); setDeckDoors(0);

  // Per-frame update attached to group
  g.userData.update = (dt, _elapsed, ctx={})=>{
    const player = ctx.player;
    wantPress = !!wantPress; // keep boolean

    // Update world positions used for proximity checks
    callPos.set(callBtn.position.x, callBtn.position.y, callBtn.position.z);
    const cabWorld = new THREE.Vector3().setFromMatrixPosition(cab.matrixWorld);
    const panelWorld = panelLocal.clone().applyMatrix4(cab.matrixWorld);

    // Handle input intents
    if (wantPress) {
      // Press near ground call button?
      if (near(player, callPos, 1.3)) {
        if (state.phase==='idleTop') { state.phase='doorsClosingTop'; }
        else if (state.phase==='idleBottom') { state.phase='doorsOpeningGround'; }
        else if (state.phase==='movingUp' || state.phase==='movingDown') {
          // ignore while moving
        } else if (state.phase==='idleTop' || state.phase==='doorsOpeningTop' || state.phase==='doorsClosingTop') {
          // will close and move down once closed (handled below)
        }
      }
      // Press near interior panel?
      if (near(player, panelWorld, 1.1)) {
        if (state.phase==='idleBottom') state.phase='doorsClosingGround';
        else if (state.phase==='idleTop') state.phase='doorsClosingTop';
      }
    }
    wantPress = false; // consume

    // State machine
    if (state.phase==='idleBottom') {
      setGroundDoors(1); setCabDoors(1); setDeckDoors(0); state.tDoors=1;
      // wait for input

    } else if (state.phase==='doorsOpeningGround') {
      state.tDoors = Math.min(1, state.tDoors + dt*state.doorSpeed);
      setGroundDoors(state.tDoors); setCabDoors(state.tDoors);
      if (state.tDoors>=1) state.phase='idleBottom';

    } else if (state.phase==='doorsClosingGround') {
      state.tDoors = Math.max(0, state.tDoors - dt*state.doorSpeed);
      setGroundDoors(state.tDoors); setCabDoors(state.tDoors);
      if (state.tDoors<=0) state.phase='movingUp';

    } else if (state.phase==='movingUp') {
      const dy = LAUNCH_DECK_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)) { cab.position.y = LAUNCH_DECK_Y; state.phase='doorsOpeningTop'; state.tDoors=0; }
      else cab.position.y += step;
      // keep ground/inside doors closed while moving
      setGroundDoors(0); setCabDoors(0); setDeckDoors(0);

    } else if (state.phase==='doorsOpeningTop') {
      state.tDoors = Math.min(1, state.tDoors + dt*state.doorSpeed);
      setDeckDoors(state.tDoors); setCabDoors(state.tDoors);
      if (state.tDoors>=1) state.phase='idleTop';

    } else if (state.phase==='idleTop') {
      setDeckDoors(1); setCabDoors(1); setGroundDoors(0);
      // wait for input

    } else if (state.phase==='doorsClosingTop') {
      state.tDoors = Math.max(0, state.tDoors - dt*state.doorSpeed);
      setDeckDoors(state.tDoors); setCabDoors(state.tDoors);
      if (state.tDoors<=0) state.phase='movingDown';

    } else if (state.phase==='movingDown') {
      const dy = GROUND_Y - cab.position.y;
      const step = Math.sign(dy) * state.speed * dt;
      if (Math.abs(step) >= Math.abs(dy)) { cab.position.y = GROUND_Y; state.phase='doorsOpeningGround'; state.tDoors=0; }
      else cab.position.y += step;
      setGroundDoors(0); setCabDoors(0); setDeckDoors(0);
    }
  };

  return g;
}

/* ===== helpers ===== */

function makeHandrail(spine, offsetZ){
  const len = spine.geometry.parameters.width;
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05,0.05,len*0.95,8),
    new THREE.MeshStandardMaterial({ color: 0xdadada, roughness:0.7, metalness:0.6 })
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

// Procedural brushed/oxidized variation for white steel
function patchSteelWhite(mat){
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <worldpos_vertex>','#include <worldpos_vertex>\n vWPos = worldPosition.xyz;'
    );
    shader.fragmentShader = `
      varying vec3 vWPos;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
    ` + shader.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec3 tint = diffuse.rgb;
      float broad = vnoise(vWPos.xz * 0.12);
      float fine  = vnoise(vWPos.xz * 3.5);
      tint *= 0.985 + broad*0.015;
      tint *= 0.99 + fine*0.01;
      vec4 diffuseColor = vec4(tint, opacity);
      `
    ).replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // subtle brushed anisotropy + micro variation
      float aniso = 0.08 * (0.5 + 0.5 * sin(vWPos.x * 5.0));
      roughnessFactor = clamp(roughnessFactor - aniso + vnoise(vWPos.xz*2.5)*0.04, 0.06, 0.85);
      `
    ).replace(
      '#include <metalnessmap_fragment>',
      `
      #include <metalnessmap_fragment>
      metalnessFactor = clamp(metalnessFactor * (0.97 + vnoise(vWPos.xz*0.9)*0.06), 0.6, 1.0);
      `
    );
  };
}