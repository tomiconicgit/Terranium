// src/effects/EngineFX.js
// Adds ignition sound with 4s pre-roll before the flame shows.
// Now includes an orange-band shift and a point light that follows the flame.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

function fract(x) { return x - Math.floor(x); }
function n2(p){ return fract(Math.sin(p.dot(new THREE.Vector2(127.1,311.7))) * 43758.5453); }
function fbm(p){
  let a=0.0, w=0.5;
  for(let i=0;i<4;i++){ a+=w*n2(p); p.multiplyScalar(2.03).add(new THREE.Vector2(1.7,1.7)); w*=0.5; }
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

    // ignition flow
    this.ignitionDelayMs = 2900;
    this.ignitionTimer   = null;
    this.ignitionPending = false;

    // <-- UPDATED defaults to match Main.defaultFXParams -->
    this.params = {
      enginesOn: true,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      flameYOffset: 7.6,

      intensity: 1.5,
      taper: 0.0,
      bulge: 1.0,
      tear: 1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2,
      diamondsStrength: 0.9,
      diamondsFreq: 2.8,

      rimStrength: 0.0,
      rimSpeed: 4.1,

      colorCyan: 0.5,
      colorOrange: 3.0,
      colorWhite: 0.9,

      groupOffsetX: 3.1,
      groupOffsetY: -3.0,
      groupOffsetZ: 1.2,

      tailFadeStart: 0.3,
      tailFeather: 4.0,
      tailNoise: 0.2,

      orangeShift: -0.2,
      lightIntensity: 50.0,
      lightDistance: 800.0,
      lightColor: '#ffb869'
    };

    // audio
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.audio = new THREE.Audio(this.listener);
    this.audio.setLoop(false);
    this.audio.setVolume(0.9);
    this._audioLoaded = false;
    this._loadIgnitionAudio('src/assets/RocketIgnition.wav');

    // group + mesh
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.mesh = this._makeFlameMesh();
    this.group.add(this.mesh);

    // Cache original cylinder vertices
    this.initialVertices = [];
    const pos = this.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    }

    // Emissive point light (follows nozzle)
    this.pointLight = new THREE.PointLight(0xffb869, this.params.lightIntensity, this.params.lightDistance);
    this.pointLight.castShadow = false;
    this.group.add(this.pointLight);

    this._applyTransforms();
    this._applyUniforms();
    this._applyLight();
    this._applyVisibility();
  }

  setIgnition(on){
    if (on) {
      if (this.params.enginesOn || this.ignitionPending) { this._playIgnitionAudio(); return; }
      this.ignitionPending = true;
      this._playIgnitionAudio();

      clearTimeout(this.ignitionTimer);
      this.ignitionTimer = setTimeout(() => {
        this.params.enginesOn = true;
        this.ignitionPending = false;
        this._applyVisibility();
      }, this.ignitionDelayMs);
    } else {
      clearTimeout(this.ignitionTimer);
      this.ignitionPending = false;
      this.params.enginesOn = false;
      this._applyVisibility();
      try { if (this.audio && this.audio.isPlaying) this.audio.stop(); } catch {}
    }
  }

  getIgnition(){ return this.params.enginesOn; }

  setParams(patch){
    // allow color strings for light
    if (patch.lightColor && typeof patch.lightColor === 'string') {
      const c = new THREE.Color(patch.lightColor);
      patch.lightColor = c.getHex();
    }
    Object.assign(this.params, patch);
    this._applyTransforms();
    this._applyUniforms();
    this._applyLight();
  }

  getParams(){ return { ...this.params }; }

  update(delta, t){
    const mat = this.mesh?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;

    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
      // subtle flicker for the light
      if (this.pointLight) {
        const base = this.params.lightIntensity;
        const wob  = (Math.sin(t * 18.0) + Math.sin(t * 7.3)) * 0.08 * base;
        this.pointLight.intensity = Math.max(0.0, base + wob);
      }
    }
  }

  // ----- Audio helpers -----
  _loadIgnitionAudio(url){
    const loader = new THREE.AudioLoader();
    loader.load(url, (buffer) => {
      this.audio.setBuffer(buffer);
      this._audioLoaded = true;
    }, undefined, (err) => { console.error('Ignition audio load failed:', err); });
  }

  async _playIgnitionAudio(){
    try {
      if (this.listener.context.state !== 'running') await this.listener.context.resume();
      if (!this._audioLoaded) return;
      if (this.audio.isPlaying) this.audio.stop();
      this.audio.offset = 0;
      this.audio.play();
    } catch (e) { console.warn('Ignition audio could not play:', e); }
  }

  // ----- Internals -----
  _applyVisibility(){
    const vis = !!this.params.enginesOn;
    this.group.visible = vis;
    if (this.pointLight) this.pointLight.visible = vis;
  }

  _applyTransforms(){
    this.group.position.set(
      0.0 + this.params.groupOffsetX,
      10.0 + this.params.groupOffsetY,
      0.0 + this.params.groupOffsetZ
    );
    this.mesh.scale.set(1,1,1);
    this.mesh.position.y = this.params.flameYOffset;

    if (this.pointLight) {
      // keep the light near the nozzle (slightly below)
      this.pointLight.position.set(0, this.params.flameYOffset - 1.0, 0);
    }
  }

  _applyUniforms(){
    const u = this.mesh?.material.uniforms; if (!u) return;
    u.uIntensity.value        = this.params.intensity;
    u.uDiamondsStrength.value = this.params.diamondsStrength;
    u.uDiamondsFreq.value     = this.params.diamondsFreq;
    u.uRimStrength.value      = this.params.rimStrength;
    u.uRimSpeed.value         = this.params.rimSpeed;
    u.uCyanMul.value          = this.params.colorCyan;
    u.uOrangeMul.value        = this.params.colorOrange;
    u.uWhiteMul.value         = this.params.colorWhite;

    u.uTailStart.value   = this.params.tailFadeStart;
    u.uTailFeather.value = this.params.tailFeather;
    u.uTailNoise.value   = this.params.tailNoise;

    u.uOrangeShift.value = this.params.orangeShift;   // band shift
  }

  _applyLight(){
    if (!this.pointLight) return;
    this.pointLight.intensity = this.params.lightIntensity;
    this.pointLight.distance  = this.params.lightDistance;
    const c = (typeof this.params.lightColor === 'number')
      ? this.params.lightColor
      : new THREE.Color(this.params.lightColor).getHex();
    this.pointLight.color.setHex(c);
  }

  _makeFlameMesh(){
    const h = this.flameHeightBase;
    const geometry = new THREE.CylinderGeometry(0.001, 0.001, h, this.segments, 20, true);
    geometry.translate(0, -h/2, 0); // Y: 0 at nozzle, -h at tail
    const material = this._makeFlameMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  _updateFlameGeometry(t){
    const g = this.mesh.geometry;
    const pos = g.attributes.position;
    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    const radiusProfile = (y_norm) => {
      let r = mix(0.50, 0.28, clamp(this.params.taper, 0.0, 1.0));
      r += this.params.bulge * smoothstep(0.0, 0.35, 0.35 - Math.abs(y_norm-0.175)) * 0.35;
      r  = mix(r, 0.10, smoothstep(0.60, 0.90, y_norm));
      const pinch = Math.pow(smoothstep(0.75, 1.0, y_norm), mix(4.0, 15.0, clamp(this.params.tear, 0.0, 1.0)));
      r = mix(r, 0.0, pinch);
      return r * w;
    };

    const tmp = new THREE.Vector2();

    for (let i = 0; i < pos.count; i++) {
      const ov = this.initialVertices[i];
      const y0 = ov.y;
      const y_norm = (y0 / -h);

      const curR = radiusProfile(y_norm);

      tmp.set(ov.x, ov.z);
      const ang = Math.atan2(tmp.y, tmp.x);

      tmp.set(y_norm * 6.0, t * this.params.noiseSpeed);
      const wob = (fbm(tmp.clone()) - 0.5) * (0.35 * this.params.turbulence * w);
      const ro  = curR + wob;

      pos.setX(i, Math.cos(ang) * ro);
      pos.setZ(i, Math.sin(ang) * ro);
      pos.setY(i, y0 * this.params.flameHeightFactor);

      if (y_norm < 0.05) {
        const f = smoothstep(0.05, 0.0, y_norm);
        pos.setX(i, pos.getX(i) * f);
        pos.setZ(i, pos.getZ(i) * f);
      }
    }

    pos.needsUpdate = true;
    g.computeVertexNormals();
  }

  _makeFlameMaterial(){
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms:{
        uTime: { value: 0.0 },
        uIntensity: { value: this.params.intensity },
        uDiamondsStrength: { value: this.params.diamondsStrength },
        uDiamondsFreq: { value: this.params.diamondsFreq },
        uRimStrength: { value: this.params.rimStrength },
        uRimSpeed: { value: this.params.rimSpeed },
        uCyanMul: { value: this.params.colorCyan },
        uOrangeMul:{ value: this.params.colorOrange },
        uWhiteMul: { value: this.params.colorWhite },
        uCyan:   { value: new THREE.Color(0x80fbfd) },
        uWhite:  { value: new THREE.Color(0xffffff) },
        uOrange: { value: new THREE.Color(0xffac57) },

        uTailStart:   { value: this.params.tailFadeStart },
        uTailFeather: { value: this.params.tailFeather },
        uTailNoise:   { value: this.params.tailNoise },

        // shift where orange begins/ends
        uOrangeShift: { value: this.params.orangeShift }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying float y_norm;
        void main(){
          y_norm = position.y / -40.0; // matches flameHeightBase
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
        uniform vec3  uCyan, uWhite, uOrange;

        uniform float uTailStart;
        uniform float uTailFeather;
        uniform float uTailNoise;

        uniform float uOrangeShift;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){ float a=0.0, w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

        void main(){
          float bands = 0.5 + 0.5*sin(y_norm*uDiamondsFreq*6.2831853);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_norm));

          // base color ramps
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul,  smoothstep(0.0, 0.25, y_norm));
          // shift the orange blend upward/downward by uOrangeShift
          float o0 = 0.30 + uOrangeShift;
          float o1 = 0.85 + uOrangeShift;
          col = mix(col, uOrange*uOrangeMul, smoothstep(o0, o1, y_norm));

          col *= diamonds;

          float alphaStart = smoothstep(0.00, 0.06, y_norm);

          float baseTail   = 1.0 - smoothstep(uTailStart, 1.0, y_norm);
          baseTail         = pow(max(baseTail, 0.0), max(uTailFeather, 0.0001));
          float tailJitter = (fbm(vec2(y_norm*18.0, uTime*1.3)) - 0.5) * uTailNoise;
          float alphaTail  = clamp(baseTail + tailJitter, 0.0, 1.0);

          float rim = fbm(vec2(y_norm * 10.0, uTime*uRimSpeed)) * uRimStrength;

          float alpha = (alphaStart * alphaTail + rim) * uIntensity;

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }`
    });
  }
}

// Utilities
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function mix(a,b,t){ return a*(1.0-t)+b*t; }
function smoothstep(e0,e1,x){ x = clamp((x-e0)/(e1-e0),0.0,1.0); return x*x*(3.0-2.0*x); }