import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain() {
    const terrainGroup = new THREE.Group();

    // 1. Central Concrete Platform (50x50)
    const platformGeo = new THREE.PlaneGeometry(50, 50);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.rotation.x = -Math.PI / 2; // Lay it flat
    platformMesh.receiveShadow = true; // It should receive shadows
    terrainGroup.add(platformMesh);

    // 2. Surrounding Sand Area (100x100 extension)
    // Total size will be 50 + 100 + 100 = 250x250
    const sandSize = 250; 
    const sandGeo = new THREE.PlaneGeometry(sandSize, sandSize, 100, 100);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.receiveShadow = true;

    // Make the sand terrain uneven
    const vertices = sandGeo.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        
        // Don't modify the center part where the platform is
        if (Math.abs(x) < 25 && Math.abs(y) < 25) continue;
        
        // Add random vertical displacement (z-axis in a flat plane)
        const distToCenter = Math.sqrt(x*x + y*y);
        const elevation = (Math.random() - 0.5) * 2; // -1 to 1
        const slopeFactor = Math.max(0, (distToCenter - 25) * 0.05); // Gently slope up away from platform
        vertices[i + 2] = elevation * slopeFactor;
    }
    sandGeo.computeVertexNormals(); // Recalculate normals for correct lighting

    terrainGroup.add(sandMesh);
    
    return terrainGroup;
}
