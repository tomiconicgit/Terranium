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

  // ring mount (shorter; shows supports cleanly)
  const mountOuterR   = 9.2;
  const mountInnerR   = 4.8;
  const mountH        = 3.6;
  const mountBaseY    = hardstandH + 1.2;

  // tower footprint / height (keep same height)
  const towerBaseX    = -hardstandSize/2 + 7.5;
  const towerBaseZ    = 4;
  const towerW        = 7.5;
  const towerL        = 7.5;
  const towerH        = 46;

  // arm heights
  const lowerArmH     = 14.0;
  const upperArmH     = 31.0;
  const lowerArmReach = mountOuterR + 3.0;
  const crewReach     = mountOuterR + 5.0;

  // ---------- materials ----------
  const conc   = new THREE.MeshStandardMaterial({ color: 0xa2a7ad, roughness: 0.95, metalness: 0.04 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 1.0,  metalness: 0.0  });
  const steel  = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.55, metalness: 0.85 }); // frame
  const clad   = new THREE.MeshStandardMaterial({ color: 0x707883, roughness: 0.75, metalness: 0.6  });  // side panels
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0b1420, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0x0b1420), emissiveIntensity: 0.25
  }); // bluish-black tinted glass feel
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb2b08a, roughness: 0.9, metalness: 0.2 }); // yellow-grey
  const blk    = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.9,  metalness: 0.2  });
  const glow   = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0 });

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

  // supports to ring underside (flush)
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

  // ---------- pit with closed V-diverter (no see-through) ----------
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

  // occluder under pit to block any “below the map” views
  const occluder = new THREE.Mesh(new THREE.BoxGeometry(pitClearW+10, 4, pitClearL+10), blk);
  occluder.position.set(0, -pitDepth - 2.5, 0);

  g.add(floor, w1, w2, leftPanel, rightPanel, end1, end2, occluder);

  // ---------- enclosed tower with windows / decks / pipes / lights ----------
  const tower = new THREE.Group(); tower.name = 'tower';

  // frame columns
  {
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
    // cross rings (internal bracing every 3m)
    for (let h=3; h<towerH; h+=3){
      const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW+0.8, 0.35, towerL+0.8), steel);
      ring.position.set(towerBaseX, h, towerBaseZ);
      tower.add(ring);
    }
  }

  // cladding panels between floor levels, with alternating window bands.
  // - floor step = 3m; decks open every 9m (no cladding)
  // - window strip on every *other* non-deck floor
  const floorStep = 3;
  const deckEvery = 9;
  const panelT = 0.12; // panel thickness
  const inset = 0.25;  // from frame
  const winH  = 0.9;   // window band height
  const winInset = 0.05;

  // helper: add a rectangular panel on one side
  function panel(side, yMid, height, mat){
    // sides: 'N' (+z), 'S' (-z), 'E' (+x), 'W' (-x)
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

  // windows (as dark glassy strips) – placed flush with panels
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

  // decks (open floors) – add emissive strip lights on edges
  const edgeLightGeom = new THREE.BoxGeometry(1.0, 0.05, 0.05);

  for (let y=floorStep; y<towerH; y+=floorStep){
    const isDeck = (y % deckEvery) === 0;
    const yMid = y - floorStep/2;

    if (isDeck){
      // add thin floor slab inside
      const slab = new THREE.Mesh(new THREE.BoxGeometry(towerW - 0.8, 0.2, towerL - 0.8), steel);
      slab.position.set(towerBaseX, yMid, towerBaseZ);
      tower.add(slab);

      // lights around outside edges (emissive strips + real point lights)
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

      // a few point lights (low intensity, no shadows for perf)
      for (const [dx,dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]){
        const L = new THREE.PointLight(0xffffff, 0.4, 14, 2.0);
        L.position.set(towerBaseX + dx*(towerW/2 - 0.2), yMid+0.6, towerBaseZ + dz*(towerL/2 - 0.2));
        tower.add(L);
      }
    } else {
      // regular closed floor with cladding; windows every other floor
      const isWindowBand = ((y/floorStep) % 2) === 0;
      if (!isWindowBand){
        // solid panels (all four sides)
        tower.add(panel('N', yMid, floorStep-0.15, clad));
        tower.add(panel('S', yMid, floorStep-0.15, clad));
        tower.add(panel('E', yMid, floorStep-0.15, clad));
        tower.add(panel('W', yMid, floorStep-0.15, clad));
      } else {
        // panel above/below with a window strip in the middle (all sides)
        const bandH = winH;
        const capH  = (floorStep-0.15 - bandH)/2;
        // top/bottom caps
        tower.add(panel('N', yMid + (bandH/2 + capH/2), capH, clad));
        tower.add(panel('N', yMid - (bandH/2 + capH/2), capH, clad));
        tower.add(panel('S', yMid + (bandH/2 + capH/2), capH, clad));
        tower.add(panel('S', yMid - (bandH/2 + capH/2), capH, clad));
        tower.add(panel('E', yMid + (bandH/2 + capH/2), capH, clad));
        tower.add(panel('E', yMid - (bandH/2 + capH/2), capH, clad));
        tower.add(panel('W', yMid + (bandH/2 + capH/2), capH, clad));
        tower.add(panel('W', yMid - (bandH/2 + capH/2), capH, clad));
        // window strip
        tower.add(windowStrip('N', yMid, bandH));
        tower.add(windowStrip('S', yMid, bandH));
        tower.add(windowStrip('E', yMid, bandH));
        tower.add(windowStrip('W', yMid, bandH));
      }
    }
  }

  // vertical external piping on two faces + horizontal pipes across decks
  const pipeR = 0.10;
  const pipeVGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerH-1.5, 8);
  const pipeHGeom = new THREE.CylinderGeometry(pipeR, pipeR, towerW-1.4, 8);

  // two vertical risers (east + north faces)
  const v1 = new THREE.Mesh(pipeVGeom, pipeMat);
  v1.position.set(towerBaseX + (towerW/2 - 0.45), (towerH-1.5)/2, towerBaseZ + 1.2);
  const v2 = v1.clone(); v2.position.z = towerBaseZ - 1.2;
  tower.add(v1, v2);

  // horizontal runs at each deck, connecting the two risers (visible in open decks)
  for (let y=floorStep; y<towerH; y+=deckEvery){
    const hPipe = new THREE.Mesh(pipeHGeom, pipeMat);
    hPipe.position.set(towerBaseX, y - floorStep/2 + 0.45, towerBaseZ + 1.2);
    hPipe.rotation.z = Math.PI/2;
    const hPipe2 = hPipe.clone(); hPipe2.position.z = towerBaseZ - 1.2;
    tower.add(hPipe, hPipe2);
  }

  g.add(tower);

  // ---------- arms ----------
  const arms = new THREE.Group();
  arms.add(armBeam(+1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steel, blk));
  arms.add(armBeam(-1, lowerArmH, lowerArmReach, towerBaseX, towerBaseZ, towerW, steel, blk));
  g.add(arms);

  // ---------- crew-access (upper) ----------
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

/* ---------- helpers ---------- */
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

  // a few cable cylinders for detail
  const cables = new THREE.Group();
  for (let i=0;i<4;i++){
    const dz = (i - 1.5) * 0.08;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,len,8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 1.0 }));
    cable.position.set(beam.position.x, h + 0.45, towerBaseZ + 0.7 + dz);
    cable.rotation.z = Math.PI/2; cables.add(cable);
  }
  const grp = new THREE.Group(); grp.add(beam, pad, tray, cables); return grp;
}