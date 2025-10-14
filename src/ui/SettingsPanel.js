// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this._changeCallback = null;
    
    this.rotationY = 0; // Left/Right turn
    this.rotationX = 0; // Up/Down tilt
    this.rotationZ = 0; // Left/Right roll

    // Get DOM elements
    this.primaryColorPicker = document.getElementById('primaryColor');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');
    this.reflectivitySlider = document.getElementById('reflectivity');
    
    this.floorColorPickers = [
        document.getElementById('floorColor1'), document.getElementById('floorColor2'),
        document.getElementById('floorColor3'), document.getElementById('floorColor4'),
        document.getElementById('floorColor5'),
    ];

    this.wallColorPickers = [
        document.getElementById('wallColor1'), document.getElementById('wallColor2'),
        document.getElementById('wallColor3'), document.getElementById('wallColor4'),
        document.getElementById('wallColor5'),
    ];

    this.tessellationSlider = document.getElementById('tessellation');
    this.rotateLeftBtn = document.getElementById('rotate-left');
    this.rotateRightBtn = document.getElementById('rotate-right');
    this.tiltLeftBtn = document.getElementById('tilt-left');
    this.tiltRightBtn = document.getElementById('tilt-right');
    this.rollLeftBtn = document.getElementById('roll-left');
    this.rollRightBtn = document.getElementById('roll-right');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());

    const trigger = () => this.triggerChange();
    this.primaryColorPicker.addEventListener('input', trigger);
    this.roughnessSlider.addEventListener('input', trigger);
    this.metalnessSlider.addEventListener('input', trigger);
    this.reflectivitySlider.addEventListener('input', trigger);
    this.tessellationSlider.addEventListener('input', trigger);
    
    this.floorColorPickers.forEach(p => p.addEventListener('input', trigger));
    this.wallColorPickers.forEach(p => p.addEventListener('input', trigger));
    
    this.rotateLeftBtn.addEventListener('click', () => {
      this.rotationY -= Math.PI / 2;
      this.triggerChange();
    });
    this.rotateRightBtn.addEventListener('click', () => {
      this.rotationY += Math.PI / 2;
      this.triggerChange();
    });

    this.tiltLeftBtn.addEventListener('click', () => {
      this.rotationX -= Math.PI / 2;
      this.triggerChange();
    });
    this.tiltRightBtn.addEventListener('click', () => {
      this.rotationX += Math.PI / 2;
      this.triggerChange();
    });
    
    this.rollLeftBtn.addEventListener('click', () => {
      this.rotationZ -= Math.PI / 2;
      this.triggerChange();
    });
    this.rollRightBtn.addEventListener('click', () => {
      this.rotationZ += Math.PI / 2;
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
      primaryColor: this.primaryColorPicker.value,
      floorColors: this.floorColorPickers.map(p => p.value),
      wallColors: this.wallColorPickers.map(p => p.value),
      roughness: parseFloat(this.roughnessSlider.value),
      metalness: parseFloat(this.metalnessSlider.value),
      reflectivity: parseFloat(this.reflectivitySlider.value),
      rotationY: this.rotationY,
      rotationX: this.rotationX,
      rotationZ: this.rotationZ,
      tessellation: parseInt(this.tessellationSlider.value),
    };
  }
}
