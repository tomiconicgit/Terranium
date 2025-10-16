// src/ui/EnginePanel.js
// --- MODIFIED ---
// Updated to reflect new defaults and renamed color parameter.

export class EnginePanelUI {
  /**
   * @param {{
   * get:()=>any,
   * set:(patch:any)=>void,
   * setIgnition:(on:boolean)=>void,
   * getIgnition:()=>boolean
   * }} api
   * @param {Debugger} dbg
   */
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this._build();
  }

  /** Call once EngineFX is created so the panel can drive it. */
  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
    this._syncLabels();
  }

  _build() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for EnginePanel.'), 'Init');
      return;
    }

    const openBtn = document.createElement('button');
    openBtn.id = 'engine-panel-btn';
    openBtn.textContent = 'Engines';
    openBtn.title = 'Open engine controls';
    openBtn.onclick = () => {
      const p = this.panel;
      p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    };
    container.appendChild(openBtn);

    const panel = document.createElement('div');
    panel.id = 'engine-panel';
    panel.classList.add('no-look');
    panel.style.cssText = `
      position:fixed; top:80px; left:20px; z-index:10;
      background:rgba(30,30,36,0.90); color:#fff;
      border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:340px; max-height:76vh; overflow:auto; padding:16px; display:none;
      box-shadow:0 5px 15px rgba(0,0,0,0.35);
      backdrop-filter:blur(8px);
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
    `;

    const row = (id, label, min, max, step, val) => `
      <div class="slider-group" style="margin-bottom:12px;">
        <label style="display:flex;justify-content:space-between;margin-bottom:6px;">
          ${label} <span id="${id}-val">${val}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"
               style="width:100%;accent-color:#4f8ff7;">
      </div>`;

    // --- REVISED: Default values updated to match new EngineFX.js defaults ---
    panel.innerHTML = `
      <h4 style="margin:0 0 12px;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:8px;">
        Engine Controls
      </h4>
      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <button id="ignite-btn"  style="flex:1;">Ignite</button>
        <button id="cutoff-btn"  style="flex:1;">Cutoff</button>
      </div>
      ${row('fw','Flame Width ×','0.01','80','0.01','1.00')}
      ${row('fh','Flame Height ×','0.01','120','0.01','1.00')}
      ${row('fy','Flame Y Offset (m)','-1200','2400','0.1','0.00')}
      ${row('in','Intensity ×','0','5','0.01','1.20')}
      ${row('tp','Taper (0=wide,1=thin)','0','1','0.01','0.40')}
      ${row('bg','Bulge (mid-body)','0','1','0.01','0.10')}
      ${row('td','TearDrop (base pinch)','0','1','0.01','0.85')}
      ${row('tb','Turbulence','0','1','0.01','0.20')}
      ${row('ns','Noise Speed','0','5','0.01','1.80')}
      ${row('ds','Mach Diamonds Strength','0','2','0.01','0.40')}
      ${row('df','Mach Diamonds Frequency','2','40','0.1','12.0')}
      <hr style="border-color:rgba(255,255,255,0.12);margin:10px 0;">
      ${row('rs','Rim Strength (halo)','0','1','0.01','0.30')}
      ${row('rp','Rim Speed','0','6','0.01','2.80')}
      <hr style="border-color:rgba(255,255,255,0.12);margin:10px 0;">
      ${row('cb','Color Mix – Cyan','0','3','0.01','1.00')}
      ${row('co','Color Mix – Orange','0','3','0.01','1.00')}
      ${row('cw','Color Mix – White','0','3','0.01','1.20')}
      <hr style="border-color:rgba(255,255,255,0.12);margin:10px 0;">
      ${row('gx','FX Offset X (m)','-800','800','0.1','0.00')}
      ${row('gy','FX Offset Y (m)','-2400','2400','0.1','0.00')}
      ${row('gz','FX Offset Z (m)','-800','800','0.1','0.00')}
      <button id="copy-engine-config" style="margin-top:8px;width:100%;">Copy Current Config</button>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    const ignite = panel.querySelector('#ignite-btn');
    const cutoff = panel.querySelector('#cutoff-btn');
    ignite.onclick = () => { if (!this.isReady) return this._notReady(); this.api.setIgnition(true);  this._refreshButtons(); };
    cutoff.onclick = () => { if (!this.isReady) return this._notReady(); this.api.setIgnition(false); this._refreshButtons(); };

    const ids = ['fw','fh','fy','in','tp','bg','td','tb','ns','ds','df','rs','rp','cb','co','cw','gx','gy','gz'];
    const apply = () => {
      if (!this.isReady) return;
      this.api.set({
        flameWidthFactor:  parseFloat(panel.querySelector('#fw').value),
        flameHeightFactor: parseFloat(panel.querySelector('#fh').value),
        flameYOffset:      parseFloat(panel.querySelector('#fy').value),
        intensity:         parseFloat(panel.querySelector('#in').value),
        taper:             parseFloat(panel.querySelector('#tp').value),
        bulge:             parseFloat(panel.querySelector('#bg').value),
        tear:              parseFloat(panel.querySelector('#td').value),
        turbulence:        parseFloat(panel.querySelector('#tb').value),
        noiseSpeed:        parseFloat(panel.querySelector('#ns').value),
        diamondsStrength:  parseFloat(panel.querySelector('#ds').value),
        diamondsFreq:      parseFloat(panel.querySelector('#df').value),
        rimStrength:       parseFloat(panel.querySelector('#rs').value),
        rimSpeed:          parseFloat(panel.querySelector('#rp').value),
        colorCyan:         parseFloat(panel.querySelector('#cb').value), // Changed from colorBlue
        colorOrange:       parseFloat(panel.querySelector('#co').value),
        colorWhite:        parseFloat(panel.querySelector('#cw').value),
        groupOffsetX:      parseFloat(panel.querySelector('#gx').value),
        groupOffsetY:      parseFloat(panel.querySelector('#gy').value),
        groupOffsetZ:      parseFloat(panel.querySelector('#gz').value),
      });
      this._syncLabels();
    };
    ids.forEach(id => panel.querySelector('#'+id).oninput = apply);

    panel.querySelector('#copy-engine-config').onclick = () => {
      const cfg = this.api.get();
      navigator.clipboard.writeText(JSON.stringify(cfg, null, 2))
        .then(() => this.debugger?.log('Engine config copied to clipboard.'))
        .catch(err => this.debugger?.handleError(err, 'Clipboard'));
    };

    this._refreshButtons();
    this._syncLabels();
  }

  _notReady(){ this.debugger?.warn('Engines not ready yet (model still loading).','Engines'); }

  _refreshButtons() {
    const on = this.api.getIgnition();
    const ig = this.panel.querySelector('#ignite-btn');
    const co = this.panel.querySelector('#cutoff-btn');
    ig.disabled = !this.isReady || on;
    co.disabled = !this.isReady || !on;
  }

  _syncLabels() {
    const c = this.api.get?.() ?? {};
    const set = (id, v) => { const el = this.panel.querySelector(id); if (el) el.textContent = v; };
    set('#fw-val', (c.flameWidthFactor ?? 1).toFixed(2));
    set('#fh-val', (c.flameHeightFactor ?? 1).toFixed(2));
    set('#fy-val', (c.flameYOffset ?? 0).toFixed(2));
    set('#in-val', (c.intensity ?? 1).toFixed(2));
    set('#tp-val', (c.taper ?? 0.55).toFixed(2));
    set('#bg-val', (c.bulge ?? 0).toFixed(2));
    set('#td-val', (c.tear ?? 0.5).toFixed(2));
    set('#tb-val', (c.turbulence ?? 0.35).toFixed(2));
    set('#ns-val', (c.noiseSpeed ?? 1.6).toFixed(2));
    set('#ds-val', (c.diamondsStrength ?? 0).toFixed(2));
    set('#df-val', (c.diamondsFreq ?? 14).toFixed(1));
    set('#rs-val', (c.rimStrength ?? 0.25).toFixed(2));
    set('#rp-val', (c.rimSpeed ?? 2.5).toFixed(2));
    set('#cb-val', (c.colorCyan ?? 1).toFixed(2)); // Changed from colorBlue
    set('#co-val', (c.colorOrange ?? 1).toFixed(2));
    set('#cw-val', (c.colorWhite ?? 1).toFixed(2));
    set('#gx-val', (c.groupOffsetX ?? 0).toFixed(2));
    set('#gy-val', (c.groupOffsetY ?? 0).toFixed(2));
    set('#gz-val', (c.groupOffsetZ ?? 0).toFixed(2));
  }
}
