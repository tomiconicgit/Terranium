import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class DesktopFPV {
  constructor(camera, dom){
    this.cam = camera;
    this.dom = dom;
    this.vel = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.keys = {};
    addEventListener('keydown', e=>this.keys[e.key.toLowerCase()]=true);
    addEventListener('keyup',   e=>this.keys[e.key.toLowerCase()]=false);

    this.mDown=false; this.lx=0; this.ly=0;
    dom.addEventListener('mousedown',(e)=>{this.mDown=true; this.lx=e.clientX; this.ly=e.clientY;});
    addEventListener('mouseup',()=>this.mDown=false);
    addEventListener('mousemove',(e)=>{ if(!this.mDown) return;
      const dx=e.clientX-this.lx, dy=e.clientY-this.ly; this.lx=e.clientX; this.ly=e.clientY;
      this.yaw  -= dx*0.0025; this.pitch -= dy*0.0020; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    });

    this.speed = 3.6;
  }
  update(dt){
    const forward = (this.keys['w']||this.keys['arrowup'])?1:0;
    const back    = (this.keys['s']||this.keys['arrowdown'])?1:0;
    const left    = (this.keys['a']||this.keys['arrowleft'])?1:0;
    const right   = (this.keys['d']||this.keys['arrowright'])?1:0;

    const z = forward - back;
    const x = right - left;

    this.dir.set(x,0,-z);
    if (this.dir.lengthSq()>0) this.dir.normalize();

    // apply yaw to direction
    const c=Math.cos(this.yaw), s=Math.sin(this.yaw);
    const dx = this.dir.x*c - this.dir.z*s;
    const dz = this.dir.x*s + this.dir.z*c;

    this.vel.set(dx,0,dz).multiplyScalar(this.speed);
    this.cam.position.x += this.vel.x * dt;
    this.cam.position.z += this.vel.z * dt;

    // camera orientation
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // keep head at ~1.7m
    this.cam.position.y = 1.7;
  }
}