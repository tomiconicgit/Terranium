import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

export function createMoonLandscape() {
    const loader = new THREE.TextureLoader();
    const diffuseMap = loader.load('https://www.solarsystemscope.com/textures/download/2k_moon.jpg');
    const normalMap = loader.load('https://www.solarsystemscope.com/textures/download/2k_moon_bump.jpg');
    const displacementMap = loader.load('https://www.solarsystemscope.com/textures/download/2k_moon_bump.jpg');
    diffuseMap.repeat.set(4, 4);
    normalMap.repeat.set(4, 4);
    displacementMap.repeat.set(4, 4);
    diffuseMap.anisotropy = 16;
    normalMap.anisotropy = 16;
    displacementMap.anisotropy = 16;

    const geometry = new THREE.PlaneGeometry(100, 100, 128, 128);
    const position = geometry.attributes.position;
    const perlin = new PerlinNoise();
    const noiseScale = 0.05;
    const noiseAmp = 5;
    const octaves = 4;
    const persistence = 0.5;
    const craters = [];
    for (let i = 0; i < 10; i++) {
        craters.push({
            pos: new THREE.Vector2(THREE.MathUtils.randFloatSpread(50), THREE.MathUtils.randFloatSpread(50)),
            radius: THREE.MathUtils.randFloat(5, 15),
            depth: THREE.MathUtils.randFloat(2, 5)
        });
    }
    const vec2 = new THREE.Vector2();
    for (let i = 0; i < position.count; i++) {
        vec2.set(position.getX(i), position.getY(i));
        let height = perlin.noise(vec2.x * noiseScale, vec2.y * noiseScale, octaves, persistence) * noiseAmp;
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
    const material = new THREE.MeshStandardMaterial({
        map: diffuseMap,
        normalMap: normalMap,
        displacementMap: displacementMap,
        displacementScale: 0.5,
        color: 0xd3d3d3,
        roughness: 1,
        metalness: 0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}