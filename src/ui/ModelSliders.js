// src/ui/ModelSliders.js

export class ModelSlidersUI {
    constructor(debuggerInstance) {
        this.debugger = debuggerInstance;
        this.activeModel = null;
        this.createUI();
    }

    createUI() {
        // Find the main UI container created by ImportModelUI
        const container = document.getElementById('ui-container');
        if (!container) {
            this.debugger.handleError(new Error("UI container not found for ModelSlidersUI."), "Init");
            return;
        }

        const button = document.createElement('button');
        button.id = 'transform-model-btn';
        button.textContent = 'Transform';
        button.title = 'Adjust model position & scale';
        button.disabled = true; // Disabled until a model is loaded

        this.panel = document.createElement('div');
        this.panel.id = 'transform-panel';
        this.panel.classList.add('hidden'); // Initially hidden

        this.panel.innerHTML = `
            <h4>Model Transform</h4>
            <div class="slider-group">
                <label>Pos X: <span id="posX-val">0</span></label>
                <input type="range" id="posX" min="-100" max="100" value="0" step="0.1">
            </div>
            <div class="slider-group">
                <label>Pos Y: <span id="posY-val">0</span></label>
                <input type="range" id="posY" min="0" max="100" value="0" step="0.1">
            </div>
            <div class="slider-group">
                <label>Pos Z: <span id="posZ-val">0</span></label>
                <input type="range" id="posZ" min="-100" max="100" value="0" step="0.1">
            </div>
            <div class="slider-group">
                <label>Scale: <span id="scale-val">1</span></label>
                <input type="range" id="scale" min="0.1" max="10" value="1" step="0.05">
            </div>
            <button id="copy-data-btn">Copy Data</button>
        `;
        
        button.onclick = () => this.panel.classList.toggle('hidden');

        container.appendChild(button);
        document.body.appendChild(this.panel);

        // Store references to elements
        this.transformButton = button;
        this.sliders = {
            posX: this.panel.querySelector('#posX'),
            posY: this.panel.querySelector('#posY'),
            posZ: this.panel.querySelector('#posZ'),
            scale: this.panel.querySelector('#scale'),
        };
        this.valueLabels = {
            posX: this.panel.querySelector('#posX-val'),
            posY: this.panel.querySelector('#posY-val'),
            posZ: this.panel.querySelector('#posZ-val'),
            scale: this.panel.querySelector('#scale-val'),
        };

        this.addEventListeners();
    }

    addEventListeners() {
        this.sliders.posX.oninput = () => this.updateModelTransform();
        this.sliders.posY.oninput = () => this.updateModelTransform();
        this.sliders.posZ.oninput = () => this.updateModelTransform();
        this.sliders.scale.oninput = () => this.updateModelTransform();
        
        this.panel.querySelector('#copy-data-btn').onclick = () => this.copyModelData();
    }
    
    /**
     * Sets the currently active model to be manipulated by the sliders.
     * @param {THREE.Group} model
     */
    setActiveModel(model) {
        this.activeModel = model;
        this.transformButton.disabled = false;
        this.updateSlidersFromModel();
    }

    updateSlidersFromModel() {
        if (!this.activeModel) return;

        const { x, y, z } = this.activeModel.position;
        this.sliders.posX.value = x;
        this.sliders.posY.value = y;
        this.sliders.posZ.value = z;

        // Assuming uniform scale for simplicity
        const scale = this.activeModel.scale.x;
        this.sliders.scale.value = scale;
        
        this.updateValueLabels();
    }

    updateModelTransform() {
        if (!this.activeModel) return;

        this.activeModel.position.set(
            parseFloat(this.sliders.posX.value),
            parseFloat(this.sliders.posY.value),
            parseFloat(this.sliders.posZ.value)
        );

        const scale = parseFloat(this.sliders.scale.value);
        this.activeModel.scale.set(scale, scale, scale);
        
        this.updateValueLabels();
    }
    
    updateValueLabels() {
        this.valueLabels.posX.textContent = parseFloat(this.sliders.posX.value).toFixed(2);
        this.valueLabels.posY.textContent = parseFloat(this.sliders.posY.value).toFixed(2);
        this.valueLabels.posZ.textContent = parseFloat(this.sliders.posZ.value).toFixed(2);
        this.valueLabels.scale.textContent = parseFloat(this.sliders.scale.value).toFixed(2);
    }
    
    copyModelData() {
        if (!this.activeModel) return;
        
        const data = {
            name: "ImportedModel",
            path: "path/to/your/model.glb",
            position: {
                x: parseFloat(this.activeModel.position.x.toFixed(3)),
                y: parseFloat(this.activeModel.position.y.toFixed(3)),
                z: parseFloat(this.activeModel.position.z.toFixed(3))
            },
            scale: {
                x: parseFloat(this.activeModel.scale.x.toFixed(3)),
                y: parseFloat(this.activeModel.scale.y.toFixed(3)),
                z: parseFloat(this.activeModel.scale.z.toFixed(3))
            },
            rotation: {
                x: 0, y: 0, z: 0
            }
        };
        
        const jsonString = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(jsonString)
            .then(() => this.debugger.log('Model data copied to clipboard.'))
            .catch(err => this.debugger.handleError(err, 'Clipboard'));
    }
}
