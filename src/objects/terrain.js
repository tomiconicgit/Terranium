// src/objects/terrain.js: Creates lunar surface

import { fbm } from '../utils/perlin.js';

export function createTerrain() {
    const width = 100;
    const height = 100;
    const segments = 128; // Higher for detail, but watch mobile perf

    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const vertices = geometry.attributes.position.array;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i] / width + 0.5; // Normalize to 0-1
        const y = vertices[i + 1] / height + 0.5;
        vertices[i + 2] = fbm(x * 5, y * 5) * 5; // Scale noise for height
    }

    geometry.computeVertexNormals(); // For lighting if added later

    const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    return terrain;
}