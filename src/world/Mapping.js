// src/world/Mapping.js
//
// Static world objects + baked engine flame positions (for instancing)

export const worldObjects = [
  {
    name: "SuperHeavy",
    path: "src/assets/SuperHeavy.glb",
    position: { x: 17.4, y: 13.4, z: 0 },
    scale:    { x: 0.030, y: 0.030, z: 0.030 },
    rotation: { x: 0, y: 0, z: 0 }
  }
];

/** Baked flames (identical look, different positions). Used by InstancedFlames. */
export const bakedFlames = [
  // ——— the earlier 0..22 set you gave me ———
  { index: 0,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index: 1,  groupOffsetX: 4.06, groupOffsetY: -3.0, groupOffsetZ: 5.31 },
  { index: 2,  groupOffsetX: 6.49, groupOffsetY: -3.0, groupOffsetZ: 9.51 },
  { index: 3,  groupOffsetX: 10.06, groupOffsetY: -3.0, groupOffsetZ: 12.51 },
  { index: 4,  groupOffsetX: 14.23, groupOffsetY: -3.0, groupOffsetZ: 14.13 },
  { index: 5,  groupOffsetX: 18.76, groupOffsetY: -3.0, groupOffsetZ: 14.49 },
  { index: 6,  groupOffsetX: 23.17, groupOffsetY: -3.0, groupOffsetZ: 13.32 },
  { index: 7,  groupOffsetX: 26.98, groupOffsetY: -3.0, groupOffsetZ: 11.04 },
  { index: 8,  groupOffsetX: 15.25, groupOffsetY: -3.0, groupOffsetZ: 2.16 },
  { index: 9,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:10,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:11,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:12,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:13,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:14,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:15,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:16,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:17,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:18,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:19,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:20,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:21,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:22,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },

  // ——— your NEW 8 flames appended as 23..30 ———
  { index:23,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:24,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:25,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:26,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:27,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:28,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:29,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 },
  { index:30,  groupOffsetX: 3.10, groupOffsetY: -3.0, groupOffsetZ: 1.20 }
];