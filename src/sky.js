import * as THREE from 'three';

export function createSky(scene, renderer) {
  // ---------- 1) Sun / lighting (directional) ----------
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-200, 300, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1500;
  sun.shadow.camera.left = -400;
  sun.shadow.camera.right = 400;
  sun.shadow.camera.top = 400;
  sun.shadow.camera.bottom = -400;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x406080, 0.18); // cool fill
  scene.add(ambient);

  // ---------- 2) Skydome with space gradient ----------
  // Large inside-out sphere with a simple atmospheric gradient
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x041021) }, // deep space blue
      bottomColor: { value: new THREE.Color(0x000000) }, // near-horizon black
      offset:      { value: 0.4 },  // gradient center
      exponent:    { value: 0.65 }, // curve
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPos;
      void main(){
        // y controls the vertical gradient (normalized)
        float h = normalize(vWorldPos).y * 0.5 + offset;
        h = clamp(h, 0.0, 1.0);
        h = pow(h, exponent);
        vec3 col = mix(bottomColor, topColor, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const skydome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skydome);

  // Set renderer clear to black (skydome provides color)
  renderer.setClearColor(0x000000, 1);

  // ---------- 3) Stars with subtle twinkle ----------
  const starCount = 10000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starPhase = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    // random point on a big spherical shell
    const r = 2200 + Math.random() * 500;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 0] = x;
    starPos[i * 3 + 1] = y;
    starPos[i * 3 + 2] = z;
    starPhase[i] = Math.random() * Math.PI * 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(starPhase, 1));

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float phase;
      uniform float uTime;
      varying float vAlpha;
      void main(){
        // small twinkle between 0.5 and 1.0
        float twinkle = 0.75 + 0.25 * sin(uTime * 0.8 + phase);
        vAlpha = twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 1.5; // fixed size (screen space)
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        // soft point sprite
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        float alpha = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0,1.0,1.0, alpha);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---------- 4) Earth + clouds (faces the sun) ----------
  const texLoader = new THREE.TextureLoader();
  const earthTex = texLoader.load('src/assets/textures/space/earth_day.jpg');
  earthTex.colorSpace = THREE.SRGBColorSpace;

  const earthRadius = 80;        // big on the horizon
  const earthDist   = 1800;      // far away
  const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 32);
  const earthMat = new THREE.MeshPhongMaterial({
    map: earthTex,
    specular: 0x222222,
    shininess: 8
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.matrixAutoUpdate = false;
  scene.add(earth);

  // optional thin cloud layer
  let clouds = null;
  const cloudsTex = texLoader.load('src/assets/textures/space/earth_clouds.png');
  if (cloudsTex) {
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.01, 64, 32);
    const cloudsMat = new THREE.MeshLambertMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
    clouds.matrixAutoUpdate = false;
    scene.add(clouds);
  }

  // Position Earth opposite the sun direction so its day side faces the sun
  // and put it near the horizon in front of the player’s default view.
  const sunDir = new THREE.Vector3().copy(sun.position).normalize(); // from origin to sun
  const earthDir = sunDir.clone().multiplyScalar(-1); // opposite side, lit by sun
  const earthPos = earthDir.clone().multiplyScalar(earthDist);
  earth.position.copy(earthPos);
  earth.lookAt(sun.position); // orient so "front" faces the sun
  earth.updateMatrix();

  if (clouds) {
    clouds.position.copy(earth.position);
    clouds.quaternion.copy(earth.quaternion);
    clouds.updateMatrix();
  }

  // ---------- 5) Public API ----------
  return {
    update(dt) {
      // spin Earth very slowly; clouds slightly faster
      const earthRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dt * 0.02);
      earth.applyQuaternion(earthRot);
      earth.updateMatrix();
      if (clouds) {
        const cloudsRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dt * 0.03);
        clouds.applyQuaternion(cloudsRot);
        clouds.updateMatrix();
      }
      // twinkle stars
      starMat.uniforms.uTime.value += dt;
    }
  };
}