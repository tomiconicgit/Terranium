import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class DesktopFPV {
  constructor(camera, dom){
    this.cam = camera;
    this.dom = dom;
    this.speed = 6.0;
    this.run   = 1.8; // Shift multiplier
    this.vel = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.yaw=0; this.pitch=0;

    this.keys = Object.create(null);
    addEventListener('keydown',  e=> this.keys[e.code]=true);
    addEventListener('keyup',    e=> this.keys[e.code]=false);

    // mouse look (drag)
    let md=false, lx=0, ly=0;
    dom.addEventListener('mousedown', e=>{ md=true; lx=e.clientX; ly=e.clientY; });
    addEventListener('mouseup', ()=> md=false);
    addEventListener('mousemove', e=>{
      if(!md) return;
      const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
      this.yaw   -= dx*0.0035;
      this.pitch -= dy*0.0030;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    });

    // initial height
    this.cam.position.y = 1.7;
  }

  update(dt){
    const fwd = (this.keys['KeyW']||this.keys['ArrowUp']?1:0) - (this.keys['KeyS']||this.keys['ArrowDown']?1:0);
    const str = (this.keys['KeyD']||this.keys['ArrowRight']?1:0) - (this.keys['KeyA']||this.keys['ArrowLeft']?1:0);
    const spd = this.speed * (this.keys['ShiftLeft']||this.keys['ShiftRight'] ? this.run : 1.0);

    // rotate input into world space (yaw only)
    const c=Math.cos(this.yaw), s=Math.sin(this.yaw);
    const dx =  str*c - fwd*s;
    const dz =  str*s - fwd*c;

    this.cam.position.x += dx*spd*dt;
    this.cam.position.z += dz*spd*dt;
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.cam.position.y = 1.7; // keep head height
  }
}