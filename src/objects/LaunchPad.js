import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createLaunchPad({ radius = 8, height = 0.2 } = {}) {
    const geom = new THREE.CylinderGeometry(radius, radius, height, 64);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x9aa1a9,     // concrete
        roughness: 0.9,
        metalness: 0.05
    });
    const pad = new THREE.Mesh(geom, mat);
    pad.rotation.x = 0;
    pad.castShadow = false;
    pad.receiveShadow = true;

    // Simple painted ring + "H" style cross lines to sell the pad look
    const ring = makeRing(radius * 0.9, radius * 1.02, 0.005, 0xffffff, 0.85);
    ring.position.y = height / 2 + 0.002;
    pad.add(ring);

    const crossA = makeStripe(radius * 1.6, 0.25);
    const crossB = makeStripe(radius * 1.6, 0.25);
    crossB.rotation.y = Math.PI / 2;
    crossA.position.y = crossB.position.y = height / 2 + 0.003;
    pad.add(crossA, crossB);

    return pad;
}

function makeRing(innerR, outerR, y, color, opacity=1.0) {
    const geom = new THREE.RingGeometry(innerR, outerR, 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geom, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    return m;
}

function makeStripe(length, width) {
    const geom = new THREE.PlaneGeometry(length, width);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geom, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
}