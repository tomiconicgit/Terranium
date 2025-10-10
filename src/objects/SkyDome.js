import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
export function createSkyDome(){
  const geom=new THREE.SphereGeometry(500,32,16);
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide,
    uniforms:{ topColor:{value:new THREE.Color(0x94c0ff)}, bottomColor:{value:new THREE.Color(0xcfe8ff)} },
    vertexShader:`varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz;
      gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`varying vec3 vW; uniform vec3 topColor; uniform vec3 bottomColor;
      void main(){ float h=normalize(vW).y*.5+.5; vec3 col=mix(bottomColor, topColor, pow(h,1.5));
      gl_FragColor=vec4(col,1.0); }`
  });
  return new THREE.Mesh(geom,mat);
}