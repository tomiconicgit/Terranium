// src/ui/ImportModel.js

import { loadModel } from '../ModelLoading.js';

export class ImportModelUI {
    constructor(scene, onModelLoaded, debuggerInstance) {
        this.scene = scene;
        this.onModelLoaded = onModelLoaded;
        this.debugger = debuggerInstance;
        this.createButton();
    }

    createButton() {
        // Find the container in the HTML instead of creating it
        const container = document.getElementById('ui-container');
        if (!container) {
            this.debugger.handleError(new Error('UI container not found for ImportModelUI.'), 'Init');
            return;
        }
        
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
        // The file input can be appended to the body as it's invisible
        document.body.appendChild(fileInput);
    }
}
