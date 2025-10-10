import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

export function createMoonLandscape() {
    const geometry = new THREE.PlaneGeometry(100, 100, 128, 128);
    const position = geometry.attributes.position;
    const perlin = new PerlinNoise();
    const noiseScale = 0.05;
    const noiseAmp = 5;

    // --- Define flat area for settlement ---
    const flatAreaCenter = new THREE.Vector2(0, 0);
    const flatAreaSize = 15; // This creates a 30x30 area (15 units from center)
    const transitionWidth = 10; // The blend zone around the flat area

    const craters = [
        // Craters are now positioned further away from the center
        { pos: new THREE.Vector2(35, 20), radius: 10, depth: 3 },
        { pos: new THREE.Vector2(-28, 15), radius: 8, depth: 2.5 },
        { pos: new THREE.Vector2(-40, -10), radius: 12, depth: 4 },
        { pos: new THREE.Vector2(25, -30), radius: 7, depth: 2 },
        { pos: new THREE.Vector2(-10, 45), radius: 9, depth: 3 }
    ];

    const vec2 = new THREE.Vector2();
    for (let i = 0; i < position.count; i++) {
        vec2.set(position.getX(i), position.getY(i));
        
        let height = perlin.noise(vec2.x * noiseScale, vec2.y * noiseScale) * noiseAmp;

        // Apply craters
        for (const crater of craters) {
            const dist = vec2.distanceTo(crater.pos);
            if (dist < crater.radius) {
                const rel = dist / crater.radius;
                height -= crater.depth * (1 - rel * rel);
            }
        }
        
        // --- Blend to flat area ---
        const distToCenter = Math.max(Math.abs(vec2.x - flatAreaCenter.x), Math.abs(vec2.y - flatAreaCenter.y));
        const flatHeight = -1.0; // Target height for the flat area

        if (distToCenter < flatAreaSize + transitionWidth) {
            // smoothstep creates a nice blend from the outer edge to the inner edge
            const blendFactor = THREE.MathUtils.smoothstep(distToCenter, flatAreaSize + transitionWidth, flatAreaSize);
            // lerp interpolates between the noisy height and the flat height
            height = THREE.MathUtils.lerp(height, flatHeight, blendFactor);
        }

        position.setZ(i, height);
    }
    
    geometry.computeVertexNormals();
    geometry.computeTangents(); // Required for normal maps

    // --- Realistic Texturing ---
    const textureLoader = new THREE.TextureLoader();
    const texturePath = 'https://threejs.org/examples/textures/terrain/';
    
    // Load Color, Normal, and Roughness maps
    const colorMap = textureLoader.load(texturePath + 'rock_diffuse.jpg');
    const normalMap = textureLoader.load(texturePath + 'rock_normal.jpg');
    const roughnessMap = textureLoader.load(texturePath + 'rock_roughness.jpg');

    // Set textures to repeat
    const textureRepeat = 24;
    for (const map of [colorMap, normalMap, roughnessMap]) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(textureRepeat, textureRepeat);
    }

    // Use sRGBEncoding for the color map for better color accuracy
    colorMap.encoding = THREE.sRGBEncoding;

    const material = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap: normalMap,
        roughnessMap: roughnessMap,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}
