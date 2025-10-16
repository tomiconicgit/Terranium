// src/scene/Terrain.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain() {
    const terrainGroup = new THREE.Group();

    // 1. Central Concrete Platform (ADJUSTED: Now 100x100)
    const platformSize = 100;
    const platformGeo = new THREE.PlaneGeometry(platformSize, platformSize);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.rotation.x = -Math.PI / 2;
    platformMesh.receiveShadow = true;
    terrainGroup.add(platformMesh);

    // 2. Surrounding Sand Area (ADJUSTED: Extends 30 units from the 100x100 platform)
    // Total size will be 100 (platform) + 30 (left) + 30 (right) = 160
    const sandSize = platformSize + (30 * 2); 
    const sandGeo = new THREE.PlaneGeometry(sandSize, sandSize, 100, 100);
    const sandMat = new THREE.MeshStandardmaterial({ color: 0xc2b280, roughness: 0.8 });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.receiveShadow = true;
    sandMesh.position.y = -0.01;
    sandMesh.name = "sand_terrain";

    // Make the sand terrain uneven
    const vertices = sandGeo.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        
        // ADJUSTED: Don't modify the new, larger center part where the platform is
        const platformRadius = platformSize / 2;
        if (Math.abs(x) < platformRadius && Math.abs(y) < platformRadius) continue;
        
        const distToCenter = Math.sqrt(x*x + y*y);
        const elevation = (Math.random() - 0.5) * 2;
        // Adjust slope to start gently from the edge of the new platform size
        const slopeFactor = Math.max(0, (distToCenter - platformRadius) * 0.05);
        vertices[i + 2] = elevation * slopeFactor;
    }
    sandGeo.computeVertexNormals();

    terrainGroup.add(sandMesh);
    
    return terrainGroup;
}
