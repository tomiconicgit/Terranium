import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

// Library of placeable parts
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
    this.mouse = new THREE.Vector2();
    this.ground = groundRayMesh; this.scene.add(this.ground);

    // store placed pieces
    this.placed = []; // {id,x,y,z,rot:[0|1|2|3],kind}
    this.activeId = 'concrete';

    // visual hover
    this.hover = new THREE.Mesh(new THREE.BoxGeometry(1.01,1.01,1.01),
                                new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.15 }));
    this.hover.visible=false; this.scene.add(this.hover);

    // pointer
    addEventListener('pointermove', e=>{ this.mouse.x=(e.clientX/innerWidth)*2-1; this.mouse.y=-(e.clientY/innerHeight)*2+1; });
    addEventListener('contextmenu', e=>e.preventDefault());
    addEventListener('pointerdown', e=>{
      if (e.button===2) this.remove();
      else this.place();
    }, {passive:true});
    // long-press remove on mobile
    let t; addEventListener('pointerdown', ()=>{ t=setTimeout(()=>this.remove(),500); });
    addEventListener('pointerup',   ()=>clearTimeout(t));
  }

  setActive(id){ this.activeId = id; }

  // cast to blocks (placed) and ground
  _intersections(){
    const objs = [this.ground, ...this.placed.map(p=>p._mesh)];
    this.ray.setFromCamera(this.mouse, this.camera);
    return this.ray.intersectObjects(objs, false);
  }

  updateHover(){
    const hit = this._intersections()[0];
    if(!hit){ this.hover.visible=false; return; }
    let pos;
    if (hit.object === this.ground){
      // snap to top of ground at integer coords
      const gx = Math.floor(hit.point.x)+0.5;
      const gz = Math.floor(hit.point.z)+0.5;
      pos = new THREE.Vector3(gx, 0.5, gz);
    } else {
      // snap to the face we hit
      const np = hit.face.normal.clone().round(); // axis
      pos = hit.object.position.clone().add(np);
      if (hit.object.userData.kind === 'slab' && np.y === 0){
        // if placing adjacent to a slab horizontally, align heights to 0.25 steps
        pos.y = Math.round(pos.y*4)/4;
      }
    }
    this.hover.position.copy(pos);
    this.hover.visible = true;
  }

  place(){
    if(!this.hover.visible) return;
    const def = PARTS.find(p=>p.id===this.activeId);
    if(!def) return;

    let mesh, y = this.hover.position.y;
    if (def.kind==='cube'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.9, metalness:.05 }));
    } else if (def.kind==='slab'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,0.25,1),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.95, metalness:.03 }));
      y = Math.round((y-0.125)*4)/4 + 0.125; // center on 0.25 grid
    } else if (def.kind==='pipe'){
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1,12),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.75, metalness:.6 }));
      mesh.rotation.z = Math.PI/2; // default along X
    } else if (def.kind==='wire'){
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1,10),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:1, metalness:0 }));
      mesh.rotation.z = Math.PI/2;
    } else if (def.kind==='glass'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,0.05),
        new THREE.MeshStandardMaterial({ color:def.color, roughness:.2, metalness:.0, transparent:true, opacity:.55 }));
      // snap thin windows: if placing against a face, center there
      // already handled by hover against another block
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
      this.scene.remove(this.placed[idx]._mesh);
      this.placed[idx]._mesh.geometry.dispose();
      if (this.placed[idx]._mesh.material?.dispose) this.placed[idx]._mesh.material.dispose();
      this.placed.splice(idx,1);
    }
  }

  exportJSON(){
    // strip _mesh
    return JSON.stringify(this.placed.map(({_mesh, ...rest})=>rest), null, 2);
  }
}