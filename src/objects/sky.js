// Sets an HDRI as background/environment. Uses global THREE.RGBELoader (loaded in bootstrap).
export function applySky(scene) {
  const loader = new THREE.RGBELoader();
  loader.setDataType(THREE.UnsignedByteType);
  loader.load(
    'https://www.spacespheremaps.com/wp-content/uploads/HDR_galactic_plane_no_nebulae.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture;
    },
    undefined,
    (err) => console.error('HDR load error:', err)
  );
}