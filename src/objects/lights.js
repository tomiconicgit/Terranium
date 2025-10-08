// Directional sun + hemisphere fill with shadows.
export function createLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.3);
  hemi.position.set(0, 50, 0);

  const sun = new THREE.DirectionalLight(0xffffff, 1.25);
  sun.position.set(50, 100, -30);
  sun.castShadow = true;

  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 500;
  const s = 150;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.00015;

  return [hemi, sun];
}