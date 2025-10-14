// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    
    // ✅ CHANGED: Now handles two rotation axes
    this.rotationY = 0; // Left/Right rotation
    this.rotationX = 0; // Up/Down tilt

    // Get DOM elements
    this.colorPicker = document.getElementById('color');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');
    this.reflectivitySlider = document.getElementById('reflectivity');
    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');
    
    // ✅ ADDED: Get new tilt buttons
    this.tiltLeftBtn = document.getElementById('tilt-left');
    this.tiltRightBtn = document.getElementById('tilt-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    const trigger = () => this.triggerChange();
    this.colorPicker.addEventListener('input', trigger);
    this.roughnessSlider.addEventListener('input', trigger);
    this.metalnessSlider.addEventListener('input', trigger);
    this.reflectivitySlider.addEventListener('input', trigger);
    this.tessellationSlider.addEventListener('input', trigger);
    
    this.rotateLeftBtn.addEventListener('click', () => {
      this.rotationY -= Math.PI / 2;
      this.triggerChange();
    });
    this.rotateRightBtn.addEventListener('click', () => {
      this.rotationY += Math.PI / 2;
      this.triggerChange();
    });

    // ✅ ADDED: Event listeners for new tilt buttons
    this.tiltLeftBtn.addEventListener('click', () => {
      this.rotationX -= Math.PI / 2;
      this.triggerChange();
    });
    this.tiltRightBtn.addEventListener('click', () => {
      this.rotationX += Math.PI / 2;
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
      // ✅ CHANGED: Return both rotation values
      rotationY: this.rotationY,
      rotationX: this.rotationX,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
