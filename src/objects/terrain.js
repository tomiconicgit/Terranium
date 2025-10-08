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
        vertices[i + 2] = -fbm(x * 5, y * 5) * 5; // Scale noise for height (inverted sign for upward elevation)
    }

    geometry.computeVertexNormals(); // For lighting if added later

    const loader = new THREE.TextureLoader();
    const colorTexture = loader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/lroc_color_poles_1k.jpg');
    colorTexture.wrapS = colorTexture.wrapT = THREE.RepeatWrapping;
    colorTexture.repeat.set(5, 5);

    const bumpTexture = loader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/ldem_3_8bit.jpg');
    bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
    bumpTexture.repeat.set(5, 5);

    const material = new THREE.MeshPhongMaterial({ 
        map: colorTexture, 
        bumpMap: bumpTexture, 
        bumpScale: 0.05, 
        side: THREE.DoubleSide 
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    return terrain;
}