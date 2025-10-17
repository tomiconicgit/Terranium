// src/world/Mapping.js
// Defines static world objects to be loaded into the scene.

export const worldObjects = [
  {
    name: "SuperHeavy",
    path: "src/assets/SuperHeavy.glb",
    position: { x: 17.4, y: 13.4, z: 0 },
    scale:    { x: 0.030, y: 0.030, z: 0.030 },
    rotation: { x: 0, y: 0, z: 0 }
  }
];

// NOTE: The 'bakedFlames' array was removed from this file as it was
// unused and duplicated data from 'src/world/BakedFlames.js'.
