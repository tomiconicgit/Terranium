import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createProps({ areaSize = 100, avoidRadius = 12, rockCount = 150, treeCount = 120 } = {}) {
    const half = areaSize / 2;

    // --- Rocks (icosahedrons) ---
    const rockGeom = new THREE.IcosahedronGeometry(0.6, 0);
    const rockMat  = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1.0, metalness: 0.0 });
    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);

    // --- Trees (cylinder trunk + cone canopy, merged) ---
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6);
    const canopy = new THREE.ConeGeometry(0.9, 1.2, 8);
    canopy.translate(0, 1.3, 0);

    const treeGeom = THREE.BufferGeometryUtils
        ? THREE.BufferGeometryUtils.mergeGeometries([trunk, canopy], false)
        : mergeGeomsFallback([trunk, canopy]);

    const treeMat = new THREE.MeshStandardMaterial({
        vertexColors: false,
        color: 0x2e5d2e, // green-ish
        roughness: 0.95,
        metalness: 0.0
    });
    const trees = new THREE.InstancedMesh(treeGeom, treeMat, treeCount);

    const tmp = new THREE.Object3D();
    let i = 0;

    // Place rocks
    while (i < rockCount) {
        const x = THREE.MathUtils.randFloat(-half + 1, half - 1);
        const z = THREE.MathUtils.randFloat(-half + 1, half - 1);
        if (Math.hypot(x, z) < avoidRadius) continue;

        tmp.position.set(x, 0.0, z);
        tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
        const s = THREE.MathUtils.randFloat(0.5, 1.8);
        tmp.scale.setScalar(s);
        tmp.updateMatrix();
        rocks.setMatrixAt(i, tmp.matrix);
        i++;
    }
    rocks.instanceMatrix.needsUpdate = true;

    // Place trees
    i = 0;
    while (i < treeCount) {
        const x = THREE.MathUtils.randFloat(-half + 2, half - 2);
        const z = THREE.MathUtils.randFloat(-half + 2, half - 2);
        if (Math.hypot(x, z) < avoidRadius + 2) continue;

        tmp.position.set(x, 0.0, z);
        tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
        const s = THREE.MathUtils.randFloat(0.85, 1.4);
        tmp.scale.setScalar(s);
        tmp.updateMatrix();
        trees.setMatrixAt(i, tmp.matrix);
        i++;
    }
    trees.instanceMatrix.needsUpdate = true;

    return { rocks, trees };
}

// Minimal merge fallback if BufferGeometryUtils is not available via imports
function mergeGeomsFallback(geoms) {
    const g = new THREE.BufferGeometry();
    const geometries = geoms.map(geom => geom.toNonIndexed());
    let total = 0;
    geometries.forEach(gg => { total += gg.attributes.position.count; });

    const pos = new Float32Array(total * 3);
    const norm = new Float32Array(total * 3);
    let off = 0;
    for (const gg of geometries) {
        pos.set(gg.attributes.position.array, off * 3);
        if (gg.attributes.normal) norm.set(gg.attributes.normal.array, off * 3);
        off += gg.attributes.position.count;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    g.computeBoundingSphere();
    return g;
}