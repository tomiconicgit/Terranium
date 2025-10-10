import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { PerlinNoise } from '../utils/PerlinNoise.js';

export function createGroundTiles({ size = 100, segments = 100, grassRatio = 0.8, uniformsRef } = {}) {
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);

    // Very gentle undulation so it feels real but stays flat for gameplay
    const perlin = new PerlinNoise();
    const pos = geom.attributes.position;
    const amp = 0.15;       // was 0.35
    const freq = 0.03;      // lower frequency -> broader waves

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = perlin.noise(x * freq, z * freq) * amp;
        pos.setY(i, h);
    }
    geom.computeVertexNormals();

    // Base vertex colors (flat, clean)
    const baseGrass = new THREE.Color(0x74a657);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        colors[i*3] = baseGrass.r; colors[i*3+1] = baseGrass.g; colors[i*3+2] = baseGrass.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.0
    });

    // Clean AAA-like terrain tinting: slope + very low-freq blend, no grain
    const uniforms = {
        time: uniformsRef?.time ?? { value: 0 },
        grassCol: { value: new THREE.Color(0x7eaf61) },
        grassDeep:{ value: new THREE.Color(0x5f8e46) },
        sandCol:  { value: new THREE.Color(0xd9cba1) },
        sandDeep: { value: new THREE.Color(0xc5b58d) },
        mixScale: { value: 0.004 }, // large patches
        grassRatio: { value: grassRatio }
    };

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        // pass world pos
        shader.vertexShader = `
            varying vec3 vWorld;
        ` + shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vWorld = worldPosition.xyz;
            `
        );

        shader.fragmentShader = `
            varying vec3 vWorld;
            uniform vec3 grassCol, grassDeep, sandCol, sandDeep;
            uniform float mixScale;
            uniform float grassRatio;
        ` + shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>

            // flat, broad noise (hash-based)
            float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float vnoise(vec2 p){
                vec2 i=floor(p), f=fract(p);
                float a=h2(i), b=h2(i+vec2(1,0)), c=h2(i+vec2(0,1)), d=h2(i+vec2(1,1));
                vec2 u=f*f*(3.0-2.0*f);
                return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
            }

            float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
            float field = vnoise(vWorld.xz * mixScale);

            // big, calm patches: more grass on flats, sand on mild slopes
            float gMask = grassRatio * smoothstep(0.65, 0.15, slope); // invert slope favoring flats
            gMask = clamp(mix(gMask, gMask*0.8 + 0.2, field), 0.0, 1.0);

            vec3 g = mix(grassDeep, grassCol, 0.55);
            vec3 s = mix(sandDeep,  sandCol,  0.60);
            vec3 ground = mix(s, g, gMask);

            diffuseColor.rgb = mix(diffuseColor.rgb, ground, 0.95);
            `
        );
    };

    const ground = new THREE.Mesh(geom, mat);
    ground.receiveShadow = false;

    // Subtle grid (kept for tile sense)
    ground.add(makeThinGrid(size, segments, 0.06));

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