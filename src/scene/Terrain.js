// src/scene/Terrain.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain() {
    const terrainGroup = new THREE.Group();

    // 1. Central Concrete Platform
    const platformGeo = new THREE.PlaneGeometry(50, 50);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.rotation.x = -Math.PI / 2;
    platformMesh.receiveShadow = true;
    terrainGroup.add(platformMesh);

    // 2. Surrounding Sand Area
    const sandSize = 250; 
    const sandGeo = new THREE.PlaneGeometry(sandSize, sandSize, 100, 100);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.receiveShadow = true;
    sandMesh.position.y = -0.01;

    // ▼▼▼ CHANGE IS HERE ▼▼▼
    // Give the sand mesh a name so we can find it for raycasting
    sandMesh.name = "sand_terrain";
    // ▲▲▲ CHANGE IS HERE ▲▲▲

    // Make the sand terrain uneven
    const vertices = sandGeo.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        
        if (Math.abs(x) < 25 && Math.abs(y) < 25) continue;
        
        const distToCenter = Math.sqrt(x*x + y*y);
        const elevation = (Math.random() - 0.5) * 2;
        const slopeFactor = Math.max(0, (distToCenter - 25) * 0.05);
        vertices[i + 2] = elevation * slopeFactor;
    }
    sandGeo.computeVertexNormals();

    terrainGroup.add(sandMesh);
    
    return terrainGroup;
}

