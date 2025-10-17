// src/world/Mapping.js
//
// Defines all static (baked) world objects & baked flames positions.

export const worldObjects = [
  {
    name: "SuperHeavy",
    path: "src/assets/SuperHeavy.glb",
    position: { x: 17.4, y: 13.4, z: 0 },
    scale:    { x: 0.030, y: 0.030, z: 0.030 },
    rotation: { x: 0, y: 0, z: 0 }
  }
];

// All instanced (baked) flames. Order = instance index.
// Note: the "index" field from your list isn’t relied on; we just use array order.
export const bakedFlames = [
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 4.06, groupOffsetY: -3, groupOffsetZ: 5.31 },
  { groupOffsetX: 6.49, groupOffsetY: -3, groupOffsetZ: 9.51 },
  { groupOffsetX: 10.06,groupOffsetY: -3, groupOffsetZ: 12.51},
  { groupOffsetX: 14.23,groupOffsetY: -3, groupOffsetZ: 14.13},
  { groupOffsetX: 18.76,groupOffsetY: -3, groupOffsetZ: 14.49},
  { groupOffsetX: 23.17,groupOffsetY: -3, groupOffsetZ: 13.32},
  { groupOffsetX: 26.98,groupOffsetY: -3, groupOffsetZ: 11.04},
  { groupOffsetX: 15.25,groupOffsetY: -3, groupOffsetZ: 2.16 },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  },
  { groupOffsetX: 3.1,  groupOffsetY: -3, groupOffsetZ: 1.2  }
];