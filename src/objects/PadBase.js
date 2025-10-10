// src/objects/PadBase.js
// Concrete hardstand frame around the trench + ring mount + flame trench internals.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createPadBase(opts = {}) {
  const {
    name = 'padBase',
    hardstandSize = 56,
    hardstandH = 0.6,

    // trench
    pitClearW = 14,
    pitClearL = 30,
    pitDepth  = 11,

    // ring
    mountOuterR = 9.2,
    mountInnerR = 4.8,
    mountH      = 3.6,
    mountBaseY  = hardstandH + 1.2,

    // colors
    concColor  = 0xbfc3c8,
    darkColor  = 0x6f757b,
    blkColor   = 0x2e2f33,
  } = opts;

  const conc = new THREE.MeshStandardMaterial({ color: concColor, roughness: 0.95, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 1.0,  metalness: 0.0  });
  const blk  = new THREE.MeshStandardMaterial({ color: blkColor,  roughness: 0.9,  metalness: 0.2  });

  const g = new THREE.Group(); g.name = name;

  // --- hardstand slabs (frame around trench)
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

  // --- ring mount (outer concrete ring + inner darker rim + top grates)
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

  // --- supports under ring
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

  // --- flame trench: floor + side walls + V-diverter + occluder (hide “under-map”)
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
  const vL = new THREE.Mesh(new THREE.BoxGeometry( halfW, 0.5, vLen ), dark);
  vL.position.set(-halfW/2, -(pitDepth/2), 0);
  vL.rotation.z =  slope;
  const vR = vL.clone(); vR.position.x = +halfW/2; vR.rotation.z = -slope;

  const end1 = new THREE.Mesh(new THREE.BoxGeometry(pitClearW + wallT*2, wallT, wallT), dark);
  const end2 = end1.clone();
  end1.position.set(0, -pitDepth, -pitClearL/2 - wallT/2);
  end2.position.set(0, -pitDepth,  pitClearL/2 + wallT/2);

  const occluder = new THREE.Mesh(new THREE.BoxGeometry(pitClearW+10, 4, pitClearL+10), blk);
  occluder.position.set(0, -pitDepth - 2.5, 0);

  g.add(floor, w1, w2, vL, vR, end1, end2, occluder);

  // useful for alignment in other modules
  g.userData.mountOuterR = mountOuterR;
  g.userData.hardstandH  = hardstandH;
  g.userData.hardstandSize = hardstandSize;
  g.userData.pit = { width: pitClearW, length: pitClearL, depth: pitDepth };

  return g;
}