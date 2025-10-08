// src/objects/sky.js: Creates HDRI sky

export function createSky(scene) {
    const loader = new THREE.RGBELoader();
    loader.load('https://www.spacespheremaps.com/wp-content/uploads/HDR_galactic_plane_no_nebulae.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
    });
}