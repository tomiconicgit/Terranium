import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createProps({ areaSize = 100, avoidRadius = 20, rockCount = 160, treeCount = 140, uniformsRef } = {}) {
  const half = areaSize / 2;
  const tmp = new THREE.Object3D();

  // ---------- Better rocks ----------
  // Start from icosahedron, jitter vertices, flatten bottom, hue vary.
  const rockGeom = new THREE.IcosahedronGeometry(0.85, 1);
  jitterGeometry(rockGeom, 0.18);
  flattenBottom(rockGeom, 0.0);
  const rockMat  = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1.0, metalness: 0.05 });
  const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
  rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  let i = 0; const rockColor = new THREE.Color();
  while (i < rockCount) {
    const x = THREE.MathUtils.randFloat(-half + 2, half - 2);
    const z = THREE.MathUtils.randFloat(-half + 2, half - 2);
    if (Math.hypot(x, z) < avoidRadius) continue;
    tmp.position.set(x, 0, z);
    tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const s = THREE.MathUtils.randFloat(0.6, 1.6);
    tmp.scale.setScalar(s);
    tmp.updateMatrix();
    rocks.setMatrixAt(i, tmp.matrix);

    // subtle color variety
    const h = THREE.MathUtils.randFloat(0.0, 0.04);
    rockColor.setHSL(0.08 + h, 0.06, 0.45 + THREE.MathUtils.randFloat(-0.05, 0.05));
    rocks.setColorAt(i, rockColor);

    i++;
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;

  // ---------- Better trees (stylized pine) ----------
  // Trunk + 3 canopies; per-instance hue/scale; light wind sway in shader.
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.7, 8); trunk.translate(0, 0.85, 0);
  const c1 = new THREE.ConeGeometry(1.2, 1.3, 10); c1.translate(0, 1.9, 0);
  const c2 = new THREE.ConeGeometry(0.95, 1.15, 10); c2.translate(0, 2.7, 0);
  const c3 = new THREE.ConeGeometry(0.75, 0.95, 10); c3.translate(0, 3.35, 0);
  const treeGeom = mergeGeomsFallback([trunk, c1, c2, c3]);

  const treeMat = new THREE.MeshStandardMaterial({ color: 0x3e7a34, roughness: 0.92, metalness: 0.0 });
  const uniforms = { time: uniformsRef?.time ?? { value: 0 } };
  treeMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      uniform float time;
    ` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      // Subtle wind sway (calmer)
      float sway = 0.010 + 0.010 * sin( (position.y*0.8) + time*1.1 );
      transformed.x += sway * position.y * 0.45;
      transformed.z += sway * position.y * 0.33;
    `);
  };

  const trees = new THREE.InstancedMesh(treeGeom, treeMat, treeCount);
  trees.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  i = 0; const treeColor = new THREE.Color();
  while (i < treeCount) {
    const x = THREE.MathUtils.randFloat(-half + 3, half - 3);
    const z = THREE.MathUtils.randFloat(-half + 3, half - 3);
    if (Math.hypot(x, z) < avoidRadius + 8) continue;

    tmp.position.set(x, 0, z);
    tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const lean = THREE.MathUtils.randFloatSpread(0.02);
    tmp.rotation.x = lean; tmp.rotation.z = -lean * 0.6;

    const s = THREE.MathUtils.randFloat(0.95, 1.35);
    tmp.scale.setScalar(s);

    tmp.updateMatrix();
    trees.setMatrixAt(i, tmp.matrix);

    // Green hue/luminance subtly varied
    treeColor.setHSL(0.31 + THREE.MathUtils.randFloat(-0.02, 0.03), 0.58, 0.35 + THREE.MathUtils.randFloat(-0.03, 0.05));
    trees.setColorAt(i, treeColor);

    i++;
  }
  trees.instanceMatrix.needsUpdate = true;
  if (trees.instanceColor) trees.instanceColor.needsUpdate = true;

  return { rocks, trees, tickers: [()=>{}] };
}

function jitterGeometry(geom, amt=0.15) {
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i,
      p.getX(i) + THREE.MathUtils.randFloatSpread(amt),
      p.getY(i) + THREE.MathUtils.randFloatSpread(amt*0.6),
      p.getZ(i) + THREE.MathUtils.randFloatSpread(amt)
    );
  }
  p.needsUpdate = true;
  geom.computeVertexNormals();
}

function flattenBottom(geom, y=0.0) {
  const p = geom.attributes.position;
  for (let i=0;i<p.count;i++) if (p.getY(i) < y) p.setY(i, y + (p.getY(i)-y)*0.15);
  p.needsUpdate = true; geom.computeVertexNormals();
}

// minimal merge
function mergeGeomsFallback(geoms) {
  const g = new THREE.BufferGeometry();
  const parts = geoms.map(geom => geom.toNonIndexed());
  const total = parts.reduce((a, gg) => a + gg.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  let off = 0;
  for (const gg of parts) {
    pos.set(gg.attributes.position.array, off * 3);
    if (gg.attributes.normal) norm.set(gg.attributes.normal.array, off * 3);
    off += gg.attributes.position.count;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.BufferAttribute(norm, 3));
  g.computeBoundingSphere(); g.computeVertexNormals();
  return g;
}