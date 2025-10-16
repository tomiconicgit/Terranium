// src/scene/Terrain.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain() {
    const terrainGroup = new THREE.Group();

    // 1. Central Concrete Platform (100x100)
    const platformSize = 100;
    const platformGeo = new THREE.PlaneGeometry(platformSize, platformSize);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.rotation.x = -Math.PI / 2;
    platformMesh.receiveShadow = true;
    terrainGroup.add(platformMesh);

    // 2. Surrounding Sand Area (Extends 30 units from the 100x100 platform)
    const sandSize = platformSize + (30 * 2); 
    const sandGeo = new THREE.PlaneGeometry(sandSize, sandSize, 100, 100);
    // ▼▼▼ FIX IS HERE ▼▼▼
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 });
    // ▲▲▲ FIX IS HERE ▲▲▲
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
        
        const platformRadius = platformSize / 2;
        if (Math.abs(x) < platformRadius && Math.abs(y) < platformRadius) continue;
        
        const distToCenter = Math.sqrt(x*x + y*y);
        const elevation = (Math.random() - 0.5) * 2;
        const slopeFactor = Math.max(0, (distToCenter - platformRadius) * 0.05);
        vertices[i + 2] = elevation * slopeFactor;
    }
    sandGeo.computeVertexNormals();

    terrainGroup.add(sandMesh);
    
    return terrainGroup;
}
