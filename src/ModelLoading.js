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
 * Helper function to "sanitize" a loaded scene.
 * Extracts only geometry/groups, discarding cameras, lights, etc.
 */
function sanitizeScene(scene) {
  const newGroup = new THREE.Group();
  
  // Filter and re-parent only the objects we want (Meshes, Groups)
  const objectsToKeep = [];
  scene.traverse(child => {
    if (child.isMesh || child.isSkinnedMesh || child.isBone) {
      objectsToKeep.push(child);
    }
  });

  // If the original scene's children were just meshes, add them
  scene.children.forEach(child => {
      if (child.isMesh || child.isSkinnedMesh || child.isGroup) {
          if (!objectsToKeep.includes(child)) {
              objectsToKeep.push(child);
          }
      }
  });

  // Consolidate unique top-level objects
  const topLevelObjects = new Set();
  objectsToKeep.forEach(obj => {
      let topParent = obj;
      while (topParent.parent && topParent.parent !== scene) {
          topParent = topParent.parent;
      }
      topLevelObjects.add(topParent);
  });

  // Add them to our new, clean group
  topLevelObjects.forEach(obj => {
      newGroup.add(obj);
  });

  // Fallback: If no objects were found, just return the original scene
  // but this is unlikely to be what the user wants.
  if (newGroup.children.length === 0) {
      console.warn("Model scene was empty or contained no meshes/groups. Returning raw scene.");
      return scene;
  }

  return newGroup;
}

/**
 * Loads a GLB/GLTF model.
 */
export function loadModel(source, onLoad, onError) {
  const loadFn = (data) => {
    gltfLoader.parse(data, '', (gltf) => {
      const sanitizedModel = sanitizeScene(gltf.scene);
      sanitizedModel.traverse(applyShadows);
      onLoad(sanitizedModel);
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
