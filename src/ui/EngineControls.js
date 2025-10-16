// src/ui/EngineControls.js
// Adds an Ignite/Cutoff button into #ui-container

export class EngineControlsUI {
  /**
   * @param {(on:boolean)=>void} onToggleEngines  callback to switch engines
   * @param {() => boolean} getState             returns current engine state
   * @param {Debugger} debuggerInstance
   */
  constructor(onToggleEngines, getState, debuggerInstance) {
    this.onToggle = onToggleEngines;
    this.getState = getState;
    this.debugger = debuggerInstance;
    this.button = null;
    this._build();
  }

  _build() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for EngineControls.'), 'Init');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'ignite-btn';
    btn.textContent = 'Ignite';
    btn.title = 'Toggle engines on/off';

    btn.onclick = () => {
      const next = !this.getState();
      this.onToggle(next);
      this._refresh();
    };

    container.appendChild(btn);
    this.button = btn;
    this._refresh();
  }

  _refresh() {
    const on = this.getState();
    if (!this.button) return;
    this.button.textContent = on ? 'Cutoff' : 'Ignite';
    this.button.style.backgroundColor = on ? 'rgba(110, 79, 247, 0.9)' : 'rgba(30, 30, 36, 0.8)';
  }
}