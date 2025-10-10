import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Starship-like pad + tower inspired by your reference:
 * - Circular launch mount (donut platform) above a deep pit
 * - Square hardstand around it
 * - Tall lattice tower with floors & interior stairs
 * - Lower mechanical arms with cable trays
 * - Upper crew-access tunnel/gantry to vehicle
 * - Safety fence around pit
 *
 * All geometry uses safe MeshStandardMaterial (no onBeforeCompile).
 */
export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  /* ---------------- sizes (tweakable) ---------------- */
  const hardstandSize = 46;     // square concrete pad around mount
  const hardstandH    = 0.55;

  const mountOuterR   = 8.5;    // circular mount outer radius
  const mountInnerR   = 4.5;    // hole in the middle above pit
  const mountH        = 3.2;    // tall “ring” the rocket sits on
  const pitDepth      = 8.5;
  const pitClearW     = 12;     // rectangular trench under the ring
  const pitClearL     = 26;

  const towerBaseX    = -hardstandSize/2 + 7;  // tower sits to the side
  const towerBaseZ    = 4;
  const towerW        = 7.5;     // tower footprint
  const towerL        = 7.5;
  const towerH        = 42;      // tall tower

  const lowerArmH     = 12.0;    // “catch/lift” arm height
  const lowerArmReach = mountOuterR + 3.0;
  const upperArmH     = 28.0;    // crew tunnel height
  const crewReach     = mountOuterR + 5.0;

  /* ---------------- materials ---------------- */
  const conc  = new THREE.MeshStandardMaterial({ color: 0xa2a7ad, roughness: 0.95, metalness: 0.04 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x6f757b, roughness: 1.0,  metalness: 0.0  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.55, metalness: 0.85 });
  const blk   = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.9,  metalness: 0.2  });
  const safety= new THREE.MeshStandardMaterial({ color: 0xdadada, roughness: 0.8,  metalness: 0.6  });

  /* ---------------- hardstand (split to frame pit) ---------------- */
  const frame = new THREE.Group(); g.add(frame);
  const frameT = (hardstandSize - pitClearW) / 2;
  const frameS = (w,l,x,z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hardstandH, l), conc);
    m.position.set(x, hardstandH/2, z); frame.add(m);
  };
  // left/right
  frameS(frameT, hardstandSize, - (pitClearW/2 + frameT/2), 0);
  frameS(frameT, hardstandSize,   (pitClearW/2 + frameT/2), 0);
  // top/bottom
  const capL = (hardstandSize - pitClearL) / 2;
  frameS(pitClearW, capL, 0,  (pitClearL/2 + capL/2));
  frameS(pitClearW, capL, 0, -(pitClearL/2 + capL/2));

  /* ---------------- circular launch mount (donut) ---------------- */
  // outer ring
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(mountOuterR, mountOuterR, mountH, 64), conc);
  outer.position.y = hardstandH + mountH/2;
  // inner hole rim (visual separation)
  const innerRim = new THREE.Mesh(new THREE.CylinderGeometry(mountInnerR, mountInnerR, mountH*0.98, 48), dark);
  innerRim.position.y = outer.position.y + 0.01;

  // top ring detailing (grating segments)
  const grate = new THREE.Group();
  const segCount = 16, segW = (Math.PI * 2 * (mountOuterR + mountInnerR)/2) / segCount * 0.9;
  for (let i=0;i<segCount;i++){
    const t = (i/segCount) * Math.PI*2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.18, (mountOuterR - mountInnerR) * 0.85), blk);
    // place radially
    const rMid = (mountOuterR + mountInnerR)/2;
    seg.position.set(Math.cos(t) * rMid, hardstandH + mountH + 0.09, Math.sin(t) * rMid);
    seg.rotation.y = -t;
    grate.add(seg);
  }

  // support columns below ring (4)
  const colG = new THREE.CylinderGeometry(0.8, 0.9, mountH + 1.5, 10);
  const cols = new THREE.Group();
  for (let i=0;i<4;i++){
    const a = i * Math.PI/2 + Math.PI/4;
    const x = Math.cos(a) * (mountInnerR + 1.3);
    const z = Math.sin(a) * (mountInnerR + 1.3);
    const c = new THREE.Mesh(colG, dark);
    c.position.set(x, hardstandH + (mountH/2) - 0.75, z);
    cols.add(c);
  }

  g.add(outer, innerRim, grate, cols);

  /* ---------------- deep pit + trench walls ---------------- */
  const pit = new THREE.Mesh(new THREE.BoxGeometry(pitClearW-0.6, 0.6, pitClearL-0.6), blk);
  pit.position.set(0, -pitDepth - 0.3, 0);
  const wallT = 0.6, wallH = pitDepth;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, pitClearL), dark);
  const w2 = w1.clone();
  w1.position.set(-pitClearW/2 - wallT/2, -wallH/2, 0);
  w2.position.set( pitClearW/2 + wallT/2, -wallH/2, 0);
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(pitClearW + wallT*2, wallT, wallT), dark);
  const e2 = e1.clone();
  e1.position.set(0, -wallH, -pitClearL/2 - wallT/2);
  e2.position.set(0, -wallH,  pitClearL/2 + wallT/2);

  g.add(pit, w1, w2, e1, e2);

  /* ---------------- safety fence around pit ---------------- */
  g.add(makeTrenchFence({ trenchW: pitClearW, trenchL: pitClearL, platformH: hardstandH, postEvery: 1.6, height: 1.25, mat: safety }));

  /* ---------------- tower (lattice + floors + stairs) ---------------- */
  const tower = new THREE.Group(); tower.name = 'tower';
  // 4 main columns
  const cBox = new THREE.BoxGeometry(0.8, towerH, 0.8);
  const corners = [
    [towerBaseX - towerW/2, towerBaseZ - towerL/2],
    [towerBaseX + towerW/2, towerBaseZ - towerL/2],
    [towerBaseX - towerW/2, towerBaseZ + towerL/2],
    [towerBaseX + towerW/2, towerBaseZ + towerL/2],
  ];
  for (const [x,z] of corners) {
    const m = new THREE.Mesh(cBox, steel);
    m.position.set(x, towerH/2, z);
    tower.add(m);
  }

  // floor rings every 3m
  for (let h=3; h<towerH; h+=3){
    const ring = new THREE.Mesh(new THREE.BoxGeometry(towerW+0.8, 0.35, towerL+0.8), steel);
    ring.position.set(towerBaseX, h, towerBaseZ);
    tower.add(ring);
  }

  // diagonals on two faces
  for (let h=0; h<towerH-3; h+=6){
    tower.add(diag(
      towerBaseX - towerW/2, towerBaseZ - towerL/2,
      towerBaseX + towerW/2, towerBaseZ - towerL/2, h, h+3, steel
    ));
    tower.add(diag(
      towerBaseX + towerW/2, towerBaseZ - towerL/2,
      towerBaseX - towerW/2, towerBaseZ - towerL/2, h+3, h+6, steel
    ));
    tower.add(diag(
      towerBaseX + towerW/2, towerBaseZ - towerL/2,
      towerBaseX + towerW/2, towerBaseZ + towerL/2, h, h+3, steel
    ));
    tower.add(diag(
      towerBaseX + towerW/2, towerBaseZ + towerL/2,
      towerBaseX + towerW/2, towerBaseZ - towerL/2, h+3, h+6, steel
    ));
  }

  // interior stairs (zig-zag flights) + landings
  tower.add(makeStairCore({
    baseX: towerBaseX, baseZ: towerBaseZ,
    width: 1.2, run: 2.2, rise: 3.0, // per flight
    floors: Math.floor(towerH/3)-1,  // one flight per 3m
    steel
  }));

  g.add(tower);

  /* ---------------- mechanical lower arms w/ cable trays ---------------- */
  const arms = new THREE.Group();
  // left & right symmetrical arms (two beams that can “pinch”)
  const armBeam = (side=1) => {
    const len = lowerArmReach;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.8), steel);
    beam.position.set(towerBaseX + side*(towerW/2) + len/2, lowerArmH, towerBaseZ);
    // small claw pad at tip
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), blk);
    pad.position.set(beam.position.x + len/2 - 0.4, lowerArmH, towerBaseZ);
    // cable tray on top (thin box + cylinders as bundles)
    const tray = new THREE.Mesh(new THREE.BoxGeometry(len*0.9, 0.12, 0.4), blk);
    tray.position.set(beam.position.x, lowerArmH + 0.4, towerBaseZ + 0.7);
    const cables = makeCableBundle(beam.position.x - len*0.45, towerBaseZ + 0.7, beam.position.x + len*0.45, towerBaseZ + 0.7, lowerArmH + 0.45, 4);
    const g2 = new THREE.Group();
    g2.add(beam, pad, tray, cables);
    return g2;
  };
  arms.add(armBeam(+1), armBeam(-1));
  g.add(arms);

  /* ---------------- upper crew-access tunnel (gantry) ---------------- */
  const crew = new THREE.Group();
  const spineL = crewReach;
  const spine  = new THREE.Mesh(new THREE.BoxGeometry(spineL, 1.1, 1.1), steel);
  spine.position.set(towerBaseX + towerW/2 + spineL/2, upperArmH, towerBaseZ + 1.1);
  // tunnel box near vehicle
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 2.0), steel);
  tunnel.position.set(spine.position.x + spineL/2 - 1.1, upperArmH, towerBaseZ + 1.1);
  // handrails along spine
  crew.add(spine, tunnel, makeHandrail(spine, +0.7), makeHandrail(spine, -0.7));
  g.add(crew);

  return g;
}

