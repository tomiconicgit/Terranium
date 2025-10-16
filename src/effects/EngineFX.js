// src/effects/EngineFX.js
// Procedural flames + ground smoke for clustered engines (no external textures)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export class EngineFX {
  /**
   * @param {THREE.Object3D} rocketRoot  - Root of the loaded SuperHeavy model
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{inner:number,outer:number,innerRadius:number,outerRadius:number}} [opts]
   */
  constructor(rocketRoot, scene, camera, opts = {}) {
    this.rocket = rocketRoot;
    this.scene = scene;
    this.camera = camera;

    const cfg = {
      inner: 9,
      outer: 24,
      innerRadius: 2.6,
      outerRadius: 6.2,
      ...opts
    };

    // Infer model bottom
    const box = new THREE.Box3().setFromObject(rocketRoot);
    const bottomY = box.min.y;

    // Engine emitter points (two rings)
    this.enginePoints = [
      ...this._ring(cfg.innerRadius, cfg.inner),
      ...this._ring(cfg.outerRadius, cfg.outer)
    ].map(p => new THREE.Vector3(p.x, bottomY + 0.2, p.y));

    // ---- FLAMES (instanced billboards with shader) ----
    const flameGeo = new THREE.PlaneGeometry(1, 4);
    const flameMat = this._makeFlameMaterial();
    this.flames = new THREE.InstancedMesh(flameGeo, flameMat, this.enginePoints.length);
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.enginePoints.length; i++) {
      const p = this.enginePoints[i];
      dummy.position.copy(p);
      dummy.scale.set(1.2, 6.0, 1.0); // width, height, depth
      dummy.updateMatrix();
      this.flames.setMatrixAt(i, dummy.matrix);
      // store a seed in instance color (r channel)
      this.flames.setColorAt(i, new THREE.Color(Math.random(), 0, 0));
    }
    this.flames.frustumCulled = false;

    // billboard around Y to face camera
    this.flames.onBeforeRender = () => {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const look = new THREE.Vector3();
      const obj = new THREE.Object3D();
      for (let i = 0; i < this.enginePoints.length; i++) {
        this.flames.getMatrixAt(i, m);
        m.decompose(obj.position, obj.quaternion, obj.scale);
        look.copy(this.camera.position).sub(obj.position);
        const yaw = Math.atan2(look.x, look.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        obj.quaternion.copy(q);
        obj.updateMatrix();
        this.flames.setMatrixAt(i, obj.matrix);
      }
      this.flames.instanceMatrix.needsUpdate = true;
    };

    // ---- GROUND SMOKE (points with shader) ----
    const smokeCount = 600;
    const smokeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(smokeCount * 3);
    const ages = new Float32Array(smokeCount);
    const seeds = new Float32Array(smokeCount);
    const minR = cfg.innerRadius * 0.6;
    const maxR = cfg.outerRadius * 1.1;

    for (let i = 0; i < smokeCount; i++) {
      const r = THREE.MathUtils.lerp(minR, maxR, Math.random());
      const a = Math.random() * Math.PI * 2;
      positions[i*3+0] = Math.cos(a) * r;
      positions[i*3+2] = Math.sin(a) * r;
      positions[i*3+1] = bottomY + 0.05;
      ages[i] = Math.random();
      seeds[i] = Math.random() * 1000.0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
    smokeGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.smoke = new THREE.Points(smokeGeo, this._makeSmokeMaterial());
    this.smoke.frustumCulled = false;

    // Group under rocket so if you move it later, FX follow
    this.group = new THREE.Group();
    rocketRoot.add(this.group);
    this.group.add(this.flames);
    this.group.add(this.smoke);

    this.time = 0;
    this.engineOn = false; // default off
    this._applyVisibility();
  }

  _ring(radius, count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      pts.push({ x: Math.cos(t) * radius, y: Math.sin(t) * radius });
    }
    return pts;
  }

  _makeFlameMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xffddaa) },
        uColor2: { value: new THREE.Color(0xff6600) },
        uColor3: { value: new THREE.Color(0x884400) },
        uNoiseAmp: { value: 0.6 },
        uFlicker: { value: 2.5 },
      },
      vertexShader: /* glsl */`
        attribute vec3 color;   // instanceColor.r as seed
        varying float vSeed;
        varying vec2 vUv2;
        void main() {
          vSeed = color.r;
          vUv2 = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying float vSeed;
        varying vec2 vUv2;
        uniform float uTime;
        uniform vec3 uColor1, uColor2, uColor3;
        uniform float uNoiseAmp, uFlicker;

        float hash(vec2 p){ p=50.0*fract(p*0.3183099); return fract(p.x*p.y*(p.x+p.y)); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p);
          float a=hash(i), b=hash(i+vec2(1.0,0.0));
          float c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }

        void main(){
          float t = uTime * (1.5 + vSeed*0.5);
          float n = noise(vec2(vUv2.x*3.0 + vSeed*10.0, vUv2.y*6.0 - t)) * uNoiseAmp;

          float center = abs(vUv2.x - 0.5) * (1.0 + n*0.6);
          float width = mix(0.28, 0.08, vUv2.y);
          float mask = smoothstep(width, width-0.05, center);

          float flick = 0.75 + 0.25 * sin(t * uFlicker + vSeed*6.283);
          float fade = smoothstep(0.0, 0.15, vUv2.y) * (1.0 - smoothstep(0.65, 1.0, vUv2.y));
          float alpha = mask * fade * flick;

          vec3 col = mix(uColor2, uColor1, smoothstep(0.0, 0.25, vUv2.y));
          col = mix(uColor3, col, smoothstep(0.2, 0.8, vUv2.y));

          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  _makeSmokeMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x777777) },
        uRise:  { value: 2.0 },
        uLife:  { value: 2.5 },
        uSize:  { value: 34.0 },
        uSoft:  { value: 0.7 }
      },
      vertexShader: /* glsl */`
        precision highp float;
        uniform float uTime, uRise, uLife, uSize;
        attribute float aAge, aSeed;
        varying float vAlpha;

        void main(){
          float t = fract(aAge + uTime / uLife);

          vec3 pos = position;
          float wob = sin(aSeed + t*6.283)*0.3;
          float ang = aSeed * 0.01 + t * 6.283 * 0.15;
          pos.x += wob * 0.6 * sin(ang);
          pos.z += wob * 0.6 * cos(ang);
          pos.y += t * uRise + (sin(aSeed*3.1 + t*12.0) * 0.2);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (uSize * (0.8 + t*1.2)) / -mv.z;

          vAlpha = smoothstep(0.02, 0.2, t) * (1.0 - smoothstep(0.6, 1.0, t));
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColor;
        uniform float uSoft;
        varying float vAlpha;

        void main(){
          vec2 uv = gl_PointCoord;
          float a = smoothstep(1.0, 0.0, length(uv*2.0-1.0));
          a = pow(a, 1.0 + uSoft*1.2);
          gl_FragColor = vec4(uColor, a * vAlpha);
        }
      `
    });
  }

  update(dt, time) {
    this.time += dt;
    if (this.flames?.material?.uniforms) {
      this.flames.material.uniforms.uTime.value = time;
      this.flames.material.uniformsNeedUpdate = true;
    }
    if (this.smoke?.material?.uniforms) {
      this.smoke.material.uniforms.uTime.value = time;
      this.smoke.material.uniformsNeedUpdate = true;
    }
  }

  setEngines(on) {
    this.engineOn = !!on;
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this.flames) this.flames.visible = this.engineOn;
    if (this.smoke)  this.smoke.visible  = this.engineOn;
  }
}