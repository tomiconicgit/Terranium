import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export const PARTS = [
  { id:'sand',     kind:'cube',   color:0xe4d3a5, label:'Sand' },
  { id:'grass',    kind:'cube',   color:0x5da24d, label:'Grass' },
  { id:'concrete', kind:'cube',   color:0xa9b0b7, label:'Concrete' },
  { id:'metal',    kind:'cube',   color:0x8c99a6, label:'Metal' },
  { id:'ironW',    kind:'cube',   color:0xf0f2f5, label:'Iron (white)' },
  { id:'asphalt',  kind:'cube',   color:0x25272b, label:'Asphalt' },

  { id:'slabC',    kind:'slab',   color:0xa9b0b7, label:'Slab Concrete' },
  { id:'slabS',    kind:'slab',   color:0xe4d3a5, label:'Slab Sand' },
  { id:'slabG',    kind:'slab',   color:0x5da24d, label:'Slab Grass' },

  { id:'pipe',     kind:'pipe',   color:0xc8c59e, label:'Pipe' },
  { id:'wire',     kind:'wire',   color:0xdddddd, label:'Wire' },
  { id:'glass',    kind:'glass',  color:0x7fa0c4, label:'Window' },
];

export class Builder {
  constructor(scene, camera, groundRayMesh){
    this.scene = scene; this.camera = camera;
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0,0); // reticle center
    this.ground = groundRayMesh;

    this.placed = []; // {_mesh,id,kind,x,y,z,rot}
    this._activeId = 'concrete';

    // hover box
    this.hover = new THREE.Mesh(
      new THREE.BoxGeometry(1.01,1.01,1.01),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.15 })
    );
    this.hover.visible=false; this.scene.add(this.hover);

    // CONTROLLER ONLY:
    this.prevButtons = [];
    this.ui = null;
  }

  setUI(ui){ this.ui = ui; }
  setActive(id){ this._activeId = id; }
  getActive(){ return this._activeId; }

  _intersections(){
    const objs = [this.ground, ...this.placed.map(p=>p._mesh)];
    this.mouse.set(0,0);
    this.ray.setFromCamera(this.mouse, this.camera);
    return this.ray.intersectObjects(objs, false);
  }

  updateHover(){
    const hit = this._intersections()[0];
    if(!hit){ this.hover.visible=false; return; }

    let pos = new THREE.Vector3();
    if (hit.object === this.ground){
      const gx = Math.floor(hit.point.x)+0.5;
      const gz = Math.floor(hit.point.z)+0.5;
      pos.set(gx, 0.5, gz);
    } else {
      const normal = hit.face.normal.clone().round();
      pos.copy(hit.object.position).add(normal);
      if (hit.object.userData.kind==='slab' && normal.y===0){
        pos.y = Math.round(pos.y*4)/4;
      }
    }
    this.hover.position.copy(pos);
    this.hover.visible = true;
  }

  place(){
    if(!this.hover.visible) return;
    const def = PARTS.find(p=>p.id===this._activeId);
    if(!def) return;

    let mesh, y=this.hover.position.y;
    if (def.kind==='cube'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.9, metalness:.05 }));
    } else if (def.kind==='slab'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,0.25,1),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.95, metalness:.03 }));
      y = Math.round((y-0.125)*4)/4 + 0.125;
    } else if (def.kind==='pipe'){
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1,12),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.75, metalness:.6 }));
      mesh.rotation.z = Math.PI/2;
    } else if (def.kind==='wire'){
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1,10),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:1, metalness:0 }));
      mesh.rotation.z = Math.PI/2;
    } else if (def.kind==='glass'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,0.05),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.2, metalness:0, transparent:true, opacity:.55 }));
    }

    mesh.position.set(this.hover.position.x, y, this.hover.position.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.kind = def.kind;
    this.scene.add(mesh);

    this.placed.push({ id:def.id, kind:def.kind, x:mesh.position.x, y:mesh.position.y, z:mesh.position.z, rot:mesh.rotation.toArray(), _mesh:mesh });
  }

  remove(){
    const hit = this._intersections()[0];
    if (!hit || hit.object===this.ground) return;
    const idx = this.placed.findIndex(p=>p._mesh===hit.object);
    if (idx>=0){
      const m = this.placed[idx]._mesh;
      this.scene.remove(m);
      m.geometry.dispose(); if (m.material?.dispose) m.material.dispose();
      this.placed.splice(idx,1);
    }
  }

  exportJSON(){
    return JSON.stringify(this.placed.map(({_mesh, ...rest})=>rest), null, 2);
  }

  _pollGamepadButtons(){
    const gp = navigator.getGamepads?.()[0];
    if (!gp) return;
    const b = gp.buttons;
    const pressed = i => !!(b[i] && b[i].pressed);
    const edge = i => pressed(i) && !this.prevButtons[i];

    if (edge(7)) this.place();                  // R2
    if (edge(6)) this.remove();                 // L2
    if (edge(5)) this.ui?.selectByOffset?.(+1); // R1
    if (edge(4)) this.ui?.selectByOffset?.(-1); // L1

    this.prevButtons = b.map(x=>x?.pressed);
  }

  update(){
    this._pollGamepadButtons();
    this.updateHover();
  }
}