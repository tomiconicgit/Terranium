// src/ModelLoading.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);

const fbxLoader = new FBXLoader();

/**
 * Loads a GLB/GLTF model.
 * *** MODIFIED: This function no longer uses the broken 'sanitizeScene'
 * *** It now passes the full gltf.scene and attaches animations.
 */
export function loadModel(source, onLoad, onError) {
  const loadFn = (data) => {
    gltfLoader.parse(data, '', (gltf) => {
      
      const model = gltf.scene;
      
      // *** FIX: Attach animations to the model's root userData ***
      model.userData.animations = gltf.animations;
      
      model.traverse(applyShadows);
      onLoad(model); // Pass the model's root scene, hierarchy intact

    }, (error) => {
      onError(new Error(`GLTF parsing failed: ${error.message || 'Unknown error'}`));
    });
  };

  if (typeof source === 'string') {
    fetch(source)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => loadFn(data))
      .catch(err => onError(err));
  } else if (source instanceof ArrayBuffer) {
    loadFn(source);
  } else {
    onError(new Error('Invalid model source type for GLB.'));
  }
}

/**
 * Loads an FBX model.
 */
export function loadFBXModel(source, onLoad, onError) {
  const onLoaded = (model) => {
    // FBX models are usually just the model, so sanitizing is less critical
    model.traverse(applyShadows);
    onLoad(model);
  };
  
  try {
    if (typeof source === 'string') {
      fbxLoader.load(source, onLoaded, undefined, onError);
    } else if (source instanceof ArrayBuffer) {
      const model = fbxLoader.parse(source);
      onLoaded(model);
    } else {
      onError(new Error('Invalid model source type for FBX.'));
    }
  } catch (err) {
    onError(err);
  }
}

function applyShadows(node) {
  if (node.isMesh) {
    node.castShadow = true;
    node.receiveShadow = true;
  }
}
