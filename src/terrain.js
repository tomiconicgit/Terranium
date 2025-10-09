// ultra-simple procedural terrain (no textures / webgl only)
import * as THREE from 'three';

export function createTerrain() {
  // -------------- Params (defaults) --------------
  const params = {
    size: 50,            // width & depth
    segments: 128,       // grid density
    height: 6,           // max displacement
    scale: 0.04,         // noise scale (bigger = finer detail)
    octaves: 4,
    lacunarity: 2.0,
    persistence: 0.5,
    colorLow: '#dfe5ee',
    colorMid: '#bfc7d3',
    colorHigh: '#9aa3b1',
    midPoint: 0.45,
    wireframe: false
  };

  // -------------- Noise GLSL --------------
  const NOISE = `
  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                             dot(x12.zw,x12.zw)), 0.0);
    m = m*m ; m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  `;

  // -------------- Shader + uniforms --------------
  const uniforms = {
    uHeight:       { value: params.height },
    uScale:        { value: params.scale },
    uOctaves:      { value: params.octaves },
    uLacunarity:   { value: params.lacunarity },
    uPersistence:  { value: params.persistence },
    uColorLow:     { value: new THREE.Color(params.colorLow) },
    uColorMid:     { value: new THREE.Color(params.colorMid) },
    uColorHigh:    { value: new THREE.Color(params.colorHigh) },
    uMidPoint:     { value: params.midPoint }
  };

  const vert = `
    ${NOISE}
    uniform float uHeight;
    uniform float uScale;
    uniform float uOctaves;
    uniform float uLacunarity;
    uniform float uPersistence;

    varying float vH;

    float fbm(vec2 p){
      float amp = 0.5;
      float freq = 1.0;
      float sum = 0.0;
      for (int i=0; i<12; i++){
        if(float(i) >= uOctaves) break;
        sum += amp * snoise(p * freq);
        freq *= uLacunarity;
        amp *= uPersistence;
      }
      return sum;
    }

    void main(){
      vec3 pos = position;
      float n = fbm(pos.xz * uScale); // roughly [-1,1]
      n = n * 0.5 + 0.5;              // 0..1
      pos.y += n * uHeight;
      vH = n;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const frag = `
    uniform vec3 uColorLow;
    uniform vec3 uColorMid;
    uniform vec3 uColorHigh;
    uniform float uMidPoint;
    varying float vH;

    void main(){
      vec3 col;
      if (vH < uMidPoint) {
        float t = clamp(vH / max(0.0001, uMidPoint), 0.0, 1.0);
        col = mix(uColorLow, uColorMid, t);
      } else {
        float t = clamp((vH - uMidPoint) / max(0.0001, (1.0 - uMidPoint)), 0.0, 1.0);
        col = mix(uColorMid, uColorHigh, t);
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    wireframe: params.wireframe,
    fog: true
  });

  function makeMesh(size, segs) {
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI/2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  let mesh = makeMesh(params.size, params.segments);

  function rebuild() {
    const parent = mesh.parent;
    if (parent) parent.remove(mesh);
    mesh.geometry.dispose();
    mesh = makeMesh(params.size, params.segments);
    if (parent) parent.add(mesh);
  }

  // -------------- Public API --------------
  return {
    mesh,

    setSize(v){ params.size = Math.max(5, v|0); rebuild(); },
    setSegments(v){ params.segments = Math.max(1, v|0); rebuild(); },
    setHeight(v){ params.height = Math.max(0, v); uniforms.uHeight.value = params.height; },
    setScale(v){ params.scale = Math.max(0.00001, v); uniforms.uScale.value = params.scale; },
    setOctaves(v){ params.octaves = Math.max(1, Math.min(12, v|0)); uniforms.uOctaves.value = params.octaves; },
    setLacunarity(v){ params.lacunarity = Math.max(0.5, v); uniforms.uLacunarity.value = params.lacunarity; },
    setPersistence(v){ params.persistence = Math.max(0.1, Math.min(0.99, v)); uniforms.uPersistence.value = params.persistence; },
    setColors(low, mid, high){
      uniforms.uColorLow.value.set(low);
      uniforms.uColorMid.value.set(mid);
      uniforms.uColorHigh.value.set(high);
    },
    setMidPoint(v){ uniforms.uMidPoint.value = Math.max(0.01, Math.min(0.99, v)); },
    setWireframe(on){ material.wireframe = !!on; },

    _getParams(){ return { ...params }; }
  };
}