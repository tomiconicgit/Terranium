// src/effects/FlameDefaults.js
// Single source of truth for flame design + helpers.

export const DEFAULT_FLAME_PARAMS = Object.freeze({
  // Authoring / state
  enginesOn: false,

  // Shape & motion
  flameWidthFactor: 0.60,
  flameHeightFactor: 1.00,
  flameYOffset: 7.60,

  intensity: 1.30,
  taper: 0.46,
  bulge: 2.09,
  tear: 1.00,
  turbulence: 0.52,
  noiseSpeed: 1.32,

  diamondsStrength: 0.89,
  diamondsFreq: 3.00,
  orangeShift: -0.34,

  rimStrength: 0.00,
  rimSpeed: 4.10,

  // Color multipliers
  colorCyan: 1.39,
  colorOrange: 1.81,
  colorWhite: 1.43,

  // Base colors (hex)
  colorWhiteHex:  '#FFECD4',
  colorCyanHex:   '#FF8648',
  colorOrangeHex: '#DA5100',

  // Offsets (editable flame defaults only; instances use their baked list)
  groupOffsetX: 3.1,
  groupOffsetY: -3.0,
  groupOffsetZ: 1.2,

  // Tail / nozzle fades
  tailFadeStart: 0.46,  // <<< updated
  tailFeather:   3.68,  // <<< updated
  tailNoise:     0.00,
  bottomFadeDepth:   0.14,
  bottomFadeFeather: 1.00,

  // Lighting (kept for future use)
  lightIntensity: 50.0,
  lightDistance: 800.0,
  lightColor: '#ffb869'
});

export function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_FLAME_PARAMS));
}

// Normalize and push color + scalar params to a shader's uniforms.
export function applyParamsToUniforms(uniforms, p) {
  if (!uniforms) return;
  uniforms.uIntensity.value        = p.intensity;
  uniforms.uDiamondsStrength.value = p.diamondsStrength;
  uniforms.uDiamondsFreq.value     = p.diamondsFreq;
  uniforms.uRimStrength.value      = p.rimStrength;
  uniforms.uRimSpeed.value         = p.rimSpeed;
  uniforms.uCyanMul.value          = p.colorCyan;
  uniforms.uOrangeMul.value        = p.colorOrange;
  uniforms.uWhiteMul.value         = p.colorWhite;
  uniforms.uTailStart.value        = p.tailFadeStart;
  uniforms.uTailFeather.value      = p.tailFeather;
  uniforms.uTailNoise.value        = p.tailNoise;
  uniforms.uBottomDepth.value      = p.bottomFadeDepth;
  uniforms.uBottomFeather.value    = p.bottomFadeFeather;
  uniforms.uOrangeShift.value      = p.orangeShift;

  try { uniforms.uWhite.value.set(p.colorWhiteHex); } catch {}
  try { uniforms.uCyan.value.set(p.colorCyanHex); }   catch {}
  try { uniforms.uOrange.value.set(p.colorOrangeHex);} catch {}
}