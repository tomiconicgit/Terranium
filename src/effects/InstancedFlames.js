// src/effects/InstancedFlames.js
// Draws MANY identical flames (different positions only) as ONE InstancedMesh.
// Uses the shared ShaderMaterial from EngineFX to minimize GPU state changes.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import { EngineFX } from './EngineFX.js';

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function mix(a,b,t){ return a*(1.0-t)+b*t; }
function smoothstep(e0,e1,x){ x = clamp((x-e0)/(e1-e0),0.0,1.0); return x*x*(3.0-2.0*x); }

// tiny 2D fbm for wobble (CPU-side)
function fract(x){ return x - Math.floor(x); }
function n2(p){ return fract(Math.sin(p.x*127.1 + p.y*311.7) * 43758.5453); }
function fbm2(p){ let a=0.0,w=0.5; for(let i=0;i<4;i++){ a+=w*n2(p); p.set(p.x*2.03+1.7, p.y*2.03+1.7); w*=0.5;} return a; }

export class InstancedFlames {
  /**
   * @param {THREE.Object3D} rocketRoot  Parent model (for alignment reference)
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{groupOffsetX:number,groupOffsetY:number,groupOffsetZ:number}[]} offsets
   * @param {object} opts optional overrides: { flameYOffset, flameWidthFactor, flameHeightFactor, ... }
   */
  constructor(rocketRoot, scene, camera, offsets, opts = {}) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    // Match EngineFX base so both look identical
    this.params = {
      enginesOn: false,                // start OFF; EnginePanel toggles it
      flameYOffset: 7.6,
      flameWidthFactor: 0.7,
      flameHeightFactor: 0.8,
      taper: 0.0,
      bulge: 1.0,
      tear:  1.0,
      turbulence: 0.5,
      noiseSpeed: 2.2
    };
    Object.assign(this.params, opts);

    // Geometry (shared across all instances)
    this.flameHeightBase = 40.0;
    this.flameWidthBase  = 3.5;
    this.segments        = 32;

    const h = this.flameHeightBase;
    const geo = new THREE.CylinderGeometry(0.001, 0.001, h, this.segments, 20, true);
    geo.translate(0, -h/2, 0);

    // Save original verts so we can CPU-morph per frame (applies to all instances)
    this.initialVertices = [];
    const pos = geo.attributes.position;
    for (let i=0;i<pos.count;i++){
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos,i));
    }
    this.geometry = geo;

    // Instanced mesh
    const count = offsets.length;
    const mat = EngineFX.getSharedMaterial();        // <- shared shader
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;

    // Put the mesh at (0,10,0); per-instance transforms add the offsets and Y shift.
    this.root = new THREE.Group();
    this.root.name = 'InstancedFlamesRoot';
    this.root.position.set(0, 10.0, 0);
    this.scene.add(this.root);
    this.root.add(this.mesh);

    // Apply instance matrices
    const dummy = new THREE.Object3D();
    for (let i=0;i<count;i++){
      const o = offsets[i];
      dummy.position.set(o.groupOffsetX, o.groupOffsetY, o.groupOffsetZ);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    // Lift the whole visible flame column by flameYOffset (like EngineFX)
    this.mesh.position.y = this.params.flameYOffset;

    // Visibility (engine on/off)
    this._applyVisibility();

    // No per-instance point lights here (that would kill perf); the shader is additive/emissive.
  }

  setIgnition(on) {
    this.params.enginesOn = !!on;
    this._applyVisibility();
  }
  getIgnition(){ return this.params.enginesOn; }

  _applyVisibility(){
    const vis = !!this.params.enginesOn;
    this.root.visible = vis;
  }

  /** Morph the shared geometry once; every instance reuses it. */
  update(delta, t) {
    // drive shader time (shared)
    EngineFX.getSharedMaterial().uniforms.uTime.value = t;

    if (!this.params.enginesOn) return;

    const g = this.geometry;
    const pos = g.attributes.position;

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    const radiusProfile = (y_norm)=>{
      let r = mix(0.50, 0.28, clamp(this.params.taper,0.0,1.0));
      r += this.params.bulge * smoothstep(0.0,0.35, 0.35 - Math.abs(y_norm - 0.175)) * 0.35;
      r  = mix(r, 0.10, smoothstep(0.60,0.90,y_norm));
      const pinch = Math.pow(smoothstep(0.75,1.0,y_norm), mix(4.0,15.0, clamp(this.params.tear,0.0,1.0)));
      r = mix(r, 0.0, pinch);
      return r*w;
    };

    const tmp = new THREE.Vector2();
    for (let i=0;i<pos.count;i++){
      const ov = this.initialVertices[i];
      const y0 = ov.y;
      const y_norm = (y0 / -h);

      const curR = radiusProfile(y_norm);

      // angular coordinate from original vertex
      tmp.set(ov.x, ov.z);
      const ang = Math.atan2(tmp.y, tmp.x);

      // small wobble
      tmp.set(y_norm*6.0, t * this.params.noiseSpeed);
      const wob = (fbm2(tmp) - 0.5) * (0.35 * this.params.turbulence * w);
      const ro = curR + wob;

      pos.setX(i, Math.cos(ang) * ro);
      pos.setZ(i, Math.sin(ang) * ro);
      pos.setY(i, y0 * this.params.flameHeightFactor);

      if (y_norm < 0.05) {
        const f = smoothstep(0.05, 0.0, y_norm);
        pos.setX(i, pos.getX(i)*f);
        pos.setZ(i, pos.getZ(i)*f);
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
}