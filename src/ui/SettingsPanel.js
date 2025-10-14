// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    this.rotation = 0; // Stored in radians

    // Get DOM elements
    this.shadingSelect = document.getElementById('shading');
    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    // Add event listeners that trigger a change
    this.shadingSelect.addEventListener('change', () => this.triggerChange());
    this.tessellationSlider.addEventListener('input', () => this.triggerChange());
    
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

  // Register a callback function to be called when any setting changes
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
      rotation: this.rotation,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
