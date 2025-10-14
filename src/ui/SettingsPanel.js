// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    this.rotation = 0; // Stored in radians

    // Get DOM elements
    this.colorPicker = document.getElementById('color');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');
    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    // Add event listeners that trigger a change
    const trigger = () => this.triggerChange();
    this.colorPicker.addEventListener('input', trigger);
    this.roughnessSlider.addEventListener('input', trigger);
    this.metalnessSlider.addEventListener('input', trigger);
    this.tessellationSlider.addEventListener('input', trigger);
    
    this.rotateLeftBtn.addEventListener('click', () => {
      this.rotation -= Math.PI / 2; // -90 degrees
      this.triggerChange();
    });
    this.rotateRightBtn.addEventListener('click', () => {
      this.rotation += Math.PI / 2; // +90 degrees
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
      rotation: this.rotation,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