/* ---------------- helpers ---------------- */

function diag(x1,z1,x2,z2, y1,y2, mat) {
  const dx = x2-x1, dz = z2-z1, dy = y2-y1;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), mat);
  m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
  m.lookAt(x2, y2, z2); m.rotateX(Math.PI/2);
  return m;
}

function makeHandrail(spine, offsetZ){
  const len = spine.geometry.parameters.width; // x length of box
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len*0.95,8), new THREE.MeshStandardMaterial({ color: 0xdadada, roughness:0.7, metalness:0.6 }));
  rail.position.set(spine.position.x, spine.position.y + 0.7, spine.position.z + offsetZ);
  rail.rotation.z = Math.PI/2;
  return rail;
}

function makeCableBundle(x1,z1,x2,z2,y, count=3){
  const g = new THREE.Group();
  for (let i=0;i<count;i++){
    const dz = (i - (count-1)/2) * 0.08;
    const len = Math.hypot(x2-x1, z2-(z1+dz));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,len,8), new THREE.MeshStandardMaterial({ color: 0x222, roughness: 1.0 }));
    c.position.set((x1+x2)/2, y, (z1+dz + z2)/2);
    c.rotation.z = Math.PI/2;
    c.rotation.y = -Math.atan2((z2-(z1+dz)), (x2-x1));
    g.add(c);
  }
  return g;
}

