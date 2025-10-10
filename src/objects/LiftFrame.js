import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createLiftFrame(opts = {}){
  const {
    towerDim,              // { baseX, baseZ, width, length, height, launchDeckY }
    side='south',          // 'east' | 'south' | 'west' | 'north'
    gapFromTower=2.6,
    frameW=4.8, frameD=4.8,
    carW=4.0, carD=4.0, carH=2.5,
    doorH=2.4, doorY=1.2,
    steelColor=0xf0f2f5
  } = opts;
  if(!towerDim) throw new Error('createLiftFrame requires opts.towerDim');

  const steel = new THREE.MeshStandardMaterial({ color:steelColor, roughness:.48, metalness:.95 });
  const glow  = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:2.2, roughness:.7 });

  const g = new THREE.Group(); g.name='lift';
  const { baseX, baseZ, width, length, height, launchDeckY } = towerDim;

  // shaft center
  let shaftX=baseX, shaftZ=baseZ;
  if(side==='east')  shaftX = baseX + width/2  + gapFromTower + frameW/2;
  if(side==='west')  shaftX = baseX - width/2  - gapFromTower - frameW/2;
  if(side==='south') shaftZ = baseZ + length/2 + gapFromTower + frameD/2;
  if(side==='north') shaftZ = baseZ - length/2 - gapFromTower - frameD/2;

  // posts & rings
  const posts=new THREE.Group();
  const postG=new THREE.BoxGeometry(.4,height,.4);
  for(const [x,z] of [[-1,-1],[+1,-1],[-1,+1],[+1,+1]].map(([sx,sz])=>[
      shaftX + sx*frameW/2, shaftZ + sz*frameD/2 ])){
    const m=new THREE.Mesh(postG, steel); m.position.set(x, height/2, z); posts.add(m);
  }
  g.add(posts);
  for(let y=0;y<height;y+=3){
    const ring=new THREE.Mesh(new THREE.BoxGeometry(frameW+.6,.24,frameD+.6), steel);
    ring.position.set(shaftX, y+1.5, shaftZ); g.add(ring);
  }

  // entrance facing tower
  const facing = opposite(side);
  const onXFace = (facing==='east'||facing==='west');
  const faceSign = (facing==='east'||facing==='south')?+1:-1;
  const faceX = shaftX + (onXFace ? faceSign*(frameW/2-.02) : 0);
  const faceZ = shaftZ + (!onXFace ? faceSign*(frameD/2-.02) : 0);

  // ground gate leaves
  const gateW=2.4, gateT=.08;
  const gateL=new THREE.Mesh(new THREE.BoxGeometry(gateW/2,doorH,gateT), steel);
  const gateR=gateL.clone();
  if(onXFace){
    gateL.position.set(faceX,doorY,shaftZ-gateW/4);
    gateR.position.set(faceX,doorY,shaftZ+gateW/4);
    gateL.rotation.y = gateR.rotation.y = Math.PI/2;
  }else{
    gateL.position.set(shaftX-gateW/4,doorY,faceZ);
    gateR.position.set(shaftX+gateW/4,doorY,faceZ);
  }
  g.add(gateL,gateR);

  // call button
  const callBtn=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.04,16), glow);
  if(onXFace){ callBtn.rotation.z=Math.PI/2; callBtn.position.set(faceX-.2,1.35,shaftZ+gateW/2+.25); }
  else       { callBtn.rotation.x=Math.PI/2; callBtn.position.set(shaftX+gateW/2+.25,1.35,faceZ-.2); }
  g.add(callBtn);

  // cab
  const cab=new THREE.Group(); cab.name='liftCab';
  const box=new THREE.Mesh(new THREE.BoxGeometry(carW,carH,carD), steel);
  box.position.y=carH/2; cab.add(box);

  // cab panel
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.2,.5,.05), glow);
  if(onXFace){ const z=(facing==='north')?(-carD/2+.2):(carD/2-.2); panel.position.set(carW/2-.25,1.2,z); }
  else{ const x=(facing==='west')?(-carW/2+.25):(carW/2-.25); panel.position.set(x,1.2,carD/2-.2); }
  cab.add(panel);

  // sliding doors (entrance + opposite)
  const doorLeafW=1.2, doorT=.06;
  const entL=new THREE.Mesh(new THREE.BoxGeometry(doorLeafW,doorH,doorT), steel);
  const entR=entL.clone(), oppL=entL.clone(), oppR=entL.clone();
  if(onXFace){
    const zEnt=(facing==='north')?(-carD/2+doorT/2):(carD/2-doorT/2);
    const zOpp=-zEnt; entL.position.set(0,doorY,zEnt); entR.position.set(0,doorY,zEnt);
    oppL.position.set(0,doorY,zOpp);  oppR.position.set(0,doorY,zOpp);
  }else{
    const xEnt=(facing==='west')?(-carW/2+doorT/2):(carW/2-doorT/2);
    const xOpp=-xEnt; entL.position.set(xEnt,doorY,0); entR.position.set(xEnt,doorY,0);
    oppL.position.set(xOpp,doorY,0);  oppR.position.set(xOpp,doorY,0);
    entL.rotation.y=entR.rotation.y=oppL.rotation.y=oppR.rotation.y=Math.PI/2;
  }
  cab.add(entL,entR,oppL,oppR);
  const GROUND_Y = doorY;
  cab.position.set(shaftX, GROUND_Y, shaftZ); g.add(cab);

  const porch=new THREE.PointLight(0xffffff,.6,12,2); 
  if(onXFace) porch.position.set(faceX-.2,2.7,shaftZ+.1); else porch.position.set(shaftX,2.7,faceZ+.1);
  g.add(porch);

  // state
  const state = { phase:'idleBottom', tGate:1, tCabEnt:1, tCabOpp:0, speed:4.2, doorSpeed:2.2 };

  const setGate=(t)=>{
    const max=gateW/2;
    if(onXFace){ gateL.position.z = shaftZ-gateW/4 - t*max; gateR.position.z = shaftZ+gateW/4 + t*max; }
    else       { gateL.position.x = shaftX-gateW/4 - t*max; gateR.position.x = shaftX+gateW/4 + t*max; }
  };
  const setEnt=(t)=>{ const max=doorLeafW; if(onXFace){ entL.position.x=-t*max*.5; entR.position.x=+t*max*.5; }
                      else{ entL.position.z=-t*max*.5; entR.position.z=+t*max*.5; } };
  const setOpp=(t)=>{ const max=doorLeafW; if(onXFace){ oppL.position.x=-t*max*.5; oppR.position.x=+t*max*.5; }
                      else{ oppL.position.z=-t*max*.5; oppR.position.z=+t*max*.5; } };
  setGate(state.tGate); setEnt(state.tCabEnt); setOpp(state.tCabOpp);

  let wantPress=false;
  addEventListener('keydown', e=>{ if(e.key?.toLowerCase()==='e') wantPress=true; }, {passive:true});
  addEventListener('pointerdown', ()=>{ wantPress=true; }, {passive:true});

  const callPos=new THREE.Vector3(callBtn.position.x,callBtn.position.y,callBtn.position.z);
  const panelLocal=new THREE.Vector3(panel.position.x,panel.position.y,panel.position.z);

  g.userData.update=(dt,_t,{player}={})=>{
    if(!player) return;
    callPos.set(callBtn.position.x,callBtn.position.y,callBtn.position.z);
    const panelWorld = panelLocal.clone().applyMatrix4(cab.matrixWorld);
    const near=(p,r)=> player.mesh.position.distanceTo(p)<=r;

    if(wantPress){
      if(near(callPos,1.3)){ if(state.phase==='idleTop') state.phase='closingTop';
                             else if(state.phase==='idleBottom') state.phase='openingGround'; }
      if(near(panelWorld,1.1)){ if(state.phase==='idleBottom') state.phase='closingGround';
                                else if(state.phase==='idleTop') state.phase='closingTop'; }
    }
    wantPress=false;

    if(state.phase==='idleBottom'){ state.tGate=1; state.tCabEnt=1; state.tCabOpp=0; setGate(1); setEnt(1); setOpp(0); }
    else if(state.phase==='openingGround'){ state.tGate=Math.min(1,state.tGate+dt*state.doorSpeed);
      state.tCabEnt=Math.min(1,state.tCabEnt+dt*state.doorSpeed); setGate(state.tGate); setEnt(state.tCabEnt);
      if(state.tGate>=1 && state.tCabEnt>=1) state.phase='idleBottom'; }
    else if(state.phase==='closingGround'){ state.tGate=Math.max(0,state.tGate-dt*state.doorSpeed);
      state.tCabEnt=Math.max(0,state.tCabEnt-dt*state.doorSpeed); setGate(state.tGate); setEnt(state.tCabEnt);
      if(state.tGate<=0 && state.tCabEnt<=0) state.phase='movingUp'; }
    else if(state.phase==='movingUp'){ const dy=launchDeckY - cab.position.y; const step=Math.sign(dy)*state.speed*dt;
      if(Math.abs(step)>=Math.abs(dy)){ cab.position.y=launchDeckY; state.phase='openingTop'; } else cab.position.y+=step;
      state.tCabOpp=0; setOpp(0); }
    else if(state.phase==='openingTop'){ state.tCabOpp=Math.min(1,state.tCabOpp+dt*state.doorSpeed); setOpp(state.tCabOpp);
      if(state.tCabOpp>=1) state.phase='idleTop'; }
    else if(state.phase==='closingTop'){ state.tCabOpp=Math.max(0,state.tCabOpp-dt*state.doorSpeed); setOpp(state.tCabOpp);
      if(state.tCabOpp<=0) state.phase='movingDown'; }
    else if(state.phase==='movingDown'){ const dy=doorY - cab.position.y; const step=Math.sign(dy)*state.speed*dt;
      if(Math.abs(step)>=Math.abs(dy)){ cab.position.y=doorY; state.phase='openingGround'; } else cab.position.y+=step; }
  };

  g.userData.placement = { side, shaftX, shaftZ, frameW, frameD };
  g.userData.launchDeckY = launchDeckY;
  return g;
}
function opposite(s){ if(s==='east')return'west'; if(s==='west')return'east'; if(s==='north')return'south'; return'north'; }