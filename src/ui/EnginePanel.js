// File: src/ui/EnginePanel.js
// Sliders + number boxes, incl. orange band shift and light controls.
export class EnginePanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this.inputs = {}; // {id: {slider, box, min, max, key}}
    this.panel = null;
    this.openBtn = null;
    this.igniteBtn = null;
    this.cutoffBtn = null;
    this._build();
  }

  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
    this._syncValuesFromAPI();
  }

  /* ---------------- UI build ---------------- */
  _build() {
    const container = document.getElementById('ui-container');
    if (!container) {
      this.debugger?.handleError(new Error('UI container not found for EnginePanel.'), 'Init');
      return;
    }

    // Toggle button
    const openBtn = document.createElement('button');
    openBtn.id = 'engine-panel-btn';
    openBtn.textContent = 'Engines';
    openBtn.title = 'Open engine controls';
    openBtn.onclick = () => {
      if (!this.panel) return;
      this.panel.style.display = (this.panel.style.display === 'block') ? 'none' : 'block';
    };
    container.appendChild(openBtn);
    this.openBtn = openBtn;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'engine-panel';
    panel.classList.add('no-look');
    panel.style.cssText = `
      position:fixed; top:80px; left:20px; z-index:10; background:rgba(30,30,36,0.90);
      color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px;
      width:360px; max-height:76vh; overflow:auto; padding:16px; display:none;
      box-shadow:0 5px 15px rgba(0,0,0,0.35); backdrop-filter:blur(8px);
      -webkit-overflow-scrolling: touch; touch-action: pan-y;`;

    const header = document.createElement('h4');
    header.textContent = 'Engine Controls';
    header.style.cssText = 'margin:0 0 12px;border-bottom:1px solid #444;padding-bottom:8px;';
    panel.appendChild(header);

    // Ignite/Cutoff
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:10px; margin-bottom:14px;';
    const igniteBtn = document.createElement('button');
    igniteBtn.id = 'ignite-btn';
    igniteBtn.style.flex = '1';
    igniteBtn.textContent = 'Ignite';
    igniteBtn.onclick = () => { this.api.setIgnition?.(true); this._refreshButtons(); };
    const cutoffBtn = document.createElement('button');
    cutoffBtn.id = 'cutoff-btn';
    cutoffBtn.style.flex = '1';
    cutoffBtn.textContent = 'Cutoff';
    cutoffBtn.onclick = () => { this.api.setIgnition?.(false); this._refreshButtons(); };

    btnRow.appendChild(igniteBtn);
    btnRow.appendChild(cutoffBtn);
    panel.appendChild(btnRow);
    this.igniteBtn = igniteBtn;
    this.cutoffBtn = cutoffBtn;

    // Helper to create rows
    const addRow = (id, label, min, max, key, stepBox = 0.1, stepSlider = 1) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-group';
      wrap.style.marginBottom = '12px';
      wrap.innerHTML = `
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <span>${label}</span>
          <input type="number" id="${id}-box" step="${stepBox}" min="${min}" max="${max}"
                 style="width:110px;padding:4px 6px;background:#1f1f28;border:1px solid #444;color:#fff;border-radius:4px;">
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${stepSlider}"
               style="width:100%;accent-color:#4f8ff7;">
      `;
      panel.appendChild(wrap);

      const slider = wrap.querySelector(`#${id}`);
      const box    = wrap.querySelector(`#${id}-box`);
      this.inputs[id] = { slider, box, min, max, key };

      slider.oninput = () => {
        const iv = clampInt(parseFloat(slider.value), min, max);
        slider.value = String(iv);
        if (Math.abs(parseFloat(box.value) - iv) > 0.49) box.value = iv.toFixed(1);
        this._applyFromSliders();
      };
      box.onchange = () => {
        let v = parseFloat(box.value);
        if (isNaN(v)) v = parseFloat(slider.value);
        v = clampFloat(v, min, max);
        v = round1(v);
        box.value = v.toFixed(1);
        const iv = clampInt(Math.round(v), min, max);
        slider.value = String(iv);
        this._applyFromBoxes();
      };
    };

    // Read current values (or defaults)
    const c = this.api.get?.() ?? {};

    // Core size/offset
    addRow('fw',  'Flame Width ×',                  0.01,  80.0, 'flameWidthFactor');
    addRow('fh',  'Flame Height ×',                 0.01, 120.0, 'flameHeightFactor');
    addRow('fy',  'Flame Y Offset (m)',          -1200.0, 2400.0, 'flameYOffset', 0.1, 0.1);

    this._hr(panel);

    // Shape & dynamics
    addRow('in',  'Intensity ×',                     0.0,    5.0, 'intensity', 0.1, 0.1);
    addRow('tp',  'Taper (0=wide,1=thin)',           0.0,    1.0, 'taper', 0.01, 0.01);
    addRow('bg',  'Bulge (mid-body)',                0.0,    1.0, 'bulge', 0.01, 0.01);
    addRow('td',  'TearDrop (pinch)',                0.0,    1.0, 'tear', 0.01, 0.01);
    addRow('tb',  'Turbulence',                      0.0,    1.0, 'turbulence', 0.01, 0.01);
    addRow('ns',  'Noise Speed',                     0.0,    5.0, 'noiseSpeed', 0.01, 0.01);
    addRow('ds',  'Mach Diamonds Strength',          0.0,    2.0, 'diamondsStrength', 0.01, 0.01);
    addRow('df',  'Mach Diamonds Freq.',             0.0,   40.0, 'diamondsFreq', 0.1, 0.1);

    // Orange band shift
    addRow('os',  'Orange Band Shift',              -0.50,   0.50, 'orangeShift', 0.01, 0.01);

    this._hr(panel);

    // Rim / halo
    addRow('rs',  'Rim Strength (halo)',             0.0,    1.0, 'rimStrength', 0.01, 0.01);
    addRow('rp',  'Rim Speed',                        0.0,    6.0, 'rimSpeed', 0.01, 0.01);

    this._hr(panel);

    // Colors (multipliers)
    addRow('cb',  'Color: Cyan',                      0.0,    3.0, 'colorCyan', 0.01, 0.01);
    addRow('co',  'Color: Orange',                    0.0,    3.0, 'colorOrange', 0.01, 0.01);
    addRow('cw',  'Color: White Core',                0.0,    3.0, 'colorWhite', 0.01, 0.01);

    this._hr(panel);

    // FX group offsets
    addRow('gx',  'FX Offset X (m)',               -800.0,  800.0, 'groupOffsetX', 0.1, 0.1);
    addRow('gy',  'FX Offset Y (m)',              -2400.0, 2400.0, 'groupOffsetY', 0.1, 0.1);
    addRow('gz',  'FX Offset Z (m)',               -800.0,  800.0, 'groupOffsetZ', 0.1, 0.1);

    this._hr(panel);

    // Tail fade controls
    addRow('tfs', 'Tail Fade Start (0–1)',            0.00,   1.00, 'tailFadeStart', 0.01, 0.01);
    addRow('tff', 'Tail Feather (softness)',          0.10,   6.00, 'tailFeather', 0.01, 0.01);
    addRow('tfn', 'Tail Noise',                       0.00,   0.40, 'tailNoise', 0.01, 0.01);

    const hint = document.createElement('p');
    hint.style.cssText = 'margin:6px 0 0; color:#9aa; font-size:.85em;';
    hint.textContent = 'Tip: Use Orange Band Shift to push orange higher into the blue area.';
    panel.appendChild(hint);

    this._hr(panel);

    // -------- Light controls --------
    const lightWrap = document.createElement('div');
    lightWrap.style.cssText = 'margin:8px 0 12px;';
    lightWrap.innerHTML = `<h5 style="margin:0 0 8px;">Nozzle Light</h5>`;
    panel.appendChild(lightWrap);

    // intensity & distance sliders
    const addLightRow = (id, label, min, max, key, step = 0.1) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-group';
      wrap.style.marginBottom = '10px';
      wrap.innerHTML = `
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
          <span>${label}</span>
          <input type="number" id="${id}-box" step="${step}" min="${min}" max="${max}"
                 style="width:110px;padding:4px 6px;background:#1f1f28;border:1px solid #444;color:#fff;border-radius:4px;">
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}"
               style="width:100%;accent-color:#4f8ff7;">
      `;
      lightWrap.appendChild(wrap);

      const slider = wrap.querySelector(`#${id}`);
      const box    = wrap.querySelector(`#${id}-box`);
      this.inputs[id] = { slider, box, min, max, key };

      slider.oninput = () => {
        let v = clampFloat(parseFloat(slider.value), min, max);
        box.value = v.toFixed(2);
        this._applyFromSliders();
      };
      box.onchange = () => {
        let v = parseFloat(box.value);
        if (isNaN(v)) v = parseFloat(slider.value);
        v = clampFloat(v, min, max);
        v = round1(v);
        box.value = v.toFixed(2);
        slider.value = String(v);
        this._applyFromBoxes();
      };
    };

    addLightRow('li', 'Light Intensity', 0.0, 50.0, 'lightIntensity', 0.1);
    addLightRow('ld', 'Light Distance',  0.0, 800.0, 'lightDistance',  1.0);

    // color input
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin:6px 0 4px;';
    colorRow.innerHTML = `
      <label style="flex:1;">Light Color</label>
      <input type="color" id="lc" value="#ffb869"
             style="width:44px;height:28px;border:1px solid #444;background:#1f1f28;border-radius:4px;padding:0;">
      <input type="text" id="lc-box" value="#ffb869"
             style="flex:1;min-width:110px;padding:4px 6px;background:#1f1f28;border:1px solid #444;color:#fff;border-radius:4px;">
    `;
    lightWrap.appendChild(colorRow);

    const lc = colorRow.querySelector('#lc');
    const lcBox = colorRow.querySelector('#lc-box');
    this.inputs['lc'] = { slider: lc, box: lcBox, min: 0, max: 0, key: 'lightColor' };
    lc.oninput = () => { lcBox.value = lc.value; this._applyLightColor(); };
    lcBox.onchange = () => {
      const val = lcBox.value.trim();
      if (/^#([0-9a-fA-F]{6})$/.test(val)) { lc.value = val; this._applyLightColor(); }
      else { lcBox.value = lc.value; }
    };

    // Finish
    document.body.appendChild(panel);
    this.panel = panel;

    // Seed values from API
    this._syncValuesFromAPI();
    this._refreshButtons();
  }

  _hr(panel) {
    const hr = document.createElement('div');
    hr.style.cssText = 'height:1px;background:#444;margin:12px 0;';
    panel.appendChild(hr);
  }

  /* ---------------- read/apply ---------------- */

  _collectPatchFromInputs() {
    const patch = {};
    for (const [id, def] of Object.entries(this.inputs)) {
      if (def.key === 'lightColor') continue; // handled separately
      const v = parseFloat(def.box?.value ?? def.slider?.value);
      if (!Number.isFinite(v)) continue;
      patch[def.key] = v;
    }
    // color
    const color = this.inputs['lc'];
    if (color) patch.lightColor = color.box.value.trim();
    return patch;
  }

  _applyFromSliders() {
    if (!this.isReady) return;
    try { this.api.set?.(this._collectPatchFromInputs()); }
    catch (e) { this.debugger?.handleError(e, 'EnginePanel.Apply'); }
  }
  _applyFromBoxes() {
    if (!this.isReady) return;
    try { this.api.set?.(this._collectPatchFromInputs()); }
    catch (e) { this.debugger?.handleError(e, 'EnginePanel.Apply'); }
  }
  _applyLightColor() {
    if (!this.isReady) return;
    try {
      const color = this.inputs['lc']?.box?.value?.trim();
      if (color) this.api.set?.({ lightColor: color });
    } catch (e) { this.debugger?.handleError(e, 'EnginePanel.Light'); }
  }

  _syncValuesFromAPI() {
    const c = this.api.get?.() ?? {};
    // set each pair
    for (const [id, def] of Object.entries(this.inputs)) {
      const key = def.key;
      if (!key) continue;
      let v = c[key];
      if (key === 'lightColor') {
        const hex = typeof v === 'string' ? v : (typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : '#ffb869');
        if (def.slider) def.slider.value = hex;
        if (def.box)    def.box.value = hex;
        continue;
      }
      if (!Number.isFinite(v)) continue;
      v = clampFloat(v, def.min, def.max);
      if (def.slider) def.slider.value = String(v);
      if (def.box)    def.box.value = v.toFixed( (def.slider?.step && def.slider.step.indexOf('.')>=0) ? 2 : 1 );
    }
  }

  _refreshButtons() {
    const on = !!this.api.getIgnition?.();
    if (this.igniteBtn) this.igniteBtn.disabled = !this.isReady || on;
    if (this.cutoffBtn) this.cutoffBtn.disabled = !this.isReady || !on;
    if (this.openBtn)   this.openBtn.disabled   = !this.isReady;
  }
}

/* -------- helpers -------- */
function clampInt(v, min, max){ return Math.max(min, Math.min(max, Math.round(v))); }
function clampFloat(v, min, max){ return Math.max(min, Math.min(max, v)); }
function round1(v){ return Math.round(v * 10) / 10; }