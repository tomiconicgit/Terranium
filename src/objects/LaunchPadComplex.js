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

  // ring mount (shorter) — sits above deck, shows more supports
  const mountOuterR   = 9.2;
  const mountInnerR   = 4.8;
  const mountH        = 3.6;               // was 5.2
  const mountBaseY    = hardstandH + 1.2;  // was +2.0

  // tower
  const towerBaseX    = -hardstandSize/2 + 7.5;
  const towerBaseZ    = 4;
  const towerW        = 7.5;
  const towerL        = 7.5;
  const towerH        = 46;

  // arms (raised a touch because ring is lower)
  const lowerArmH     = 14.0;
  const upperArmH     = 31.0;
  const lowerArmReach = mountOuterR + 3.0;
  const crewReach     = mountOuterR + 5.0;

  // ---------- materials ----------
  const conc  = new THREE.MeshStandardMaterial({ color: 0xa2a7ad, roughness: 0.95, metalness: 0.04 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 1.0,  metalness: 0.0  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.55, metalness: 0.85 });
  const blk   = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.9,  metalness: 0.2  });

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

  // ---------- ring mount (shorter) ----------
  const ringOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(mountOuterR, mountOuterR, mountH, 64), conc
  );
  ringOuter.position.y = mountBaseY + mountH/2;

  const ringInnerRim = new THREE.Mesh(
    new THREE.CylinderGeometry(mountInnerR, mountInnerR, mountH*0.98, 48), blk
  );
  ringInnerRim.position.y = ringOuter.position.y + 0.01;

  // radial grates on top
  const grate = new THREE.Group();
  const segCount = 16, segW = (Math.PI * 2 * (mountOuterR + mountInnerR)/2) / segCount * 0.9;
  for (let i=0;i<segCount;i++){
    const t = (i/segCount) * Math.PI*2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.18, (mountOuterR - mountInnerR) * 0.85), blk);
    const rMid = (mountOuterR + mountInnerR)/2;
    seg.position.set(Math.cos(t) * rMid, mountBaseY + mountH + 0.09, Math.sin(t) * rMid);
    seg.rotation.y = -t; grate.add(seg);
  }

  // supports — stop exactly at ring underside (flush)
  const supportH = mountBaseY;                                 // from hardstand top to ring bottom
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

  // ---------- pit with closed, metal V-diverter (no “under-map” view) ----------
  // floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(pitClearW-0.6, 0.6, pitClearL-0.6), blk);
  floor.position.set(0, -pitDepth - 0.3, 0);

  // side walls
  const wallT = 0.6, wallH = pitDepth;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, pitClearL), dark);
  const w2 = w1.clone();
  w1.position.set(-pitClearW/2 - wallT/2, -wallH/2, 0);
  w2.position.set( pitClearW/2 + wallT/2, -wallH/2, 0);

  // V diverter panels (meet at center) + bottom end caps
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

  // BIG black “closure box” below the pit to guarantee nothing is visible below
  const occluder = new THREE.Mesh(new THREE.BoxGeometry(pitClearW+10, 4, pitClearL+10), blk);
  occluder.position.set(0, -pitDepth - 2.5, 0);

  g.add(floor, w1, w2, leftPanel, rightPanel, end1, end2, occluder);

  // ---------- tower ----------
  const tower = new THREE.Group(); tower.name = 'tower';
  const colBox = new THREE.BoxGeometry(0.8, towerH, 0.8);
  const corners = [
    [towerBaseX - towerW/2, towerBaseZ - towerL/2],
    [towerBaseX + towerW/2, towerBaseZ - towerL/2],
    [towerBaseX - towerW/2, towerBaseZ + towerL/2],
    [towerBaseX + towerW/2, towerBaseZ + towerL/2],
  ];
  for (const [x,z] of corners) {
    const m = new THREE.Mesh(colBox, steel);
    m.position.set(x, towerH/2, z);
    tower.add(m);
  }
  for (let h=3; h<towerH; h+=3){
    const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW+0.8, 0.35, towerL+0.8), steel);
    ring.position.set(towerBaseX, h, towerBaseZ);
    tower.add(ring);
  }
  for (let h=0; h<towerH-3; h+=6){
    tower.add(diag(towerBaseX - towerW/2, towerBaseZ - towerL/2, towerBaseX + towerW/2, towerBaseZ - towerL/2, h, h+3, steel));
    tower.add(diag(towerBaseX + towerW/2, towerBaseZ - towerL/2, towerBaseX - towerW/2, towerBaseZ - towerL/2, h+3, h+6, steel));
    tower.add(diag(towerBaseX + towerW/2, towerBaseZ - towerL/2, towerBaseX + towerW/2, towerBaseZ + towerL/2, h, h+3, steel));
    tower.add(diag(towerBaseX + towerW/2, towerBaseZ + towerL/2, towerBaseX + towerW/2, towerBaseZ - towerL/2, h+3, h+6, steel));
  }
  g.add(tower);

  // ---------- arms ----------
  const arms = new THREE.Group();
  arms.add(armBeam(+1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steel, blk));
  arms.add(armBeam(-1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steel, blk));
  g.add(arms);

  // ---------- crew-access ----------
  const crew = new THREE.Group();
  const spineL = crewReach;
  const spine  = new THREE.Mesh(new THREE.BoxGeometry(spineL, 1.1, 1.1), steel);
  spine.position.set(towerBaseX + towerW/2 + spineL/2, upperArmH, towerBaseZ + 1.1);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 2.0), steel);
  tunnel.position.set(spine.position.x + spineL/2 - 1.1, upperArmH, towerBaseZ + 1.1);
  crew.add(spine, tunnel, makeHandrail(spine, +0.7), makeHandrail(spine, -0.7));
  g.add(crew);

  return g;
}

/* helpers */
function diag(x1,z1,x2,z2, y1,y2, mat) {
  const dx = x2-x1, dz = z2-z1, dy = y2-y1;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), mat);
  m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
  m.lookAt(x2, y2, z2); m.rotateX(Math.PI/2);
  return m;
}
function makeHandrail(spine, offsetZ){
  const len = spine.geometry.parameters.width;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len*0.95,8),
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