// src/effects/EngineFX.js
// --- TRUE 3D CYLINDER SHAPE ---
// Renders a single, solid 3D cylinder geometry that is
// dynamically reshaped in real-time to form a teardrop flame
// and exhibit turbulence, eliminating the need for billboards.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// Helper for noise (from previous versions)
function n2(p){ return fract(Math.sin(p.dot(new THREE.Vector2(127.1,311.7))) * 43758.5453); }
function fbm(p){
  let a=0.0, w=0.5;
  for(let i=0;i<4;i++){ a+=w*n2(p); p.multiplyScalar(2.03).add(new THREE.Vector2(1.7,1.7)); w*=0.5; }
  return a;
}

export class EngineFX {
  constructor(rocketRoot, scene, camera) {
    this.rocket = rocketRoot;
    this.scene  = scene;
    this.camera = camera;

    this.flameWidthBase  = 3.5;
    this.flameHeightBase = 40.0;
    this.segments = 32; // Number of radial segments for the cylinder

    this.params = {
      enginesOn: false,
      flameWidthFactor:  1.0, flameHeightFactor: 1.0, flameYOffset: 0.0,
      intensity: 1.2, taper: 0.4, bulge: 0.1, tear: 0.85, turbulence: 0.2,
      noiseSpeed: 1.8, diamondsStrength: 0.4, diamondsFreq: 12.0,
      rimStrength: 0.3, rimSpeed: 2.8,
      colorCyan: 1.0, colorOrange: 1.0, colorWhite: 1.2,
      groupOffsetX: 0.0, groupOffsetY: 0.0, groupOffsetZ: 0.0
    };

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.mesh = this._makeFlameMesh();
    this.group.add(this.mesh);

    // Store initial vertices to calculate offsets from
    this.initialVertices = [];
    const posAttribute = this.mesh.geometry.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
      this.initialVertices.push(new THREE.Vector3().fromBufferAttribute(posAttribute, i));
    }
    this.originalPositionAttribute = posAttribute.clone(); // Keep a clean copy

    // The mesh itself will dynamically update its geometry in update()
    // No more billboarding logic needed on the group.