function makeTrenchFence({ trenchW, trenchL, platformH, postEvery=1.6, height=1.25, mat }){
  const group = new THREE.Group();
  const y = platformH + height/2;
  const postGeom = new THREE.CylinderGeometry(0.07, 0.07, height, 8);
  const dummy = new THREE.Object3D();
  const inset = 1.0, hw = trenchW/2 + inset, hl = trenchL/2 + inset;

  // count posts
  let count=0;
  const perims = [
    { ax:'x', z: -hl, from:-hw, to: hw },
    { ax:'x', z:  hl, from:-hw, to: hw },
    { ax:'z', x: -hw, from:-hl, to: hl },
    { ax:'z', x:  hw, from:-hl, to: hl },
  ];
  for (const p of perims){ count += Math.max(2, Math.round(Math.abs(p.to-p.from)/postEvery)) + 1; }

  const posts = new THREE.InstancedMesh(postGeom, mat, count);
  let idx=0;
  for (const p of perims){
    const length = p.to - p.from;
    const steps = Math.max(2, Math.round(Math.abs(length)/postEvery));
    for (let s=0;s<=steps;s++){
      const t = s/steps, v = p.from + t*length;
      dummy.position.set(p.ax==='x'? v : p.x, y, p.ax==='x'? p.z : v);
      dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix();
      posts.setMatrixAt(idx++, dummy.matrix);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  const railsAt = [0.35, 0.85];
  for (const off of railsAt) {
    const ry = platformH + off;
    group.add(rail(-hw, -hl,  hw, -hl,  ry, mat));
    group.add(rail( hw, -hl,  hw,  hl,  ry, mat));
    group.add(rail( hw,  hl, -hw,  hl,  ry, mat));
    group.add(rail(-hw,  hl, -hw, -hl,  ry, mat));
  }
  return group;
}

function rail(x1,z1,x2,z2,y, mat){
  const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len,8), mat);
  m.position.set((x1+x2)/2, y, (z1+z2)/2);
  m.rotation.z = Math.PI/2; m.rotation.y = -Math.atan2(dz,dx);
  return m;
}

function makeStairCore({ baseX, baseZ, width=1.2, run=2.2, rise=3.0, floors=10, steel }){
  // Zig-zag interior flights facing front (negative Z), alternating directions
  const group = new THREE.Group();
  const stepH = 0.2, stepD = run/10, stepsPerFlight = Math.round(rise/stepH);
  const stepGeo = new THREE.BoxGeometry(width, stepH, stepD);
  const landingGeo = new THREE.BoxGeometry(width+0.3, 0.18, 1.1);
  const mat = steel;

  let curY = 1.0;
  let dir = +1; // +x or -x
  for (let f=0; f<floors; f++){
    const flight = new THREE.Group();
    for (let s=0; s<stepsPerFlight; s++){
      const step = new THREE.Mesh(stepGeo, mat);
      step.position.set(baseX + dir*(width/2 + (s/stepsPerFlight)*run), curY + stepH*(s+0.5), baseZ - 1.8);
      flight.add(step);
    }
    // landing
    const land = new THREE.Mesh(landingGeo, mat);
    land.position.set(baseX + dir*(width/2 + run + 0.4), curY + rise + 0.09, baseZ - 1.8);
    flight.add(land);
    group.add(flight);

    // next
    curY += rise + 0.3;
    dir *= -1;
  }
  return group;
}