import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createLaunchPadComplex() {
  const g = new THREE.Group();
  g.name = 'launchPad';

  // sizes
  const platformH = 0.6;
  const platformSize = 40;
  const trenchW = 10;
  const trenchL = 22;

  // simple, safe PBR materials (no shader edits)
  const conc = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.95, metalness: 0.05 });
  const darkConc = new THREE.MeshStandardMaterial({ color: 0x72777d, roughness: 1.0,  metalness: 0.0  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.55, metalness: 0.8  });

  // helper slab
  const slab = (w,l,h, x,z, mat=conc) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, h/2, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m); return m;
  };

  // platform frame around trench
  const frameW = (platformSize - trenchW) / 2;
  slab(frameW, platformSize, platformH, - (trenchW/2 + frameW/2), 0, conc);
  slab(frameW, platformSize, platformH,   (trenchW/2 + frameW/2), 0, conc);
  const capL = (platformSize - trenchL) / 2;
  slab(trenchW, capL, platformH, 0, - (trenchL/2 + capL/2), conc);
  slab(trenchW, capL, platformH, 0,   (trenchL/2 + capL/2), conc);

  // trench walls + pit
  const wallT = 0.6, wallH = 6.0;
  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, trenchL), darkConc);
  wall1.position.set(-trenchW/2 - wallT/2, -wallH/2, 0);
  const wall2 = wall1.clone(); wall2.position.x = trenchW/2 + wallT/2;

  const endH = 3.5;
  const end1 = new THREE.Mesh(new THREE.BoxGeometry(trenchW + wallT*2, endH, wallT), darkConc);
  end1.position.set(0, -endH/2, -trenchL/2 - wallT/2);
  const end2 = end1.clone(); end2.position.z = trenchL/2 + wallT/2;

  const pit = new THREE.Mesh(new THREE.BoxGeometry(trenchW, wallT, trenchL),
                             new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 1.0 }));
  pit.position.set(0, -wallH - wallT/2, 0);

  g.add(wall1, wall2, end1, end2, pit);

  // tower (lattice)
  const tower = new THREE.Group(); tower.name = 'tower';
  const towerH = 30;
  const towerX = -(platformSize/2) + 6;
  const towerZ = 6;
  const baseW = 6, baseL = 6;

  const column = (x,z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, towerH, 0.7), steel);
    m.position.set(x, towerH/2, z);
    tower.add(m);
  };
  column(towerX - baseW/2, towerZ - baseL/2);
  column(towerX + baseW/2, towerZ - baseL/2);
  column(towerX - baseW/2, towerZ + baseL/2);
  column(towerX + baseW/2, towerZ + baseL/2);

  for (let h = 3; h < towerH; h += 3) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(baseW+0.6, 0.35, baseL+0.6), steel);
    ring.position.set(towerX, h, towerZ);
    tower.add(ring);
  }

  const diag = (x1,z1,x2,z2, y1,y2) => {
    const dx = x2-x1, dz = z2-z1, dy = y2-y1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), steel);
    m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
    m.lookAt(x2, y2, z2); m.rotateX(Math.PI/2);
    tower.add(m);
  };
  for (let h = 0; h < towerH-3; h += 6) {
    diag(towerX - baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ - baseL/2, h, h+3);
    diag(towerX + baseW/2, towerZ - baseL/2, towerX - baseW/2, towerZ - baseL/2, h+3, h+6);
    diag(towerX + baseW/2, towerZ - baseL/2, towerX + baseW/2, towerZ + baseL/2, h, h+3);
    diag(towerX + baseW/2, towerZ + baseL/2, towerX + baseW/2, towerZ - baseL/2, h+3, h+6);
  }

  const arm = (h, length = trenchW/2 + 4) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, 0.6), steel);
    a.position.set(towerX + baseW/2 + length/2, h, towerZ);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.6,10), steel);
    tip.position.set(a.position.x + length/2 - 0.3, h + 0.8, towerZ);
    const g2 = new THREE.Group(); g2.add(a, tip); return g2;
  };
  tower.add(arm(8), arm(14), arm(20));
  g.add(tower);

  // perimeter rails
  g.add(makePerimeterRails(platformSize, platformH + 0.15, steel));

  // safety fence around trench
  g.add(makeTrenchFence({ trenchW, trenchL, platformH, postEvery: 1.5, height: 1.2, steel }));

  return g;
}

/* helpers */

function makePerimeterRails(size, y, mat) {
  const group = new THREE.Group();
  const rail = (x,z, len, dir='x') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dir==='x'?len:0.12, 0.25, dir==='x'?0.12:len), mat);
    m.position.set(x, y, z); group.add(m);
  };
  rail(0, -(size/2)+1.2, size-2, 'x');
  rail(0,  (size/2)-1.2, size-2, 'x');
  rail(-(size/2)+1.2, 0, size-2, 'z');
  rail( (size/2)-1.2, 0, size-2, 'z');
  return group;
}

function makeTrenchFence({ trenchW, trenchL, platformH, postEvery=1.5, height=1.2, steel }) {
  const group = new THREE.Group();
  const y = platformH + height/2;

  const postGeom = new THREE.CylinderGeometry(0.07, 0.07, height, 6);
  const posts = [];
  const inset = 0.8, hw = trenchW/2 + inset, hl = trenchL/2 + inset;

  const perims = [
    { ax:'x', z: -hl, from:-hw, to: hw },
    { ax:'x', z:  hl, from:-hw, to: hw },
    { ax:'z', x: -hw, from:-hl, to: hl },
    { ax:'z', x:  hw, from:-hl, to: hl },
  ];
  const dummy = new THREE.Object3D();
  const inst = new THREE.InstancedMesh(postGeom, steel, 1); // we'll resize later
  let idx = 0;
  for (const p of perims) {
    const length = p.to - p.from;
    const steps = Math.max(2, Math.round(Math.abs(length) / postEvery));
    idx += steps + 1;
  }
  inst.count = idx;
  let i = 0;
  for (const p of perims) {
    const length = p.to - p.from;
    const steps = Math.max(2, Math.round(Math.abs(length) / postEvery));
    for (let s=0; s<=steps; s++){
      const t = s/steps;
      const pos = p.from + t*length;
      dummy.position.set(p.ax==='x'? pos : p.x, y, p.ax==='x'? p.z : pos);
      dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix();
      inst.setMatrixAt(i++, dummy.matrix);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  const railsAt = [0.35, 0.85];
  for (const off of railsAt) {
    const railY = platformH + off;
    group.add(makeRail(-hw, -hl,  hw, -hl, railY, steel));
    group.add(makeRail( hw, -hl,  hw,  hl, railY, steel));
    group.add(makeRail( hw,  hl, -hw,  hl, railY, steel));
    group.add(makeRail(-hw,  hl, -hw, -hl, railY, steel));
  }
  return group;
}

function makeRail(x1,z1,x2,z2,y, mat) {
  const dx = x2-x1, dz = z2-z1;
  const len = Math.hypot(dx,dz);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len,8), mat);
  m.position.set((x1+x2)/2, y, (z1+z2)/2);
  m.rotation.z = Math.PI/2;
  m.rotation.y = -Math.atan2(dz, dx);
  return m;
}