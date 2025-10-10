import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createTowerFrame(opts = {}){
  const {
    baseX=-20, baseZ=4, height=46, outerW=12, outerL=12,
    frameSize=0.9, deckEvery=8, windowBandH=1.2,
    brightSteel=0xf0f2f5, cladColor=0x8d97a3, glassColor=0x7fa0c4
  } = opts;

  const steel = new THREE.MeshStandardMaterial({ color: brightSteel, roughness:.48, metalness:.95 });
  steel.onBeforeCompile = (s)=>{
    s.vertexShader = 'varying vec3 vWPos;\n' + s.vertexShader.replace(
      '#include <worldpos_vertex>','#include <worldpos_vertex>\n vWPos = worldPosition.xyz;');
    s.fragmentShader = `
      varying vec3 vWPos; float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); float a=h2(i),b=h2(i+vec2(1,0)),c=h2(i+vec2(0,1)),d=h2(i+vec2(1,1));
        vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
    ` + s.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      vec3 tint = diffuse.rgb; tint *= (0.985 + n2(vWPos.xz*.15)*.015) * (0.99 + n2(vWPos.xz*3.)*.01);
      vec4 diffuseColor = vec4(tint, opacity);`);
  };
  const clad  = new THREE.MeshStandardMaterial({ color:cladColor,  roughness:.72, metalness:.6 });
  const glass = new THREE.MeshStandardMaterial({ color:glassColor, roughness:.25, metalness:.05,
                                                 emissive:0x2a4058, emissiveIntensity:.35 });
  const glow  = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:2.1, roughness:.7 });

  const t = new THREE.Group(); t.name='tower'; t.position.set(baseX,0,baseZ);
  const halfW=outerW/2, halfL=outerL/2;

  // base foot
  const foot = new THREE.Mesh(new THREE.BoxGeometry(outerW+1.2, .35, outerL+1.2), steel);
  foot.position.set(0, .175, 0); t.add(foot);

  // columns
  const colG = new THREE.BoxGeometry(frameSize, height, frameSize);
  for(const [x,z] of [[-halfW,-halfL],[halfW,-halfL],[-halfW,halfL],[halfW,halfL]]){
    const m=new THREE.Mesh(colG, steel); m.position.set(x, height/2, z); t.add(m);
  }
  // rings
  for(let h=3; h<height; h+=3){
    const ring=new THREE.Mesh(new THREE.BoxGeometry(outerW+frameSize, frameSize*.4, outerL+frameSize), steel);
    ring.position.set(0,h,0); t.add(ring);
  }

  const inset=.35, panelT=.12;
  const panel=(side,y,h,mat)=>{
    if(side==='N'||side==='S'){
      const w=outerW-inset*2; const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,panelT), mat);
      m.position.set(0,y,(side==='N'? +halfL-panelT*.5 : -halfL+panelT*.5)); t.add(m);
    } else {
      const w=outerL-inset*2; const m=new THREE.Mesh(new THREE.BoxGeometry(panelT,h,w), mat);
      m.position.set((side==='E'? +halfW-panelT*.5 : -halfW+panelT*.5), y, 0); t.add(m);
    }
  };
  const win=(side,y,h)=>{
    if(side==='N'||side==='S'){
      const w=outerW-inset*2-.1; const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,panelT*.55), glass);
      m.position.set(0,y,(side==='N'? +halfL-panelT*.55 : -halfL+panelT*.55)); t.add(m);
    } else {
      const w=outerL-inset*2-.1; const m=new THREE.Mesh(new THREE.BoxGeometry(panelT*.55,h,w), glass);
      m.position.set((side==='E'? +halfW-panelT*.55 : -halfW+panelT*.55), y, 0); t.add(m);
    }
  };

  const deckG = new THREE.BoxGeometry(outerW-1.6, .24, outerL-1.6);
  for(let y=deckEvery; y<height-2; y+=deckEvery){
    const deck=new THREE.Mesh(deckG, steel); deck.position.set(0,y,0); t.add(deck);
    // edge strips
    const strip=(len,alongX,sign)=>{ const s=new THREE.Mesh(new THREE.BoxGeometry(1,.06,.06), glow);
      s.scale.set(alongX?len:1,1,alongX?1:len); s.position.set(alongX?0:sign*(halfW-.2), y+.12, alongX?sign*(halfL-.2):0); t.add(s); };
    strip(outerW-1.8,true,+1); strip(outerW-1.8,true,-1); strip(outerL-1.8,false,+1); strip(outerL-1.8,false,-1);
    // small points
    for(const [dx,dz] of [[+1,0],[-1,0],[0,+1],[0,-1]]){ const L=new THREE.PointLight(0xffffff,.55,16,2.2);
      L.position.set(dx*(halfW-.25), y+.6, dz*(halfL-.25)); t.add(L); }
    // band
    const mid=y+deckEvery/2, capH=(deckEvery-.24-windowBandH)*.5;
    for(const s of ['N','S','E','W']){ panel(s, mid+(windowBandH*.5+capH*.5), capH, clad);
      panel(s, mid-(windowBandH*.5+capH*.5), capH, clad); win(s, mid, windowBandH); }
  }

  const pipeMat=new THREE.MeshStandardMaterial({ color:0xc8c59e, roughness:.9, metalness:.2 });
  const vG=new THREE.CylinderGeometry(.11,.11,height-1,10);
  const pA=new THREE.Mesh(vG, pipeMat); pA.position.set( halfW-.6,(height-1)/2, +1.8);
  const pB=pA.clone(); pB.position.z=-1.8; const pC=pA.clone(); pC.position.x=-halfW+.6;
  const pD=pC.clone(); pD.position.z=-1.8; t.add(pA,pB,pC,pD);

  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,5,12), steel); mast.position.set(0,height+2.5,0);
  const whip=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,6,8), steel);  whip.position.set(0,height+8.5,0);
  t.add(mast,whip);

  const launchDeckY = Math.round((31 / deckEvery)) * deckEvery;
  t.userData.dim = { baseX, baseZ, width:outerW, length:outerL, height, launchDeckY };
  return t;
}