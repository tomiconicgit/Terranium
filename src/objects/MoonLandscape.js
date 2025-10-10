import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

export function createMoonLandscape() {
    const geometry = new THREE.PlaneGeometry(100, 100, 128, 128);
    const position = geometry.attributes.position;
    const perlin = new PerlinNoise();
    const noiseScale = 0.05;
    const noiseAmp = 5;
    const craters = [
        { pos: new THREE.Vector2(0, 0), radius: 10, depth: 3 },
        { pos: new THREE.Vector2(20, 15), radius: 8, depth: 2.5 },
        { pos: new THREE.Vector2(-25, 10), radius: 12, depth: 4 },
        { pos: new THREE.Vector2(15, -20), radius: 7, depth: 2 },
        { pos: new THREE.Vector2(-10, 25), radius: 9, depth: 3 }
    ];
    const vec2 = new THREE.Vector2();
    for (let i = 0; i < position.count; i++) {
        vec2.set(position.getX(i), position.getY(i));
        let height = perlin.noise(vec2.x * noiseScale, vec2.y * noiseScale) * noiseAmp;
        for (const crater of craters) {
            const dist = vec2.distanceTo(crater.pos);
            if (dist < crater.radius) {
                const rel = dist / crater.radius;
                height -= crater.depth * (1 - rel * rel); // Parabolic depression
            }
        }
        position.setZ(i, height);
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: 0xd3d3d3, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}