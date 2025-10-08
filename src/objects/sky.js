// Creates HDRI sky by setting scene background/environment.
// NOTE: relies on THREE.RGBELoader loaded globally by bootstrap.
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