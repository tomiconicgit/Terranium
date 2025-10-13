// src/materials/ProcPanel.js
import * as THREE from 'three';

/**
 * Procedural metal panel (no textures).
 * World-locked seams + optional bolt dots. Works for flats & walls.
 */
export function createMetalPanelMaterial({
  baseColor = 0x8fa2b3,   // steel tint
  metalness = 0.9,
  roughness = 0.35,
  panelSize = 1.0,        // world meters between seams
  seamWidth = 0.035,      // world meters
  seamDark  = 0.55,       // 1=none, 0=black
  bolts = true,
  boltRadius = 0.06,      // world meters (at panel corners)
  mode = 'flat'           // 'flat' | 'wall'
} = {}) {

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness,
    roughness
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCell       = { value: panelSize };
    shader.uniforms.uSeamWidth  = { value: seamWidth };
    shader.uniforms.uSeamDark   = { value: seamDark };
    shader.uniforms.uBoltR      = { value: bolts ? boltRadius : 0.0 };
    shader.uniforms.uIsWall     = { value: mode === 'wall' ? 1 : 0 };

    // pass world position & world normal
    shader.vertexShader =
      /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vWorldN;
      ` + shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        /* glsl */`
        #include <worldpos_vertex>
        vWorldPos = worldPosition.xyz;
        vWorldN   = normalize(mat3(modelMatrix) * normal);
        `
      );

    // helpers + panel logic
    shader.fragmentShader =
      /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vWorldN;
      uniform float uCell, uSeamWidth, uSeamDark, uBoltR;
      uniform int   uIsWall;

      // distance to nearest seam on a plane
      float seamMask(vec2 p){
        // p in world meters; seams every uCell
        float ax = abs(p.x - round(p.x / uCell) * uCell);
        float ay = abs(p.y - round(p.y / uCell) * uCell);
        float d = min(ax, ay);
        return smoothstep(uSeamWidth, 0.0, d); // 1 inside groove -> 0 far away
      }

      // distance to nearest corner (for bolt dot)
      float boltMask(vec2 p){
        vec2 q = fract(p / uCell);
        q = min(q, 1.0 - q);                // distance to nearest edges
        float dc = length(q * uCell);       // corner distance in meters
        return (uBoltR > 0.0) ? smoothstep(uBoltR + 0.01, uBoltR, dc) : 0.0;
      }

      // pick a 2D plane for seams based on surface orientation
      vec2 pickPlane(){
        vec3 an = abs(normalize(vWorldN));
        if (uIsWall == 1) {
          // for walls we prefer X/Y or Y/Z depending on which face
          if (an.z > an.x) return vec2(vWorldPos.x, vWorldPos.y); // facing Z
          else             return vec2(vWorldPos.z, vWorldPos.y); // facing X
        } else {
          // flats: use X/Z
          return vec2(vWorldPos.x, vWorldPos.z);
        }
      }
      ` + shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        /* glsl */`
        vec4 diffuseColor = vec4( diffuse, opacity );

        vec2 P = pickPlane();

        // grooves
        float s = seamMask(P);
        // bolt dots in corners
        float b = boltMask(P);

        // Darken in grooves & bolts
        float dark = max(s, b);
        diffuseColor.rgb *= mix(1.0, uSeamDark, clamp(dark, 0.0, 1.0));

        // Slightly rougher in grooves/bolts for realism
        roughnessFactor = clamp(roughnessFactor + 0.2 * dark, 0.0, 1.0);

        // Micro-brush: faint directional lines (pure math, no texture)
        float brush = 0.03 * sin( (P.x + P.y) * 12.0 );
        diffuseColor.rgb *= (1.0 - brush);
        `
      );
  };

  return mat;
}
