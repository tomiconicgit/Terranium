const defaults = {
  // Sky
  turbidity: 2.0, rayleigh: 1.2, mieCoefficient: 0.005, mieDirectionalG: 0.8,
  elevation: 6.0, azimuth: 180.0,

  // NEW:
  skyExposure: 0.6,          // how bright the dome looks
  lightingExposure: 1.5,     // how strong the sun/ambient are

  // (you can leave global tone mapping at 1.0)
  exposure: 1.0,

  // Stars...
  starCount: 10000, starSize: 1.6, starTwinkleSpeed: 0.9,

  // Terrain...
  terrainDisplacement: 0.55, terrainRoughness: 1.0,
  terrainRepeat: 48, terrainTint: '#ffffff',
  blendHeightMin: 0.0, blendHeightMax: 12.0, blendSlopeBias: 1.0,
  wLow: 1.0, wHigh: 0.7, wSlope: 0.8
};