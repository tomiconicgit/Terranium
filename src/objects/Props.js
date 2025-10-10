import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createProps({ areaSize = 100, avoidRadius = 12, rockCount = 150, treeCount = 120, uniformsRef } = {}) {
    const half = areaSize / 2;
    const tmp = new THREE.Object3D();

    // Rocks
    const rockGeom = new THREE.IcosahedronGeometry(0.7, 0);
    jitterGeometry(rockGeom, 0.08);
    const rockMat  = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 1.0, metalness: 0.0 });
    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);

    let i = 0;
    while (i < rockCount) {
        const x = THREE.MathUtils.randFloat(-half + 1, half - 1);
        const z = THREE.MathUtils.randFloat(-half + 1, half - 1);
        if (Math.hypot(x, z) < avoidRadius) continue;
        tmp.position.set(x, 0, z);
        tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
        tmp.scale.setScalar(THREE.MathUtils.randFloat(0.6, 1.4));
        tmp.updateMatrix();
        rocks.setMatrixAt(i, tmp.matrix);
        i++;
    }
    rocks.instanceMatrix.needsUpdate = true;

    // Trees
    const trunkG = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6); trunkG.translate(0, 0.8, 0);
    const canopy1 = new THREE.ConeGeometry(1.1, 1.2, 8); canopy1.translate(0, 1.7, 0);
    const canopy2 = new THREE.ConeGeometry(0.9, 1.1, 8); canopy2.translate(0, 2.5, 0);
    const canopy3 = new THREE.ConeGeometry(0.7, 0.9, 8); canopy3.translate(0, 3.1, 0);
    const treeGeom = mergeGeomsFallback([trunkG, canopy1, canopy2, canopy3]);

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2e, roughness: 0.95, metalness: 0.0 });

    const uniforms = { time: uniformsRef?.time ?? { value: 0 } };
    treeMat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `
            uniform float time;
        ` + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            // calm wind sway
            float sway = 0.012 + 0.012 * sin( (position.y * 0.8) + time * 1.2 );
            transformed.x += sway * position.y * 0.5;
            transformed.z += sway * position.y * 0.35;
            `
        );
    };

    const trees = new THREE.InstancedMesh(treeGeom, treeMat, treeCount);

    i = 0;
    while (i < treeCount) {
        const x = THREE.MathUtils.randFloat(-half + 2, half - 2);
        const z = THREE.MathUtils.randFloat(-half + 2, half - 2);
        if (Math.hypot(x, z) < avoidRadius + 2) continue;
        tmp.position.set(x, 0, z);
        tmp.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
        tmp.scale.setScalar(THREE.MathUtils.randFloat(0.9, 1.25));
        tmp.updateMatrix();
        trees.setMatrixAt(i, tmp.matrix);
        i++;
    }
    trees.instanceMatrix.needsUpdate = true;

    return { rocks, trees, tickers: [()=>{}] };
}

function jitterGeometry(geom, amt=0.08) {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
            i,
            pos.getX(i) + THREE.MathUtils.randFloatSpread(amt),
            pos.getY(i) + THREE.MathUtils.randFloatSpread(amt),
            pos.getZ(i) + THREE.MathUtils.randFloatSpread(amt)
        );
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
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
    g.computeBoundingSphere();
    g.computeVertexNormals();
    return g;
}