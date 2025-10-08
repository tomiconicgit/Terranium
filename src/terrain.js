import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function createTerrain() {
    const loader = new THREE.TextureLoader();
    const exrLoader = new EXRLoader();

    // Load texture sets
    const moondusted = {
        diffuse: loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg'),
        displacement: loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png'),
        normal: exrLoader.load('src/assets/textures/moon/moondusted/moondusted-normal.exr'),
        roughness: exrLoader.load('src/assets/textures/moon/moondusted/moondusted-roughness.exr'),
    };
    const moonflatmacro = {
        diffuse: loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg'),
        displacement: loader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-displacement.png'),
        normal: exrLoader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-normal.exr'),
        roughness: exrLoader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-roughness.exr'),
    };
    const moonnormal = {
        diffuse: loader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg'),
        displacement: loader.load('src/assets/textures/moon/moonnormal/moonnormal-displacement.png'),
        normal: exrLoader.load('src/assets/textures/moon/moonnormal/moonnormal-normal.exr'),
        roughness: exrLoader.load('src/assets/textures/moon/moonnormal/moonnormal-roughness.exr'),
    };

    // Repeat textures if needed
    [moondusted, moonflatmacro, moonnormal].forEach(set => {
        Object.values(set).forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(10, 10); // Adjust for tiling
        });
    });

    // Perlin noise in JS for height generation
    const perlin = {
        gradients: {},
        rand_vect() {
            const theta = Math.random() * 2 * Math.PI;
            return { x: Math.cos(theta), y: Math.sin(theta) };
        },
        dot_prod_grid(x, y, vx, vy) {
            let g_vect;
            const d_vect = { x: x - vx, y: y - vy };
            const key = [vx, vy];
            if (this.gradients[key]) {
                g_vect = this.gradients[key];
            } else {
                g_vect = this.rand_vect();
                this.gradients[key] = g_vect;
            }
            return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
        },
        smootherstep(x) {
            return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
        },
        interp(x, a, b) {
            return a + this.smootherstep(x) * (b - a);
        },
        get(x, y) {
            const xf = Math.floor(x);
            const yf = Math.floor(y);
            const tl = this.dot_prod_grid(x, y, xf, yf);
            const tr = this.dot_prod_grid(x, y, xf + 1, yf);
            const bl = this.dot_prod_grid(x, y, xf, yf + 1);
            const br = this.dot_prod_grid(x, y, xf + 1, yf + 1);
            const xt = this.interp(x - xf, tl, tr);
            const xb = this.interp(x - xf, bl, br);
            return this.interp(y - yf, xt, xb);
        }
    };

    // Procedural height with octaves for flat/high areas
    function getHeight(x, z) {
        let total = 0;
        let frequency = 0.05;
        let amplitude = 5;
        let max = 0;
        for (let i = 0; i < 4; i++) {
            total += (perlin.get(x * frequency, z * frequency) + 1) / 2 * amplitude;
            max += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        total /= max;
        return Math.pow(total, 1.5) * 10; // Exaggerate for more flat areas with highs
    }

    // Geometry
    const size = 100;
    const segments = 256;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Apply heights
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const height = getHeight(x, z);
        positions.setY(i, height);
    }
    geometry.computeVertexNormals();

    // GLSL noise for blending
    const noiseGLSL = `
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.57735026919, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ; m = m*m ;
            vec3 x = 2.0 * fract(p * C.wwww) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
    `;

    // Material with blended PBR
    const material = new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        displacementScale: 0.1,
        displacementBias: 0,
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.diffuse1 = { value: moondusted.diffuse };
        shader.uniforms.diffuse2 = { value: moonflatmacro.diffuse };
        shader.uniforms.diffuse3 = { value: moonnormal.diffuse };
        shader.uniforms.displacement1 = { value: moondusted.displacement };
        shader.uniforms.displacement2 = { value: moonflatmacro.displacement };
        shader.uniforms.displacement3 = { value: moonnormal.displacement };
        shader.uniforms.normal1 = { value: moondusted.normal };
        shader.uniforms.normal2 = { value: moonflatmacro.normal };
        shader.uniforms.normal3 = { value: moonnormal.normal };
        shader.uniforms.roughness1 = { value: moondusted.roughness };
        shader.uniforms.roughness2 = { value: moonflatmacro.roughness };
        shader.uniforms.roughness3 = { value: moonnormal.roughness };

        // Add noise to vertex and fragment
        shader.vertexShader = noiseGLSL + shader.vertexShader;
        shader.fragmentShader = noiseGLSL + shader.fragmentShader;

        // Custom displacement
        shader.vertexShader = shader.vertexShader.replace(
            '#include <displacementmap_vertex>',
            `
            #ifdef USE_DISPLACEMENTMAP
                float factor1 = snoise(position.xz * 0.05) * 0.5 + 0.5;
                float factor2 = snoise(position.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5;
                factor2 *= (1.0 - factor1);
                float factor3 = 1.0 - factor1 - factor2;
                float disp = texture2D(displacement1, vDisplacementMapUv).r * factor1 +
                             texture2D(displacement2, vDisplacementMapUv).r * factor2 +
                             texture2D(displacement3, vDisplacementMapUv).r * factor3;
                transformed += normal * disp * displacementScale + displacementBias;
            #endif
            `
        );

        // Custom map (diffuse)
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #ifdef USE_MAP
                float factor1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
                float factor2 = snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5;
                factor2 *= (1.0 - factor1);
                float factor3 = 1.0 - factor1 - factor2;
                vec4 texelColor = texture2D(diffuse1, vMapUv) * factor1 +
                                  texture2D(diffuse2, vMapUv) * factor2 +
                                  texture2D(diffuse3, vMapUv) * factor3;
                texelColor = mapTexelToLinear( texelColor );
                diffuseColor *= texelColor;
            #endif
            `
        );

        // Custom normal
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normalmap_fragment>',
            `
            #ifdef USE_NORMALMAP
                float factor1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
                float factor2 = snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5;
                factor2 *= (1.0 - factor1);
                float factor3 = 1.0 - factor1 - factor2;
                vec3 normalTex = texture2D(normal1, vNormalMapUv).xyz * factor1 +
                                 texture2D(normal2, vNormalMapUv).xyz * factor2 +
                                 texture2D(normal3, vNormalMapUv).xyz * factor3;
                normalTex = normalTex * 2.0 - 1.0;
                #ifdef USE_TANGENT
                    normal = normalize( vTBN * normalTex );
                #else
                    normal = perturbNormal2Arb( - vViewPosition, normal, normalTex, faceDirection );
                #endif
            #endif
            `
        );

        // Custom roughness
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <roughnessmap_fragment>',
            `
            float roughnessFactor = roughness;
            #ifdef USE_ROUGHNESSMAP
                float factor1 = snoise(vPosition.xz * 0.05) * 0.5 + 0.5;
                float factor2 = snoise(vPosition.xz * 0.1 + vec2(10.0)) * 0.5 + 0.5;
                factor2 *= (1.0 - factor1);
                float factor3 = 1.0 - factor1 - factor2;
                vec4 texelRoughness = texture2D(roughness1, vRoughnessMapUv) * factor1 +
                                      texture2D(roughness2, vRoughnessMapUv) * factor2 +
                                      texture2D(roughness3, vRoughnessMapUv) * factor3;
                // assumes roughness in .x or .y, but exr may vary; assume .x
                roughnessFactor *= saturate( texelRoughness.x );
            #endif
            `
        );
    };

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}