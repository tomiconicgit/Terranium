// src/effects/EngineFX.js
// Fixed: define JS fract() so the noise helpers work (was causing "Can't find variable: fract")

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// JS equivalent of GLSL fract()
function fract(x) { return x - Math.floor(x); }

// --- Noise helpers used on the CPU side for wobble ---
function n2(p) {
  // p is THREE.Vector2
  return fract(Math.sin(p.dot(new THREE.Vector2(127.1, 311.7))) * 43758.5453);
}
function fbm(p) {
  // p is THREE.Vector2 (mutated)
  let a = 0.0, w = 0.5;
  for (let i = 0; i < 4; i++) {
    a += w * n2(p);
    p.multiplyScalar(2.03).add(new THREE.Vector2(1.7, 1.7));
    w *= 0.5;
  }
  return a;
}

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    this.flameWidthBase  = 3.5;
    this.flameHeightBase = 40.0;
    this.segments = 32;

    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0, flameHeightFactor: 1.0, flameYOffset: 0.0,
      intensity: 1.2, taper: 0.4, bulge: 0.1, tear: 0.85, turbulence: 0.2,
      noiseSpeed: 1.8, diamondsStrength: 0.4, diamondsFreq: 12.0,
      rimStrength: 0.3, rimSpeed: 2.8,
      colorCyan: 1.0, colorOrange: 1.0, colorWhite: 1.2,
      groupOffsetX: 0.0, groupOffsetY: 0.0, groupOffsetZ: 0.0
    };

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.mesh = this._makeFlameMesh();
    this.group.add(this.mesh);

    // Cache original cylinder vertices for CPU deformation
    this.initialVertices = [];
    const posAttribute = this.mesh.geometry.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(posAttribute, i));
    }

    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ----- Public API -----
  setIgnition(on){ this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition(){ return this.params.enginesOn; }
  setParams(patch){ Object.assign(this.params, patch); this._applyTransforms(); this._applyUniforms(); }
  getParams(){ return { ...this.params }; }

  update(delta, t){
    const mat = this.mesh?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;
    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
    }
  }

  // ----- Internals -----
  _applyVisibility(){ this.group.visible = !!this.params.enginesOn; }

  _applyTransforms(){
    this.group.position.set(
      0.0 + this.params.groupOffsetX,
      10.0 + this.params.groupOffsetY,
      0.0 + this.params.groupOffsetZ
    );
    this.mesh.scale.set(1,1,1);
    this.mesh.position.y = this.params.flameYOffset;
  }

  _applyUniforms(){
    const u = this.mesh?.material.uniforms; if (!u) return;
    u.uIntensity.value         = this.params.intensity;
    u.uDiamondsStrength.value  = this.params.diamondsStrength;
    u.uDiamondsFreq.value      = this.params.diamondsFreq;
    u.uRimStrength.value       = this.params.rimStrength;
    u.uRimSpeed.value          = this.params.rimSpeed;
    u.uCyanMul.value           = this.params.colorCyan;
    u.uOrangeMul.value         = this.params.colorOrange;
    u.uWhiteMul.value          = this.params.colorWhite;
  }

  _makeFlameMesh(){
    const height = this.flameHeightBase;
    const geometry = new THREE.CylinderGeometry(0.001, 0.001, height, this.segments, 20, true);
    geometry.translate(0, -height / 2, 0); // Y goes from 0 at nozzle down to -height
    const material = this._makeFlameMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  _updateFlameGeometry(t) {
    const geometry = this.mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    const radiusProfile = (y_norm) => {
      // y_norm: 0 at nozzle, 1 at tail
      let baseR = mix(0.50, 0.28, clamp(this.params.taper, 0.0, 1.0));
      let bulge = this.params.bulge * smoothstep(0.0, 0.35, 0.35 - Math.abs(y_norm - 0.175)) * 0.35;
      let r = baseR + bulge;
      r = mix(r, 0.10, smoothstep(0.60, 0.90, y_norm)); // taper towards tail
      let pinch = Math.pow(smoothstep(0.75, 1.0, y_norm), mix(4.0, 15.0, clamp(this.params.tear, 0.0, 1.0)));
      r = mix(r, 0.0, pinch); // teardrop pinch at the far tail
      return r * w;
    };

    const tempVec2 = new THREE.Vector2();

    for (let i = 0; i < positionAttribute.count; i++) {
      const originalVertex = this.initialVertices[i];
      const y_original = originalVertex.y;              // 0 to -40
      const y_norm = (y_original / -h);                 // 0 at nozzle, 1 at tail (scaled)

      const currentRadius = radiusProfile(y_norm);

      // Angle around cylinder
      tempVec2.set(originalVertex.x, originalVertex.z);
      const angle = Math.atan2(tempVec2.y, tempVec2.x);

      // Noisy wobble along length
      tempVec2.set(y_norm * 6.0, t * this.params.noiseSpeed);
      const wob = (fbm(tempVec2.clone()) - 0.5) * (0.35 * this.params.turbulence * w);
      const radialOffset = currentRadius + wob;

      positionAttribute.setX(i, Math.cos(angle) * radialOffset);
      positionAttribute.setZ(i, Math.sin(angle) * radialOffset);
      positionAttribute.setY(i, y_original * this.params.flameHeightFactor);

      // Tighten right at the nozzle
      if (y_norm < 0.05) {
        const factor = smoothstep(0.05, 0.0, y_norm);
        positionAttribute.setX(i, positionAttribute.getX(i) * factor);
        positionAttribute.setZ(i, positionAttribute.getZ(i) * factor);
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  _makeFlameMaterial(){
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms:{
        uTime: { value: 0.0 },
        uIntensity: { value: 1.2 },
        uDiamondsStrength: { value: 0.4 }, uDiamondsFreq: { value: 12.0 },
        uRimStrength: { value: 0.3 }, uRimSpeed: { value: 2.8 },
        uCyanMul:   { value: 1.0 }, uOrangeMul: { value: 1.0 }, uWhiteMul:  { value: 1.2 },
        uCyan:   { value: new THREE.Color(0x80fbfd) },
        uWhite:  { value: new THREE.Color(0xffffff) },
        uOrange: { value: new THREE.Color(0xffac57) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying float y_norm; // 0 at nozzle, 1 at tail
        void main(){
          // Base height is 40.0. Position Y goes from 0 to -40.0.
          y_norm = position.y / -40.0;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        precision mediump float;
        varying vec3 vNormal;
        varying float y_norm;
        uniform float uTime;
        uniform float uIntensity, uDiamondsStrength, uDiamondsFreq, uRimStrength, uRimSpeed;
        uniform float uCyanMul, uOrangeMul, uWhiteMul;
        uniform vec3 uCyan, uWhite, uOrange;

        // Small hash/FBM for rim flicker
        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0, w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

        void main(){
          // Mach diamonds
          float bands = 0.5 + 0.5*sin(y_norm * uDiamondsFreq * 6.2831853);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength, 0.0, 2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_norm)); // fade diamonds near tail

          // Color ramp: white/blue core -> cyan -> orange tail
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y_norm));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.30, 0.85, y_norm));
          col *= diamonds;

          // Alpha shaping: fade in/out along length
          float alpha_fade = smoothstep(0.00, 0.06, y_norm) * (1.0 - smoothstep(0.96, 1.0, y_norm));

          // Simple rim/halo wobble (artistic, not physically exact)
          float rim = fbm(vec2(y_norm * 10.0, uTime * uRimSpeed)) * uRimStrength;

          float alpha = (alpha_fade + rim) * uIntensity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }`
    });
  }
}

// Utility functions (CPU side)
function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }
function mix(a, b, t) { return a * (1 - t) + b * t; }
function smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - x === e0 ? e1 : e1), 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// Note: smoothstep above uses standard form; if you'd prefer the simpler version:
function _smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }