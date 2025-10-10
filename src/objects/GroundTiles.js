import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Creates a flat 100x100 area composed of a single plane mesh for physics,
 * with per-vertex color to approximate grass/sand "tiles" and a grid overlay.
 */
export function createGroundTiles({ size = 100, segments = 100, grassRatio = 0.65 } = {}) {
    // Base plane for collisions and shading
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);

    // Vertex colors: pseudo tiles by sampling per face region
    const colors = [];
    const color = new THREE.Color();

    // Make a deterministic pattern: more grass, some sandy patches
    const half = size / 2;
    const tileSize = size / segments;

    // Helper to pick grass/sand based on tile cell with some noise
    const rand2 = (ix, iz) => {
        // quick hash
        let s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
        return s - Math.floor(s);
    };

    // Assign color per vertex based on cell
    for (let i = 0; i < geom.attributes.position.count; i++) {
        const vx = geom.attributes.position.getX(i);
        const vz = geom.attributes.position.getZ(i);

        const cx = Math.floor((vx + half) / tileSize);
        const cz = Math.floor((vz + half) / tileSize);

        const r = rand2(cx, cz);
        const isGrass = r < grassRatio;

        // Slight variation within each material
        if (isGrass) {
            // grass green variations
            color.setHSL(0.32 + (r * 0.03), 0.6, 0.42 + (r * 0.05));
        } else {
            // sand yellow variations
            color.setHSL(0.13 + (r * 0.02), 0.5, 0.60 + (r * 0.05));
        }

        colors.push(color.r, color.g, color.b);
    }
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0
    });

    const ground = new THREE.Mesh(geom, mat);
    ground.receiveShadow = false;
    ground.castShadow = false;

    // Optional thin grid lines every 1 unit to emphasize "tiles"
    const grid = makeThinGrid(size, segments);
    ground.add(grid);

    return ground;
}

function makeThinGrid(size, segments) {
    const step = size / segments;
    const half = size / 2;

    const verts = [];
    // vertical lines (along Z)
    for (let i = 0; i <= segments; i++) {
        const x = -half + i * step;
        verts.push(x, 0.002, -half,  x, 0.002, half);
    }
    // horizontal lines (along X)
    for (let j = 0; j <= segments; j++) {
        const z = -half + j * step;
        verts.push(-half, 0.002, z,   half, 0.002, z);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 });
    return new THREE.LineSegments(geom, mat);
}