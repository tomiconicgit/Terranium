// src/ui/SettingsPanel.js
export class SettingsPanel {
  constructor(btnEl, panelEl) {
    this.btn = btnEl;
    this.panel = panelEl;

    this.rotationSlider = document.getElementById('rotation');
    this.colorPicker = document.getElementById('color');
    this.roughnessSlider = document.getElementById('roughness');
    this.metalnessSlider = document.getElementById('metalness');

    this.isOpen = false;
    this.btn.addEventListener('click', () => this.toggle());
    
    this.updateVisibility(); 
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
      rotation: parseFloat(this.rotationSlider.value),
      color: this.colorPicker.value,
      roughness: parseFloat(this.roughnessSlider.value),
      metalness: parseFloat(this.metalnessSlider.value),
    };
  }
}