    this._applyTransforms();
    this._applyUniforms();
    this._applyVisibility();
  }

  // ----- Public API -----
  setIgnition(on){ this.params.enginesOn = !!on; this._applyVisibility(); }
  getIgnition(){ return this.params.enginesOn; }
  setParams(patch){ Object.assign(this.params, patch); this._applyTransforms(); this._applyUniforms(); }
  getParams(){ return { ...this.params }; }

  // --- MODIFIED ---
  // Now updates geometry in addition to time uniform
  update(delta, t){
    const mat = this.mesh?.material;
    if (mat?.uniforms) mat.uniforms.uTime.value = t;

    if (this.params.enginesOn) {
      this._updateFlameGeometry(t);
    }
  }

  // ----- Internals -----
  _applyVisibility(){ this.group.visible = !!this.params.enginesOn; }

  _applyTransforms(){
    this.group.position.set(
      0.0 + this.params.groupOffsetX,
      10.0 + this.params.groupOffsetY,
      0.0 + this.params.groupOffsetZ
    );
    // Scale is now handled by the geometry, not individual planes
    // So we just ensure the mesh is at identity scale.
    this.mesh.scale.set(1,1,1);
    this.mesh.position.y = this.params.flameYOffset; // Apply global Y offset
  }

  _applyUniforms(){
    const u = this.mesh?.material.uniforms; if (!u) return;
    u.uIntensity.value   = this.params.intensity; u.uTaper.value = this.params.taper;
    u.uBulge.value = this.params.bulge; u.uTear.value = this.params.tear;
    u.uTurb.value = this.params.turbulence; u.uNoiseSpeed.value = this.params.noiseSpeed;
    u.uDiamondsStrength.value = this.params.diamondsStrength; u.uDiamondsFreq.value = this.params.diamondsFreq;
    u.uRimStrength.value = this.params.rimStrength; u.uRimSpeed.value = this.params.rimSpeed;
    u.uCyanMul.value = this.params.colorCyan; u.uOrangeMul.value = this.params.colorOrange;
    u.uWhiteMul.value = this.params.colorWhite;
  }
  
  // --- NEW ---
  _makeFlameMesh(){
    // Create a cylinder geometry, with open ends, pointing downwards by default
    const radiusTop = 0.001; // Start very small at the nozzle (visually a point)
    const radiusBottom = 0.001; // Will be reshaped
    const height = this.flameHeightBase;
    const radialSegments = this.segments;
    const heightSegments = 20; // More segments for smoother teardrop/turbulence

    const geometry = new THREE.CylinderGeometry(
      radiusTop, radiusBottom, height, radialSegments, heightSegments,
      true // openEnded
    );

    // Translate the geometry so its top center is at (0,0,0)
    geometry.translate(0, -height / 2, 0);

    const material = this._makeFlameMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  // --- NEW ---
  _updateFlameGeometry(t) {
    const geometry = this.mesh.geometry;
    const positionAttribute = geometry.attributes.position;

    const w = this.flameWidthBase  * this.params.flameWidthFactor;
    const h = this.flameHeightBase * this.params.flameHeightFactor;

    // Radius profile function (similar to fragment shader, but for actual geometry)
    const radiusProfile = (y_norm) => { // y_norm: 0 at nozzle, 1 at tail
      let baseR = mix(0.50, 0.28, clamp(this.params.taper, 0.0, 1.0));
      let bulge = this.params.bulge * smoothstep(0.0, 0.35, 0.35 - Math.abs(y_norm-0.175)) * 0.35;
      let r = baseR + bulge;
      r = mix(r, 0.10, smoothstep(0.60, 0.90, y_norm));
      let pinch = Math.pow(smoothstep(0.75, 1.0, y_norm), mix(4.0, 15.0, clamp(this.params.tear, 0.0, 1.0)));
      r = mix(r, 0.0, pinch);
      return r * w; // Apply overall flame width factor here
    };

    const tempVec2 = new THREE.Vector2();

    for (let i = 0; i < positionAttribute.count; i++) {
      const originalVertex = this.initialVertices[i];
      const y_original = originalVertex.y; // Y value in the cylinder's local space (-height/2 to height/2)
      
      // Map y_original to a normalized [0,1] range (0 at nozzle, 1 at tail)
      const y_norm = 1.0 - ((y_original + (h / 2)) / h); // For downward flame

      const currentRadius = radiusProfile(y_norm);

      // Radial position and angle
      tempVec2.set(originalVertex.x, originalVertex.z);
      const angle = Math.atan2(tempVec2.y, tempVec2.x); // Angle around Y axis

      // Turbulence noise
      tempVec2.set(y_norm * 6.0, t * this.params.noiseSpeed);
      const wob = (fbm(tempVec2) - 0.5) * (0.35 * this.params.turbulence * w);

      // Apply radius + wobble
      const radialOffset = currentRadius + wob; // Wobble adds directly to radius

      // Update vertex position
      positionAttribute.setX(i, Math.cos(angle) * radialOffset);
      positionAttribute.setZ(i, Math.sin(angle) * radialOffset);
      positionAttribute.setY(i, y_original); // Y position remains based on original geometry height

      // Ensure the very top is a point, not a wide opening
      if (y_norm < 0.05) { // Close to the nozzle
        positionAttribute.setX(i, positionAttribute.getX(i) * smoothstep(0.05, 0.0, y_norm));
        positionAttribute.setZ(i, positionAttribute.getZ(i) * smoothstep(0.05, 0.0, y_norm));
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals(); // Important for shading
  }

  _makeFlameMaterial(){
    // The shader is simplified as shape is handled by geometry.
    // It will now primarily handle color, intensity, and translucency.
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms:{
        uTime: { value: 0.0 },
        uIntensity: { value: 1.2 },
        uDiamondsStrength: { value: 0.4 }, uDiamondsFreq: { value: 12.0 },
        uRimStrength: { value: 0.3 }, uRimSpeed: { value: 2.8 },
        uCyanMul:   { value: 1.0 }, uOrangeMul: { value: 1.0 }, uWhiteMul:  { value: 1.2 },
        uCyan:   { value: new THREE.Color(0x80fbfd) },
        uWhite:  { value: new THREE.Color(0xffffff) },
        uOrange: { value: new THREE.Color(0xffac57) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv_flame; // Custom UV: vUv_flame.y is 0 at nozzle, 1 at tail
        varying vec3 vNormal;

        void main(){
          vUv_flame = vec2(uv.x, 1.0 - (position.y + 20.0) / 40.0); // Assuming 40 base height, adjust as needed

          // Pass the vertex normal for lighting calculations (even if simplified)
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision mediump float;

        varying vec2 vUv_flame;
        varying vec3 vNormal; // Use normal for some basic shading

        uniform float uTime;
        uniform float uIntensity;
        uniform float uDiamondsStrength, uDiamondsFreq;
        uniform float uRimStrength, uRimSpeed;

        uniform float uCyanMul, uOrangeMul, uWhiteMul;
        uniform vec3  uCyan, uWhite, uOrange;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fbm(vec2 p){
          float a=0.0, w=0.5;
          for(int i=0;i<4;i++){ a+=w*n2(p); p=p*2.03+1.7; w*=0.5; }
          return a;
        }
        
        // Simplified radius calculation, mainly for rim and diamonds now
        float getFlameRadius(float y_local){
            // Using a simple profile for Mach diamonds/rim, shape is from geometry
            float r = mix(0.50, 0.28, y_local); // Basic taper
            return mix(r, 0.0, smoothstep(0.75, 1.0, y_local));
        }

        void main(){
          float y_local = vUv_flame.y; // 0 at nozzle, 1 at tail

          // Mach diamonds (visual effect on the surface)
          float bands = 0.5 + 0.5*sin(y_local*uDiamondsFreq*6.283);
          float diamonds = mix(1.0, bands, clamp(uDiamondsStrength,0.0,2.0));
          diamonds = mix(diamonds, 1.0, smoothstep(0.70, 1.0, y_local));

          // Color ramp (cyan core to orange tail)
          vec3 col = mix(uWhite*uWhiteMul, uCyan*uCyanMul, smoothstep(0.0, 0.25, y_local));
          col = mix(col, uOrange*uOrangeMul, smoothstep(0.3, 0.85, y_local));
          col *= diamonds; // Apply diamond banding to color

          // Soft fade-in at base (nozzle) and tail
          float alpha_fade = smoothstep(0.00, 0.06, y_local) * (1.0 - smoothstep(0.96, 1.00, y_local));

          // Basic rim/halo effect - this simulates the glow around the flame
          float viewAngleFactor = pow(max(0.0, dot(vNormal, normalize(cameraPosition - gl_FragCoord.xyz))), 1.5);
          float rim = smoothstep(0.0, 1.0, viewAngleFactor) * uRimStrength;
          float rimNoise = fbm(vec2(y_local * 10.0, uTime*uRimSpeed))*0.5+0.5;
          rim *= rimNoise;


          float alpha = (alpha_fade + rim) * uIntensity;
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `
    });
  }
}

// Utility functions for shader parameters
function clamp(value, min, max) { return Math.max(min, Math.min(value, max)); }
function mix(a, b, t) { return a * (1 - t) + b * t; }
function smoothstep(edge0, edge1, x) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}
