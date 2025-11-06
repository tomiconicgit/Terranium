// src/ModelLoading.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; // <-- NEW

// --- GLTF Loader Setup ---
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);

// --- FBX Loader Setup ---
const fbxLoader = new FBXLoader(); // <-- NEW

/**
 * Loads a GLB/GLTF model.
 * @param {string | ArrayBuffer} source - The URL path or an ArrayBuffer.
 * @param {function(THREE.Group): void} onLoad - Success callback.
 * (Rest of JSDoc is the same)
 */
export function loadModel(source, onLoad, onError) {
  const loadFn = (data) => {
    gltfLoader.parse(data, '', (gltf) => {
      const model = gltf.scene;
      model.traverse(applyShadows);
      onLoad(model);
    }, (error) => {
      onError(new Error(`GLTF parsing failed: ${error.message || 'Unknown error'}`));
    });
  };

  if (typeof source === 'string') {
    // Source is a URL
    fetch(source)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => loadFn(data))
      .catch(err => onError(err));
  } else if (source instanceof ArrayBuffer) {
    // Source is already an ArrayBuffer
    loadFn(source);
  } else {
    onError(new Error('Invalid model source type for GLB.'));
  }
}

/**
 * NEW: Loads an FBX model.
 * @param {string | ArrayBuffer} source - The URL path or an ArrayBuffer.
 * @param {function(THREE.Group): void} onLoad - Success callback.
 * @param {function(Error): void} onError - Error callback.
 */
export function loadFBXModel(source, onLoad, onError) {
  const onLoaded = (model) => {
    model.traverse(applyShadows);
    onLoad(model);
  };
  
  try {
    if (typeof source === 'string') {
      // Source is a URL
      fbxLoader.load(source, onLoaded, undefined, onError);
    } else if (source instanceof ArrayBuffer) {
      // Source is an ArrayBuffer
      const model = fbxLoader.parse(source);
      onLoaded(model);
    } else {
      onError(new Error('Invalid model source type for FBX.'));
    }
  } catch (err) {
    onError(err);
  }
}

// Helper function to apply shadows
function applyShadows(node) {
  if (node.isMesh) {
    node.castShadow = true;
    node.receiveShadow = true;
  }
}
