// src/effects/EngineFX.js
import * as THREE from 'three';
import { FlameFragmentShader } from './FlameShader.js';
import { DEFAULT_FLAME_PARAMS, cloneDefaults, applyParamsToUniforms } from './FlameDefaults.js';

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function mix(a,b,t){ return a*(1.0-t)+b*t; }
function smoothstep(e0,e1,x){ x = clamp((x-e0)/(e1-e0),0.0,1.0); return x*x*(3.0-2.0*x); }
function fract(x){ return x - Math.floor(x); }
function n2(p){ return fract(Math.sin(p.dot(new THREE.Vector2(127.1,311.7))) * 43758.5453); }
function fbm(p){ let a=0.0,w=0.5; for(let i=0;i<4;i++){ a+=w*n2(p); p.multiplyScalar(2.03).add(new THREE.Vector2(1.7,1.7)); w*=0.5; } return a; }

export class EngineFX {
  static _sharedMaterial = null;

  static _createSharedMaterial(){
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0.0 },
        uIntensity:        { value: DEFAULT_FLAME_PARAMS.intensity },
        uDiamondsStrength: { value: DEFAULT_FLAME_PARAMS.diamondsStrength },
        uDiamondsFreq:     { value: DEFAULT_FLAME_PARAMS.diamondsFreq },
        uRimStrength:      { value: DEFAULT_FLAME_PARAMS.rimStrength },
        uRimSpeed:         { value: DEFAULT_FLAME_PARAMS.rimSpeed },
        uCyanMul:          { value: DEFAULT_FLAME_PARAMS.colorCyan },
        uOrangeMul:        { value: DEFAULT_FLAME_PARAMS.colorOrange },
        uWhiteMul:         { value: DEFAULT_FLAME_PARAMS.colorWhite },
        uCyan:             { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorCyanHex) },
        uWhite:            { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorWhiteHex) },
        uOrange:           { value: new THREE.Color(DEFAULT_FLAME_PARAMS.colorOrangeHex) },
        uTailStart:        { value: DEFAULT_FLAME_PARAMS.tailFadeStart },
        uTailFeather:      { value: DEFAULT_FLAME_PARAMS.tailFeather },
        uTailNoise:        { value: DEFAULT_FLAME_PARAMS.tailNoise },
        uBottomDepth:      { value: DEFAULT_FLAME_PARAMS.bottomFadeDepth },
        uBottomFeather:    { value: DEFAULT_FLAME_PARAMS.bottomFadeFeather },
        uOrangeShift:      { value: DEFAULT_FLAME_PARAMS.orangeShift }
      },
      vertexShader: `
        varying float y_norm;
        void main(){
          y_norm = position.y / -40.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: FlameFragmentShader
    });
  }
  static getSharedMaterial(){
    if (!EngineFX._sharedMaterial) EngineFX._sharedMaterial = EngineFX._createSharedMaterial();
    return EngineFX._sharedMaterial;
  }

  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot; this.scene = scene; this.camera = camera;

    this.flameWidthBase  = 3.5;
    this.flameHeightBase = 40.0;
    this.segments = 32;

    this.ignitionDelayMs = 2800;
    this.ignitionTimer = null;
    this.ignitionPending = false;

    // Single source: deep clone of defaults
    this.params = cloneDefaults();

    // audio
    this.listener = new THREE.AudioListener(); this.camera.add(this.listener);
    this.audio = new THREE.Audio(this.listener); this.audio.setLoop(false); this.audio.setVolume(0.9);
    this._audioLoaded = false; this._loadIgnitionAudio('src/assets/RocketIgnition.wav');

    // group + mesh
    this.group = new THREE.Group(); this.group.name = 'EngineFXGroup'; this.scene.add(this.group);
    this.mesh = this._makeFlameMesh(); this.mesh.name='EngineFXMesh'; this.mesh.userData.__engineFX = this; this.group.add(this.mesh);

    // cache original verts to morph dynamically
    this.initialVertices = [];
    const pos = this.mesh.geometry.attributes.position;
    for (let i=0;i<pos.count;i++) this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(pos,i));

    // light
    this.pointLight = new THREE.PointLight(0xffb869, this.params.lightIntensity, this.params.lightDistance);
    this.pointLight.castShadow = false; this.group.add(this.pointLight);

    // initial transforms & vis
    this._applyTransforms();
    this._applyLight();
    this._applyVisibility();

    // Per-draw push (shared material; this keeps each flame unique)
    this.mesh.onBeforeRender = (_r,_s,_c,_g,material) => {
      applyParamsToUniforms(material.uniforms, this.params);
    };
  }

  getRaycastTargets(){ return [this.mesh]; }

  setIgnition(on){
    if (on) {
      if (this.params.enginesOn || this.ignitionPending) { this._playIgnitionAudio(); return; }
      this.ignitionPending = true; this._playIgnitionAudio();
      clearTimeout(this.ignitionTimer);
      this.ignitionTimer = setTimeout(()=>{ this.params.enginesOn = true; this.ignitionPending=false; this._applyVisibility(); }, this.ignitionDelayMs);
    } else {
      clearTimeout(this.ignitionTimer); this.ignitionPending=false; this.params.enginesOn=false; this._applyVisibility();
      try{ if(this.audio && this.audio.isPlaying) this.audio.stop(); } catch {}
    }
  }
  getIgnition(){ return this.params.enginesOn; }

  setParams(patch){
    if (!patch) return;
    if (patch.lightColor && typeof patch.lightColor==='string') {
      try { patch.lightColor = new THREE.Color(patch.lightColor).getHex(); } catch {}
    }
    // Validate hex strings if provided
    ['colorWhiteHex','colorCyanHex','colorOrangeHex'].forEach(k=>{
      if (typeof patch[k] === 'string') { try{ new THREE.Color(patch[k]); } catch { delete patch[k]; } }
    });
    Object.assign(this.params, patch);
    this._applyTransforms();
    this._applyLight();
  }
  getParams(){ return { ...this.params }; }

  update(delta,t){
    EngineFX.getSharedMaterial().uniforms.uTime.value = t;
    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
      if (this.pointLight) {
        const base = this.params.lightIntensity;
        const wob  = (Math.sin(t*18.0)+Math.sin(t*7.3))*0.08*base;
        this.pointLight.intensity = Math.max(0.0, base + wob);
      }
    }
  }

  _loadIgnitionAudio(url){
    const loader = new THREE.AudioLoader();
    loader.load(url,(buffer)=>{ this.audio.setBuffer(buffer); this._audioLoaded = true; },
      undefined,(e)=>console.error('Ignition audio load failed:',e));
  }
  async _playIgnitionAudio(){
    try{
      if (this.listener.context.state!=='running') await this.listener.context.resume();
      if (!this._audioLoaded) return;
      if (this.audio.isPlaying) this.audio.stop();
      this.audio.offset = 0; this.audio.play();
    }catch(e){ console.warn('Ignition audio could not play:',e); }
  }

  _applyVisibility(){
    const vis = !!this.params.enginesOn;
    this.group.visible = vis;
    if (this.pointLight) this.pointLight.visible = vis;
  }

  _applyTransforms(){
    this.group.position.set(this.params.groupOffsetX, 10.0 + this.params.groupOffsetY, this.params.groupOffsetZ);
    if (this.mesh) { this.mesh.scale.set(1,1,1); this.mesh.position.y = this.params.flameYOffset; }
    if (this.pointLight) this.pointLight.position.set(0, this.params.flameYOffset - 1.0, 0);
  }

  _applyLight(){
    if (!this.pointLight) return;
    this.pointLight.intensity = this.params.lightIntensity;
    this.pointLight.distance  = this.params.lightDistance;
    try {
      const c = (typeof this.params.lightColor==='number') ? this.params.lightColor : new THREE.Color(this.params.lightColor).getHex();
      this.pointLight.color.setHex(c);
    } catch {}
  }

  _makeFlameMesh(){
    const h = this.flameHeightBase;
    const geometry = new THREE.CylinderGeometry(0.001,0.001,h,this.segments,20,true);
    geometry.translate(0,-h/2,0);
    const mesh = new THREE.Mesh(geometry, EngineFX.getSharedMaterial());
    mesh.frustumCulled = false;
    return mesh;
  }

  _updateFlameGeometry(t){
    const g=this.mesh.geometry, pos=g.attributes.position;
    const w=this.flameWidthBase*this.params.flameWidthFactor;
    const h=this.flameHeightBase*this.params.flameHeightFactor;

    const radiusProfile=(y_norm)=>{
      let r=mix(0.50,0.28,clamp(this.params.taper,0.0,1.0));
      r+=this.params.bulge*smoothstep(0.0,0.35,0.35-Math.abs(y_norm-0.175))*0.35;
      r=mix(r,0.10,smoothstep(0.60,0.90,y_norm));
      const pinch=Math.pow(smoothstep(0.75,1.0,y_norm),mix(4.0,15.0,clamp(this.params.tear,0.0,1.0)));
      r=mix(r,0.0,pinch);
      return r*w;
    };

    const tmp=new THREE.Vector2();
    for(let i=0;i<pos.count;i++){
      const ov=this.initialVertices[i];
      const y0=ov.y;
      const y_norm=(y0 / -h);
      const curR=radiusProfile(y_norm);
      tmp.set(ov.x,ov.z);
      const ang=Math.atan2(tmp.y,tmp.x);
      tmp.set(y_norm*6.0, t*this.params.noiseSpeed);
      const wob=(fbm(tmp.clone())-0.5)*(0.35*this.params.turbulence*w);
      const ro=curR + wob;

      pos.setX(i, Math.cos(ang)*ro);
      pos.setZ(i, Math.sin(ang)*ro);
      pos.setY(i, y0*this.params.flameHeightFactor);

      if (y_norm < 0.05) {
        const f=smoothstep(0.05,0.0,y_norm);
        pos.setX(i,pos.getX(i)*f);
        pos.setZ(i,pos.getZ(i)*f);
      }
    }
    pos.needsUpdate=true;
    g.computeVertexNormals();
  }
}
