import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export class MobileFPV {
  constructor(camera, joyEl){
    this.cam=camera; this.yaw=0; this.pitch=0; this.speed=3.0;
    // move.x = strafe (left -1 … right +1)
    // move.y = forward (back -1 … forward +1)
    this.move=new THREE.Vector2();

    this.joy = nipplejs.create({
      zone: joyEl, mode:'static', position:{left:'50%',top:'50%'}, color:'blue'
    });
    // nipple angle: 0 = right, PI/2 = up. We want up = forward(+1).
    this.joy.on('move',(_,d)=>{
      const a = d.angle?.radian ?? 0;
      const strafe  = Math.cos(a);
      const forward = Math.sin(a);
      this.move.set(strafe, forward);
    });
    this.joy.on('end',()=>this.move.set(0,0));

    let tid=null, sx=0, sy=0;
    addEventListener('touchstart',e=>{
      for(const t of e.changedTouches){
        if (!joyEl.contains(document.elementFromPoint(t.clientX,t.clientY))){
          tid=t.identifier; sx=t.clientX; sy=t.clientY; break;
        }
      }
    }, {passive:false});
    addEventListener('touchmove',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===tid){
          e.preventDefault();
          const dx=t.clientX-sx, dy=t.clientY-sy; sx=t.clientX; sy=t.clientY;
          this.yaw  -= dx*0.004; this.pitch -= dy*0.004; this.pitch=Math.max(-1.55,Math.min(1.55,this.pitch));
        }
      }
    }, {passive:false});
    addEventListener('touchend',e=>{ for(const t of e.changedTouches) if(t.identifier===tid) tid=null; }, {passive:true});
  }

  update(dt){
    // Transform: strafe = move.x, forward = move.y along -Z when yaw=0
    const c=Math.cos(this.yaw), s=Math.sin(this.yaw);
    const dx =  this.move.x*c - this.move.y*s;
    const dz =  this.move.x*s - this.move.y*c; // minus so forward moves toward -Z at yaw=0

    this.cam.position.x += dx*this.speed*dt;
    this.cam.position.z += dz*this.speed*dt;

    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.cam.position.y = 1.7;
  }
}