import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

/**
 * Controller-only FPV.
 * - Left stick: move (axes 0,1)
 * - Right stick: look (axes 2,3)
 * - Deadzone + smoothing
 */
export class GamepadFPV {
  constructor(camera){
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0;

    this.speed = 4.5;       // m/s walk
    this.runMult = 1.0;     // (keep 1.0; you can map a button later)
    this.lookSens = 2.0;    // deg per frame @ full deflection
    this.dead = 0.14;       // stick deadzone
    this.smooth = 0.18;     // lerp factor

    this.lx=0; this.ly=0; this.rx=0; this.ry=0;
    this.cam.position.y = 1.7;
  }

  _readAxes(){
    const gp = navigator.getGamepads?.()[0];
    if (!gp) { this.lx=this.ly=this.rx=this.ry=0; return; }
    const ax = gp.axes || [];
    const raw = (i)=> ax[i] ?? 0;

    // Apply radial deadzone
    const dz = (x)=> Math.abs(x) < this.dead ? 0 : ( (Math.abs(x)-this.dead) / (1-this.dead) ) * Math.sign(x);

    const lx = dz(raw(0));
    const ly = dz(raw(1));
    const rx = dz(raw(2));
    const ry = dz(raw(3));

    // simple smoothing
    const lerp=(a,b,t)=> a+(b-a)*t;
    this.lx = lerp(this.lx, lx, this.smooth);
    this.ly = lerp(this.ly, ly, this.smooth);
    this.rx = lerp(this.rx, rx, this.smooth);
    this.ry = lerp(this.ry, ry, this.smooth);
  }

  update(dt){
    this._readAxes();

    // Look: convert to radians per second-ish
    this.yaw   -= this.rx * this.lookSens * dt;
    this.pitch -= this.ry * this.lookSens * dt;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));

    // Move: yaw rotate
    const c=Math.cos(this.yaw), s=Math.sin(this.yaw);
    const strafe = this.lx;
    const forward= -this.ly; // up on stick = forward

    const dx =  strafe*c - forward*s;
    const dz =  strafe*s - forward*c;

    const spd = this.speed * this.runMult;
    this.cam.position.x += dx*spd*dt;
    this.cam.position.z += dz*spd*dt;
    this.cam.position.y = 1.7;

    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}