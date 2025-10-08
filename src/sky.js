import * as THREE from 'three';

export function createSky(scene, renderer) {
  // --- Sun / lighting ---
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

  const ambient = new THREE.AmbientLight(0x406080, 0.18);
  scene.add(ambient);

  // --- Skydome (space gradient) ---
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyUniforms = {
    topColor:    { value: new THREE.Color(0x041021) },
    bottomColor: { value: new THREE.Color(0x000000) },
    offset:      { value: 0.4 },
    exponent:    { value: 0.65 },
    brightness:  { value: 1.0 }
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
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
      uniform float brightness;
      varying vec3 vWorldPos;
      void main(){
        float h = normalize(vWorldPos).y * 0.5 + offset;
        h = clamp(h, 0.0, 1.0);
        h = pow(h, exponent);
        vec3 col = mix(bottomColor, topColor, h) * brightness;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
  renderer.setClearColor(0x000000, 1);

  // --- Stars (with twinkle) ---
  const maxStars = 15000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(maxStars * 3);
  const starPhase = new Float32Array(maxStars);
  for (let i = 0; i < maxStars; i++) {
    const r = 2200 + Math.random() * 500;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    starPos[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.cos(phi);
    starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    starPhase[i] = Math.random() * Math.PI * 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setDrawRange(0, 10000); // default visible count

  const starUniforms = {
    uTime:  { value: 0 },
    uSize:  { value: 1.5 },
    uSpeed: { value: 0.8 }
  };
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: starUniforms,
    vertexShader: `
      attribute float phase;
      uniform float uTime;
      uniform float uSize;
      uniform float uSpeed;
      varying float vAlpha;
      void main(){
        float twinkle = 0.75 + 0.25 * sin(uTime * uSpeed + phase);
        vAlpha = twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        float alpha = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Public API for UI ---
  const api = {
    update(dt) {
      starUniforms.uTime.value += dt;
    },
    setExposure(v) {
      renderer.toneMappingExposure = v; // "glare" feel
    },
    setSkyBrightness(v) {
      skyUniforms.brightness.value = v;
    },
    setSkyTopColor(hex) {
      skyUniforms.topColor.value.set(hex);
    },
    setSkyBottomColor(hex) {
      skyUniforms.bottomColor.value.set(hex);
    },
    setEnvironmentLightColor(hex) {
      sun.color.set(hex);
      ambient.color.set(hex);
    },
    setSunIntensity(v) {
      sun.intensity = v;
    },
    setAmbientIntensity(v) {
      ambient.intensity = v;
    },
    setStarCount(n) {
      const clamped = Math.max(0, Math.min(maxStars, Math.floor(n)));
      starGeo.setDrawRange(0, clamped);
      starGeo.attributes.position.needsUpdate = true;
    },
    setStarSize(px) {
      starUniforms.uSize.value = px;
    },
    setStarTwinkleSpeed(speed) {
      starUniforms.uSpeed.value = speed;
    },
    // For copying
    _getCurrent: () => ({
      exposure: renderer.toneMappingExposure,
      skyBrightness: skyUniforms.brightness.value,
      skyTopColor: `#${skyUniforms.topColor.value.getHexString()}`,
      skyBottomColor: `#${skyUniforms.bottomColor.value.getHexString()}`,
      envLightColor: `#${sun.color.getHexString()}`,
      sunIntensity: sun.intensity,
      ambientIntensity: ambient.intensity,
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value
    })
  };

  return api;
}