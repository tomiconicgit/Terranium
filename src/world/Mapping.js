// src/world/Mapping.js
//
// Defines static (baked) world objects and baked flame offsets.
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

// 🔥 Baked flames for instanced batch
export const bakedFlames = [
  { "index": 0,  "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 1,  "groupOffsetX": 4.06, "groupOffsetY": -3, "groupOffsetZ": 5.31 },
  { "index": 2,  "groupOffsetX": 6.49, "groupOffsetY": -3, "groupOffsetZ": 9.51 },
  { "index": 3,  "groupOffsetX": 10.06,"groupOffsetY": -3, "groupOffsetZ": 12.51},
  { "index": 4,  "groupOffsetX": 14.23,"groupOffsetY": -3, "groupOffsetZ": 14.13},
  { "index": 5,  "groupOffsetX": 18.76,"groupOffsetY": -3, "groupOffsetZ": 14.49},
  { "index": 6,  "groupOffsetX": 23.17,"groupOffsetY": -3, "groupOffsetZ": 13.32},
  { "index": 7,  "groupOffsetX": 26.98,"groupOffsetY": -3, "groupOffsetZ": 11.04},
  { "index": 8,  "groupOffsetX": 15.25,"groupOffsetY": -3, "groupOffsetZ": 2.16 },
  { "index": 9,  "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 10, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 11, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 12, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 13, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 14, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 15, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 16, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 17, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 18, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 19, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 20, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 21, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  },
  { "index": 22, "groupOffsetX": 3.1,  "groupOffsetY": -3, "groupOffsetZ": 1.2  }
];