// src/world/Mapping.js
//
// Defines all static (baked) world objects that should load automatically
// when the scene initializes in Main.js.
//

export const worldObjects = [
  {
    name: "SuperHeavy",
    path: "src/assets/SuperHeavy.glb",
    position: { x: 17.4, y: 13.4, z: 0 },
    scale:    { x: 0.030, y: 0.030, z: 0.030 },
    rotation: { x: 0, y: 0, z: 0 }
  }
];

/**
 * Permanent baked flame offsets (relative to the rocket root).
 * These are consumed by Main.js when the SuperHeavy model loads.
 */
export const bakedFlames = [
  { index: 0, groupOffsetX:  3.10, groupOffsetY: -3.00, groupOffsetZ:  1.20 },
  { index: 1, groupOffsetX:  4.21, groupOffsetY: -3.00, groupOffsetZ:  5.79 },
  { index: 2, groupOffsetX:  6.49, groupOffsetY: -3.00, groupOffsetZ:  9.51 },
  { index: 3, groupOffsetX: 10.06, groupOffsetY: -3.00, groupOffsetZ: 12.51 },
  { index: 4, groupOffsetX: 14.23, groupOffsetY: -3.00, groupOffsetZ: 14.13 },
  { index: 5, groupOffsetX: 18.76, groupOffsetY: -3.00, groupOffsetZ: 14.49 },
  { index: 6, groupOffsetX: 23.17, groupOffsetY: -3.00, groupOffsetZ: 13.32 },
  { index: 7, groupOffsetX: 26.98, groupOffsetY: -3.00, groupOffsetZ: 11.04 },
  { index: 8, groupOffsetX: 29.89, groupOffsetY: -3.00, groupOffsetZ:  7.59 }
];