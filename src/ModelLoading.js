// src/ModelLoading.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/DRACOLoader.js';

// Create a single instance of the loaders
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();

// Configure the DRACOLoader with the path to the decoder libraries
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Loads a GLB model into the scene.
 * @param {string | ArrayBuffer} source - The URL path to the model or an ArrayBuffer from a file input.
 * @param {function(THREE.Group): void} onLoad - Callback function that receives the loaded model.
 * @param {function(Error): void} onError - Callback function for handling errors.
 */
export function loadModel(source, onLoad, onError) {
    const loadFn = (data) => {
        gltfLoader.parse(data, '', (gltf) => {
            const model = gltf.scene;
            
            // Ensure all meshes in the model cast and receive shadows
            model.traverse(function (node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            onLoad(model);
        }, onError);
    };

    if (typeof source === 'string') {
        // Source is a URL, fetch it first
        fetch(source)
            .then(response => response.arrayBuffer())
            .then(data => loadFn(data))
            .catch(err => onError(err));
    } else if (source instanceof ArrayBuffer) {
        // Source is already an ArrayBuffer (from file input)
        loadFn(source);
    } else {
        onError(new Error('Invalid model source type.'));
    }
}
