// simple "space" sky: black background, star field, and a soft horizon haze
import * as THREE from 'three';

export function createSky(scene) {
  // -------- background --------
  scene.background = new THREE.Color(0x000000);

  // -------- stars --------
  const MAX_STARS = 15000;
  const starGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_STARS * 3);
  const phase = new Float32Array(MAX_STARS);

  function fillStars() {
    for (let i = 0; i < MAX_STARS; i++) {
      const r = 1800 + Math.random() * 1200;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.cos(phi);
      positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      phase[i] = Math.random() * Math.PI * 2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    starGeo.setDrawRange(0, 8000); // default
  }
  fillStars();

  const starUniforms = {
    uTime:  { value: 0 },
    uSize:  { value: 1.6 },
    uSpeed: { value: 0.9 }
  };

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: starUniforms,
    vertexShader: `
      precision highp float;
      attribute float phase;
      uniform float uTime, uSize, uSpeed;
      varying float vAlpha;
      void main(){
        float tw = 0.72 + 0.28 * sin(uTime * uSpeed + phase);
        vAlpha = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // keep constant-ish size; tweak if you want distance attenuation
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vAlpha;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = dot(uv, uv);
        float a = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // -------- horizon haze (cylinder with vertical gradient) --------
  const hazeUniforms = {
    uColor: { value: new THREE.Color('#223366') },
    uHeight: { value: 40.0 },
    uRadius: { value: 220.0 },
    uAlpha:  { value: 0.6 }
  };

  const hazeMat = new THREE.ShaderMaterial({
    uniforms: hazeUniforms,
    depthWrite: false,
    transparent: true,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      precision highp float;
      varying float vH;
      void main(){
        vH = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      uniform float uHeight;
      uniform float uAlpha;
      varying float vH;
      void main(){
        float t = clamp(vH / max(0.0001, uHeight), 0.0, 1.0);
        float a = pow(1.0 - t, 1.8) * uAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `
  });

  let hazeMesh = buildHazeMesh(hazeUniforms.uRadius.value, hazeUniforms.uHeight.value);
  scene.add(hazeMesh);

  function buildHazeMesh(radius, height) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
    geo.translate(0, height * 0.5, 0);
    return new THREE.Mesh(geo, hazeMat);
  }

  function rebuildHaze() {
    const parent = hazeMesh.parent;
    if (parent) parent.remove(hazeMesh);
    hazeMesh.geometry.dispose();
    hazeMesh = buildHazeMesh(hazeUniforms.uRadius.value, hazeUniforms.uHeight.value);
    if (parent) parent.add(hazeMesh);
  }

  // -------- API --------
  const api = {
    update(dt){ starUniforms.uTime.value += dt; },

    // stars
    setStarCount(n){
      const c = Math.max(0, Math.min(MAX_STARS, Math.floor(n)));
      starGeo.setDrawRange(0, c);
    },
    setStarSize(px){ starUniforms.uSize.value = Math.max(0.1, px); },
    setStarTwinkleSpeed(s){ starUniforms.uSpeed.value = Math.max(0, s); },

    // haze
    setHazeColor(hex){ hazeUniforms.uColor.value.set(hex); },
    setHazeHeight(h){ hazeUniforms.uHeight.value = Math.max(1, h); rebuildHaze(); },
    setHazeRadius(r){ hazeUniforms.uRadius.value = Math.max(10, r); rebuildHaze(); },
    setHazeAlpha(a){ hazeUniforms.uAlpha.value = Math.max(0, Math.min(1, a)); },

    _getCurrent: () => ({
      starCount: starGeo.drawRange.count,
      starSize: starUniforms.uSize.value,
      starTwinkleSpeed: starUniforms.uSpeed.value,
      hazeColor: `#${hazeUniforms.uColor.value.getHexString()}`,
      hazeHeight: hazeUniforms.uHeight.value,
      hazeRadius: hazeUniforms.uRadius.value,
      hazeAlpha: hazeUniforms.uAlpha.value
    })
  };

  return api;
}