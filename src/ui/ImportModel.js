// src/ui/ImportModel.js

import { loadModel } from '../ModelLoading.js';

export class ImportModelUI {
    /**
     * @param {THREE.Scene} scene - The main scene to add the model to.
     * @param {function(THREE.Group): void} onModelLoaded - Callback to notify other modules of the new model.
     * @param {Debugger} debuggerInstance - For error reporting.
     */
    constructor(scene, onModelLoaded, debuggerInstance) {
        this.scene = scene;
        this.onModelLoaded = onModelLoaded;
        this.debugger = debuggerInstance;
        this.createButton();
    }

    createButton() {
        const container = document.createElement('div');
        container.id = 'ui-container';
        
        const button = document.createElement('button');
        button.id = 'import-model-btn';
        button.textContent = 'Import Model';
        button.title = 'Import a .glb model';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb';
        fileInput.style.display = 'none';

        button.onclick = () => fileInput.click();

        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                this.debugger.log(`Loading model: ${file.name}`);
                loadModel(
                    arrayBuffer,
                    (model) => {
                        this.debugger.log('Model loaded successfully.');
                        this.scene.add(model);
                        // Notify other UI components about the new model
                        this.onModelLoaded(model);
                    },
                    (error) => {
                        this.debugger.handleError(error, 'ModelLoader');
                    }
                );
            };
            reader.readAsArrayBuffer(file);
        };

        container.appendChild(button);
        document.body.appendChild(container);
    }
}
