import { fbm } from '../utils/perlin.js';

export function createTerrain() {
  const width = 100, height = 100, segments = 128;
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
  const v = geometry.attributes.position.array;

  for (let i = 0; i < v.length; i += 3) {
    const x = v[i] / width + 0.5, y = v[i + 1] / height + 0.5;
    v[i + 2] = -fbm(x * 5, y * 5, 6) * 10;
  }
  geometry.computeVertexNormals();

  const params = new URLSearchParams(location.search);
  const SAFE = params.get('safe') === '1'; // add ?safe=1 to URL to bypass heavy bits

  const tloader = new THREE.TextureLoader();
  const haveEXR = !!THREE.EXRLoader;
  const exr = haveEXR && !SAFE ? new THREE.EXRLoader() : null;

  const map1 = tloader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  map1.wrapS = map1.wrapT = THREE.RepeatWrapping; map1.repeat.set(5,5);

  const displacement1 = tloader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');
  displacement1.wrapS = displacement1.wrapT = THREE.RepeatWrapping; displacement1.repeat.set(5,5);

  // fallbacks if EXR unavailable / safe mode
  const normalMap1   = exr ? exr.load('src/assets/textures/moon/moondusted/moondusted-normal.exr')
                           : tloader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');
  const roughnessMap1= exr ? exr.load('src/assets/textures/moon/moondusted/moondusted-roughness.exr')
                           : null;

  const material = new THREE.MeshStandardMaterial({
    map: map1,
    normalMap: normalMap1 || undefined,
    roughnessMap: roughnessMap1 || undefined,
    displacementMap: displacement1,
    displacementScale: 5,
    displacementBias: -2.5,
    side: THREE.DoubleSide
  });

  // Skip shader blending in safe mode (helps isolate shader compile crashes)
  if (!SAFE) {
    try {
      const map2 = tloader.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-diffuse.jpg');
      const map3 = tloader.load('src/assets/textures/moon/moonnormal/moonnormal-diffuse.jpg');
      const normalMap2 = exr ? exr.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-normal.exr') : null;
      const normalMap3 = exr ? exr.load('src/assets/textures/moon/moonnormal/moonnormal-normal.exr') : null;
      const roughnessMap2 = exr ? exr.load('src/assets/textures/moon/moonflatmacro/moonflatmacro-roughness.exr') : null;
      const roughnessMap3 = exr ? exr.load('src/assets/textures/moon/moonnormal/moonnormal-roughness.exr') : null;

      material.onBeforeCompile = (shader) => {
        shader.uniforms.map2 = { value: map2 };
        shader.uniforms.map3 = { value: map3 };
        shader.uniforms.normalMap2 = { value: normalMap2 };
        shader.uniforms.normalMap3 = { value: normalMap3 };
        shader.uniforms.roughnessMap2 = { value: roughnessMap2 };
        shader.uniforms.roughnessMap3 = { value: roughnessMap3 };

        const noiseGlsl = `
          float fade(float t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }
          float lerp(float t,float a,float b){ return a + t*(b-a); }
          float grad(int hash,float x,float y,float z){
            int h = hash & 15;
            float u = h < 8 ? x : y;
            float v = h < 4 ? y : (h == 12 || h == 14 ? x : z);
            return ((h & 1)==0 ? u : -u) + ((h & 2)==0 ? v : -v);
          }
          const float p[512] = float[](
            151.0,160.0,137.0,91.0,90.0,15.0,131.0,13.0,201.0,95.0,96.0,53.0,194.0,233.0,7.0,225.0,
            140.0,36.0,103.0,30.0,69.0,142.0,8.0,99.0,37.0,240.0,21.0,10.0,23.0,190.0,6.0,148.0,
            247.0,120.0,234.0,75.0,0.0,26.0,197.0,62.0,94.0,252.0,219.0,203.0,117.0,35.0,11.0,32.0,
            57.0,177.0,33.0,88.0,237.0,149.0,56.0,87.0,174.0,20.0,125.0,136.0,171.0,168.0,68.0,175.0,
            74.0,165.0,71.0,134.0,139.0,48.0,27.0,166.0,77.0,146.0,158.0,231.0,83.0,111.0,229.0,122.0,
            60.0,211.0,133.0,230.0,220.0,105.0,92.0,41.0,55.0,46.0,245.0,40.0,244.0,102.0,143.0,54.0,
            65.0,25.0,63.0,161.0,1.0,216.0,80.0,73.0,209.0,76.0,132.0,187.0,208.0,89.0,18.0,169.0,
            200.0,196.0,135.0,130.0,116.0,188.0,159.0,86.0,164.0,100.0,109.0,198.0,173.0,186.0,3.0,64.0,
            52.0,217.0,226.0,250.0,124.0,123.0,5.0,202.0,38.0,147.0,118.0,126.0,255.0,82.0,85.0,212.0,
            207.0,206.0,59.0,227.0,47.0,16.0,58.0,17.0,182.0,189.0,28.0,42.0,223.0,183.0,170.0,213.0,
            119.0,248.0,152.0,2.0,44.0,154.0,163.0,70.0,221.0,153.0,101.0,155.0,167.0,43.0,172.0,9.0,
            129.0,22.0,39.0,253.0,19.0,98.0,108.0,110.0,79.0,113.0,224.0,232.0,178.0,185.0,112.0,104.0,
            218.0,246.0,97.0,228.0,251.0,34.0,242.0,193.0,238.0,210.0,144.0,12.0,191.0,179.0,162.0,241.0,
            81.0,51.0,145.0,235.0,249.0,14.0,239.0,107.0,49.0,192.0,214.0,31.0,181.0,199.0,106.0,157.0,
            184.0,84.0,204.0,176.0,115.0,121.0,50.0,45.0,127.0,4.0,150.0,254.0,138.0,236.0,205.0,93.0,
            222.0,114.0,67.0,29.0,24.0,72.0,243.0,141.0,128.0,195.0,78.0,66.0,215.0,61.0,156.0,180.0
          );
          float noise2d(vec2 xy){
            int X = int(floor(xy.x)) & 255;
            int Y = int(floor(xy.y)) & 255;
            float x = xy.x - floor(xy.x);
            float y = xy.y - floor(xy.y);
            float u = fade(x);
            float v = fade(y);
            int A = int(p[X] + float(Y));
            int AA = int(p[A]);
            int AB = int(p[A + 1]);
            int B = int(p[X + 1] + float(Y));
            int BA = int(p[B]);
            int BB = int(p[B + 1]);
            float res = lerp(v, lerp(u, grad(AA, x, y, 0.0), grad(BA, x-1.0, y, 0.0)),
                                lerp(u, grad(AB, x, y-1.0, 0.0), grad(BB, x-1.0, y-1.0, 0.0)));
            return (res + 1.0) / 2.0;
          }
          float fbm(vec2 xy){
            float total = 0.0, amplitude = 1.0, frequency = 1.0;
            for (int i = 0; i < 4; i++){ total += amplitude * noise2d(xy * frequency); amplitude *= 0.5; frequency *= 2.0; }
            return total;
          }
        `;
        shader.fragmentShader = noiseGlsl + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          float f = fbm(vMapUv * 5.0);
          vec4 texel1 = texture2D(map, vMapUv);
          vec4 texel2 = texture2D(map2, vMapUv);
          vec4 texel3 = texture2D(map3, vMapUv);
          float mix12 = smoothstep(0.3, 0.35, f);
          vec4 color12 = mix(texel1, texel2, mix12);
          float mix23 = smoothstep(0.6, 0.65, f);
          vec4 blendedColor = mix(color12, texel3, mix23);
          blendedColor = mapTexelToLinear(blendedColor);
          diffuseColor *= blendedColor;
          `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `
          float f = fbm(vNormalUv * 5.0);
          vec3 normal1 = texture2D(normalMap, vNormalUv).xyz * 2.0 - 1.0;
          vec3 normal2 = texture2D(normalMap2, vNormalUv).xyz * 2.0 - 1.0;
          vec3 normal3 = texture2D(normalMap3, vNormalUv).xyz * 2.0 - 1.0;
          float mix12 = smoothstep(0.3, 0.35, f);
          vec3 normal12 = mix(normal1, normal2, mix12);
          float mix23 = smoothstep(0.6, 0.65, f);
          vec3 blendedNormal = mix(normal12, normal3, mix23);
          #ifdef USE_TANGENT
            normal = normalize(vTBN * blendedNormal);
          #else
            normal = normalize(normalMatrix * blendedNormal);
          #endif
          `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `
          float f = fbm(vRoughnessMapUv * 5.0);
          vec4 texelRough1 = texture2D(roughnessMap, vRoughnessMapUv);
          vec4 texelRough2 = texture2D(roughnessMap2, vRoughnessMapUv);
          vec4 texelRough3 = texture2D(roughnessMap3, vRoughnessMapUv);
          float mix12 = smoothstep(0.3, 0.35, f);
          vec4 rough12 = mix(texelRough1, texelRough2, mix12);
          float mix23 = smoothstep(0.6, 0.65, f);
          vec4 blendedRough = mix(rough12, texelRough3, mix23);
          roughnessFactor *= blendedRough.g;
          `
        );
      };
    } catch (e) {
      console.error('Terrain shader failed, running in safe mode:', e);
    }
  }

  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  return terrain;
}