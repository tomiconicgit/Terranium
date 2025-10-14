// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    this.rotation = 0; // Stored in radians

    // Get DOM elements
    this.shadingSelect = document.getElementById('shading');
    this.colorPicker = document.getElementById('color');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');
    this.reflectivitySlider = document.getElementById('reflectivity');
    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    // Add event listeners that trigger a change
    const trigger = () => this.triggerChange();
    this.shadingSelect.addEventListener('change', trigger);
    this.colorPicker.addEventListener('input', trigger);
    this.roughnessSlider.addEventListener('input', trigger);
    this.metalnessSlider.addEventListener('input', trigger);
    this.reflectivitySlider.addEventListener('input', trigger);
    this.tessellationSlider.addEventListener('input', trigger);
    
    this.rotateLeftBtn.addEventListener('click', () => {
      this.rotation -= Math.PI / 2;
      this.triggerChange();
    });
    this.rotateRightBtn.addEventListener('click', () => {
      this.rotation += Math.PI / 2;
      this.triggerChange();
    });
    
    this.updateVisibility(); 
  }

  onChange(callback) {
    this._changeCallback = callback;
  }

  triggerChange() {
    if (this._changeCallback) {
      this._changeCallback(this.getSettings());
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.updateVisibility();
  }

  updateVisibility() {
    this.panel.classList.toggle('hidden', !this.isOpen);
  }

  getSettings() {
    return {
      shading: this.shadingSelect.value,
      color: this.colorPicker.value,
      roughness: parseFloat(this.roughnessSlider.value),
      metalness: parseFloat(this.metalnessSlider.value),
      reflectivity: parseFloat(this.reflectivitySlider.value),
      rotation: this.rotation,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
