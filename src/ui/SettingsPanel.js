// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    this.rotation = 0;

    // Get DOM elements
    this.colorPicker = document.getElementById('color');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');
    this.reflectivitySlider = document.getElementById('reflectivity');
    this.rustSlider = document.getElementById('rust');
    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    const trigger = () => this.triggerChange();
    this.colorPicker.addEventListener('input', trigger);
    this.roughnessSlider.addEventListener('input', trigger);
    this.metalnessSlider.addEventListener('input', trigger);
    this.reflectivitySlider.addEventListener('input', trigger);
    this.rustSlider.addEventListener('input', trigger);
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
      color: this.colorPicker.value,
      roughness: parseFloat(this.roughnessSlider.value),
      metalness: parseFloat(this.metalnessSlider.value),
      reflectivity: parseFloat(this.reflectivitySlider.value),
      rust: parseFloat(this.rustSlider.value),
      rotation: this.rotation,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
