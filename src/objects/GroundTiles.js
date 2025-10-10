import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

/**
 * 100x100 ground, gentle real geometry undulation (so raycast matches),
 * slope-aware grass↔sand blend, subtle wind shimmer via time uniform.
 */
export function createGroundTiles({ size = 100, segments = 100, grassRatio = 0.7, uniformsRef } = {}) {
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);

    // Real undulation so collisions align
    const perlin = new PerlinNoise();
    const pos = geom.attributes.position;
    const nrm = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    const amp = 0.35;         // height amplitude (meters)
    const freq = 0.05;        // how frequent bumps are

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = perlin.noise(x * freq, z * freq) * amp;
        pos.setY(i, h);
    }
    geom.computeVertexNormals();

    // Vertex colors base (will be modulated by shader)
    const colors = [];
    const c = new THREE.Color(0x88a76a); // base grass
    for (let i = 0; i < pos.count; i++) {
        colors.push(c.r, c.g, c.b);
    }
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0
    });

    // Shader touch: slope & noise blend, subtle wind/shimmer
    const uniforms = {
        time: uniformsRef?.time ?? { value: 0 },
        grassDark:   { value: new THREE.Color(0x3e6b2b) },
        grassLight:  { value: new THREE.Color(0x8fbf6a) },
        sandDark:    { value: new THREE.Color(0x9f8a58) },
        sandLight:   { value: new THREE.Color(0xe6d6a1) },
        grassRatio:  { value: grassRatio }
    };

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        // cheap 2D value noise
        shader.fragmentShader = `
            uniform float time;
            uniform vec3 grassDark, grassLight, sandDark, sandLight;
            uniform float grassRatio;
            ${shader.fragmentShader}
        `.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        // world normal & position approximation
        vec3 N = normalize( vNormal );
        // slope: 0 = flat up, 1 = vertical
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);

        // pseudo noise from world pos
        vec2 wp = vViewPosition.xz * 0.02;
        float n = fract(sin(dot(wp, vec2(12.9898,78.233))) * 43758.5453);
        n = mix(n, fract(sin(dot(wp + time*0.05, vec2(34.7, 12.3))) * 24634.312), 0.5);

        // base blend grass vs sand by slope & noise threshold
        float grassMask = smoothstep(0.2, 0.7, 1.0 - slope) * grassRatio;
        grassMask = clamp(grassMask + (n - 0.5) * 0.2, 0.0, 1.0);

        vec3 grassCol = mix(grassDark, grassLight, n);
        vec3 sandCol  = mix(sandDark,  sandLight,  n * 0.6 + 0.2);
        vec3 ground   = mix(sandCol, grassCol, grassMask);

        // subtle wind shimmer (luminance wiggle)
        float shimmer = (sin((vViewPosition.x + vViewPosition.z) * 0.1 + time * 1.4) * 0.015);
        ground += shimmer;

        diffuseColor.rgb = mix(diffuseColor.rgb, ground, 0.95);
        `
        );
    };

    const ground = new THREE.Mesh(geom, mat);
    ground.receiveShadow = false;

    // Softer, subtler grid overlay
    ground.add(makeThinGrid(size, segments, 0.09));

    return ground;
}

function makeThinGrid(size, segments, opacity) {
    const step = size / segments;
    const half = size / 2;
    const verts = [];

    for (let i = 0; i <= segments; i++) {
        const x = -half + i * step;
        verts.push(x, 0.003, -half,  x, 0.003, half);
    }
    for (let j = 0; j <= segments; j++) {
        const z = -half + j * step;
        verts.push(-half, 0.003, z,   half, 0.003, z);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity });
    return new THREE.LineSegments(geom, mat);
}