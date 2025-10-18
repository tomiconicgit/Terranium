// src/world/BakedFlames.js
// Master list of baked flame offsets used by InstancedFlames.
// Note: "index" is informational; InstancedFlames uses array order only.

export const bakedFlameOffsets = [
  // --- First 9 (forward/right arc) ---
  { groupOffsetX:  3.31, groupOffsetY: -3.0, groupOffsetZ:  1.23 },
  { groupOffsetX:  4.30, groupOffsetY: -3.0, groupOffsetZ:  5.58 },
  { groupOffsetX:  6.43, groupOffsetY: -3.0, groupOffsetZ:  9.48 },
  { groupOffsetX:  9.67, groupOffsetY: -3.0, groupOffsetZ: 12.57 },
  { groupOffsetX: 14.14, groupOffsetY: -3.0, groupOffsetZ: 14.01 },
  { groupOffsetX: 18.58, groupOffsetY: -3.0, groupOffsetZ: 14.31 },
  { groupOffsetX: 22.84, groupOffsetY: -3.0, groupOffsetZ: 13.35 },
  { groupOffsetX: 26.77, groupOffsetY: -3.0, groupOffsetZ: 10.92 },
  { groupOffsetX: 29.62, groupOffsetY: -3.0, groupOffsetZ:  7.83 },

  // --- Next 11 (rear/left arc) ---
  { groupOffsetX:  3.58, groupOffsetY: -3.0, groupOffsetZ:  -3.69 },
  { groupOffsetX:  5.53, groupOffsetY: -3.0, groupOffsetZ:  -7.71 },
  { groupOffsetX:  8.32, groupOffsetY: -3.0, groupOffsetZ: -11.07 },
  { groupOffsetX: 12.10, groupOffsetY: -3.0, groupOffsetZ: -13.47 },
  { groupOffsetX: 16.69, groupOffsetY: -3.0, groupOffsetZ: -14.19 },
  { groupOffsetX: 21.19, groupOffsetY: -3.0, groupOffsetZ: -13.83 },
  { groupOffsetX: 25.36, groupOffsetY: -3.0, groupOffsetZ: -12.36 },
  { groupOffsetX: 29.11, groupOffsetY: -3.0, groupOffsetZ:  -9.30 },
  { groupOffsetX: 31.12, groupOffsetY: -3.0, groupOffsetZ:  -5.55 },
  { groupOffsetX: 32.02, groupOffsetY: -3.0, groupOffsetZ:  -1.29 },
  { groupOffsetX: 31.78, groupOffsetY: -3.0, groupOffsetZ:   3.51 },

  // --- Final 10 (center / inner ring) ---
  { groupOffsetX:  9.82, groupOffsetY: -3.0, groupOffsetZ:  0.75 },
  { groupOffsetX: 12.13, groupOffsetY: -3.0, groupOffsetZ:  5.52 },
  { groupOffsetX: 15.40, groupOffsetY: -3.0, groupOffsetZ:  2.07 },
  { groupOffsetX: 20.71, groupOffsetY: -3.0, groupOffsetZ:  0.99 },
  { groupOffsetX: 17.20, groupOffsetY: -3.0, groupOffsetZ:  7.95 },
  { groupOffsetX: 22.48, groupOffsetY: -3.0, groupOffsetZ:  6.69 },
  { groupOffsetX: 25.69, groupOffsetY: -3.0, groupOffsetZ:  2.43 },
  { groupOffsetX: 25.15, groupOffsetY: -3.0, groupOffsetZ: -3.36 },
  { groupOffsetX: 21.22, groupOffsetY: -3.0, groupOffsetZ: -7.29 },
  { groupOffsetX: 15.64, groupOffsetY: -3.0, groupOffsetZ: -7.89 }
];