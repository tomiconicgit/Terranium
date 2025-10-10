import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createDustParticles(landscape) {
    const particleCount = 10000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const landscapeGeometry = landscape.geometry;
    const landscapePosition = landscapeGeometry.attributes.position;
    const landscapeSize = 100;
    const halfSize = landscapeSize / 2;

    for (let i = 0; i < particleCount; i++) {
        const x = THREE.MathUtils.randFloat(-halfSize, halfSize);
        const z = THREE.MathUtils.randFloat(-halfSize, halfSize);
        // Approximate height by sampling nearest vertex (for procedural placement)
        const gridX = Math.floor((x + halfSize) / landscapeSize * landscapeGeometry.parameters.widthSegments);
        const gridZ = Math.floor((z + halfSize) / landscapeSize * landscapeGeometry.parameters.heightSegments);
        const index = gridZ * (landscapeGeometry.parameters.widthSegments + 1) + gridX;
        const y = landscapePosition.getZ(index) + THREE.MathUtils.randFloat(0.1, 0.5); // Slight offset for floating dust
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xd3d3d3,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5
    });
    const particles = new THREE.Points(geometry, material);
    return particles;
}