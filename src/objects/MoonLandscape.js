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
    const flatAreaSize = 15;
    const transitionWidth = 10;

    const craters = [
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

        for (const crater of craters) {
            const dist = vec2.distanceTo(crater.pos);
            if (dist < crater.radius) {
                const rel = dist / crater.radius;
                height -= crater.depth * (1 - rel * rel);
            }
        }
        
        const distToCenter = Math.max(Math.abs(vec2.x - flatAreaCenter.x), Math.abs(vec2.y - flatAreaCenter.y));
        const flatHeight = -1.0;

        if (distToCenter < flatAreaSize + transitionWidth) {
            const blendFactor = THREE.MathUtils.smoothstep(distToCenter, flatAreaSize + transitionWidth, flatAreaSize);
            height = THREE.MathUtils.lerp(height, flatHeight, blendFactor);
        }

        position.setZ(i, height);
    }
    
    geometry.computeVertexNormals();

    // --- Procedural Gradient Material ---
    const material = new THREE.MeshStandardMaterial({
        roughness: 0.9,
        metalness: 0.1,
    });

    // This powerful function lets us inject custom code into Three.js's own shaders
    material.onBeforeCompile = (shader) => {
        // Pass the world position of each vertex to the fragment shader
        shader.vertexShader = 'varying vec3 vWorldPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\n\tvWorldPosition = worldPosition.xyz;'
        );
        
        // In the fragment shader, we'll use that world position to create the gradient
        shader.fragmentShader = 'varying vec3 vWorldPosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>

            // Define the colours for our gradient
            vec3 craterColor = vec3(0.3, 0.3, 0.32);
            vec3 peakColor = vec3(0.7, 0.7, 0.72);
            
            // Define the height range for the gradient
            float minHeight = -4.0;
            float maxHeight = 4.0;
            
            // Calculate a blend factor (0.0 to 1.0) based on the world height
            float blendFactor = smoothstep(minHeight, maxHeight, vWorldPosition.y);
            
            // Mix the two colours based on the height
            vec3 finalColor = mix(craterColor, peakColor, blendFactor);
            
            // Apply the final procedural color
            diffuseColor.rgb = finalColor;
            `
        );
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}
