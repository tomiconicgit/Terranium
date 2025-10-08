import * as THREE from 'three';

export function createSky(scene, renderer) {
  // 1) Sun / lighting
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

  // 2) Skydome (space gradient)
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x041021) },
      bottomColor: { value: new THREE.Color(0x000000) },
      offset:      { value: 0.4 },
      exponent:    { value: 0.65 },
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
        float h = normalize(vWorldPos).y * 0.5 + offset;
        h = clamp(h, 0.0, 1.0);
        h = pow(h, exponent);
        vec3 col = mix(bottomColor, topColor, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  renderer.setClearColor(0x000000, 1);

  // 3) Stars with subtle twinkle
  const starCount = 10000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starPhase = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
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

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float phase;
      uniform float uTime;
      varying float vAlpha;
      void main(){
        float twinkle = 0.75 + 0.25 * sin(uTime * 0.8 + phase);
        vAlpha = twinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 1.5;
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

  // Public API
  return {
    update(dt) {
      starMat.uniforms.uTime.value += dt; // twinkle
    }
  };
}