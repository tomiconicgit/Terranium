// src/effects/FlameShader.js
// Contains the shared GLSL fragment shader code for all flame effects.

export const FlameFragmentShader = `
  precision mediump float;
  varying float y_norm;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uDiamondsStrength;
  uniform float uDiamondsFreq;
  uniform float uRimStrength;
  uniform float uRimSpeed;
  uniform float uCyanMul;
  uniform float uOrangeMul;
  uniform float uWhiteMul;
  uniform vec3  uCyan;
  uniform vec3  uWhite;
  uniform vec3  uOrange;
  uniform float uTailStart;
  uniform float uTailFeather;
  uniform float uTailNoise;
  uniform float uBottomDepth;
  uniform float uBottomFeather;
  uniform float uOrangeShift;

  float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float fbm(vec2 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; } return a; }

  void main(){
    float bands = 0.5 + 0.5 * sin(y_norm * uDiamondsFreq * 6.2831853);
    float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
    diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_norm));

    vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0,0.25,y_norm));
    float o0 = 0.30 + uOrangeShift;
    float o1 = 0.85 + uOrangeShift;
    col = mix(col, uOrange*uOrangeMul, smoothstep(o0,o1,y_norm));
    col *= diamonds;

    float tail = 1.0 - smoothstep(uTailStart, 1.0, y_norm);
    tail = pow(max(tail,0.0), max(uTailFeather,0.0001));
    float tailJitter = (fbm(vec2(y_norm*18.0, uTime*1.3)) - 0.5) * uTailNoise;
    float alphaTail  = clamp(tail + tailJitter, 0.0, 1.0);

    float bottom = smoothstep(0.0, max(uBottomDepth, 1e-5), y_norm);
    bottom = pow(bottom, max(uBottomFeather, 0.0001));

    float rim = fbm(vec2(y_norm*10.0, uTime*uRimSpeed)) * uRimStrength;

    float alpha = (alphaTail * bottom + rim) * uIntensity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;
