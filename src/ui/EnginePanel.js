// src/ui/EnginePanel.js
// Adds: Place Flame, Adjust/Move toggle (drag X/Z), Copy Fixed Positions.
// Also pauses camera while panel is open via api.onPanelOpen/Close.

export class EnginePanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.isReady = false;
    this.inputs = {};   // {id: {slider, box, min, max, key}}
    this.panel = null;
    this.openBtn = null;
    this.igniteBtn = null;
    this.cutoffBtn = null;

    // NEW
    this.fixedSelect = null;  // dropdown of fixed flames
    this.moveToggle  = null;  // Adjust/Move toggle
    this._build();
  }

  setReady(ready = true) {
    this.isReady = ready;
    this._refreshButtons();
    this._syncValuesFromAPI();
  }

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
      const opening = !(this.panel.style.display === 'block');
      this.panel.style.display = opening ? 'block' : 'none';
      try { opening ? this.api.onPanelOpen?.() : this.api.onPanelClose?.(); } catch {}
      if (opening) this._refreshFixedList();
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

    // NEW: Placement / Adjust / Copy row
    const opsRow = document.createElement('div');
    opsRow.style.cssText = 'display:flex; gap:10px; margin-bottom:12px;';
    const placeBtn = document.createElement('button');
    placeBtn.textContent = 'Place Flame';
    placeBtn.style.flex = '1';
    placeBtn.onclick = () => {
      try {
        const idx = this.api.placeFlame?.();
        if (idx >= 0) {
          this._refreshFixedList(idx);
        }
      } catch (e) { this.debugger?.handleError(e, 'PlaceFlame'); }
    };
    const moveBtn = document.createElement('button');
    moveBtn.textContent = 'Adjust/Move';
    moveBtn.style.flex = '1';
    moveBtn.onclick = () => {
      const on = !(this.moveToggle?.classList.contains('on'));
      this.api.setMoveMode?.(on);
      this._setMoveToggle(on);
    };
    opsRow.appendChild(placeBtn);
    opsRow.appendChild(moveBtn);
    panel.appendChild(opsRow);
    this.moveToggle = moveBtn;

    // NEW: Fixed flames selector + Copy
    const fixedRow = document.createElement('div');
    fixedRow.style.cssText = 'display:flex; gap:10px; align-items:center; margin-bottom:12px;';
    const select = document.createElement('select');
    select.style.cssText = 'flex:1; background:#1f1f28; color:#fff; border:1px solid #444; padding:6px; border-radius:4px;';
    select.onchange = () => {
      const idx = parseInt(select.value, 10);
      this.api.selectFixed?.(idx);
    };
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Fixed Positions';
    copyBtn.onclick = async () => {
      try {
        const json = this.api.copyFixedJSON?.() ?? '[]';
        await navigator.clipboard.writeText(json);
        copyBtn.textContent = 'Copied!';
        setTimeout(()=> copyBtn.textContent = 'Copy Fixed Positions', 1200);
      } catch (e) { this.debugger?.handleError(e, 'CopyFixed'); }
    };
    fixedRow.appendChild(select);
    fixedRow.appendChild(copyBtn);
    panel.appendChild(fixedRow);
    this.fixedSelect = select;

    // helper to add slider+box rows
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

    const c = this.api.get?.() ?? {};
    const make = (id, label, min, max, key, stepBox = 0.1, stepSlider = 1) =>
      addRow(id, label, min, max, key, stepBox, stepSlider);

    // layout
    this._hr(panel);
    make('fw','Flame Width ×',                  0.01,  80.0, 'flameWidthFactor');
    make('fh','Flame Height ×',                 0.01, 120.0, 'flameHeightFactor');
    make('fy','Flame Y Offset (m)',          -1200.0, 2400.0, 'flameYOffset', 0.1, 0.1);

    this._hr(panel);
    make('in','Intensity ×',                      0.0,    5.0, 'intensity', 0.1, 0.1);
    make('tp','Taper (0=wide,1=thin)',            0.0,    1.0, 'taper', 0.01, 0.01);
    make('bg','Bulge (mid-body)',                 0.0,    1.0, 'bulge', 0.01, 0.01);
    make('td','TearDrop (pinch)',                 0.0,    1.0, 'tear', 0.01, 0.01);
    make('tb','Turbulence',                       0.0,    1.0, 'turbulence', 0.01, 0.01);
    make('ns','Noise Speed',                      0.0,    5.0, 'noiseSpeed', 0.01, 0.01);
    make('ds','Mach Diamonds Strength',           0.0,    2.0, 'diamondsStrength', 0.01, 0.01);
    make('df','Mach Diamonds Freq.',              0.0,   40.0, 'diamondsFreq', 0.1, 0.1);

    make('os','Orange Band Shift',               -0.50,   0.50, 'orangeShift', 0.01, 0.01);

    this._hr(panel);
    make('rs','Rim Strength (halo)',              0.0,    1.0, 'rimStrength', 0.01, 0.01);
    make('rp','Rim Speed',                         0.0,    6.0, 'rimSpeed', 0.01, 0.01);

    this._hr(panel);
    make('cb','Color: Cyan',                       0.0,    3.0, 'colorCyan', 0.01, 0.01);
    make('co','Color: Orange',                     0.0,    3.0, 'colorOrange', 0.01, 0.01);
    make('cw','Color: White Core',                 0.0,    3.0, 'colorWhite', 0.01, 0.01);

    this._hr(panel);
    make('gx','FX Offset X (m)',                -800.0,  800.0, 'groupOffsetX', 0.1, 0.1);
    make('gy','FX Offset Y (m)',               -2400.0, 2400.0, 'groupOffsetY', 0.1, 0.1);
    make('gz','FX Offset Z (m)',                -800.0,  800.0, 'groupOffsetZ', 0.1, 0.1);

    this._hr(panel);
    make('tfs','Tail Fade Start (0–1)',            0.00,   1.00, 'tailFadeStart', 0.01, 0.01);
    make('tff','Tail Feather (softness)',          0.10,   6.00, 'tailFeather', 0.01, 0.01);
    make('tfn','Tail Noise',                       0.00,   0.40, 'tailNoise', 0.01, 0.01);

    const hint = document.createElement('p');
    hint.style.cssText = 'margin:6px 0 0; color:#9aa; font-size:.85em;';
    hint.textContent = 'Open panel pauses camera. Tap “Adjust/Move”, then drag on the canvas to move the selected fixed flame (X/Z only).';
    panel.appendChild(hint);

    document.body.appendChild(panel);
    this.panel = panel;

    // seed
    this._syncValuesFromAPI();
    this._refreshButtons();
  }

  _hr(panel) {
    const hr = document.createElement('div');
    hr.style.cssText = 'height:1px;background:#444;margin:12px 0;';
    panel.appendChild(hr);
  }

  _setMoveToggle(on) {
    if (!this.moveToggle) return;
    if (on) {
      this.moveToggle.classList.add('on');
      this.moveToggle.style.backgroundColor = 'rgba(79,143,247,0.9)';
    } else {
      this.moveToggle.classList.remove('on');
      this.moveToggle.style.backgroundColor = 'rgba(30, 30, 36, 0.8)';
    }
  }

  _refreshFixedList(selectIndex = null) {
    if (!this.fixedSelect) return;
    const list = this.api.getFixedList?.() ?? [];
    this.fixedSelect.innerHTML = '';
    list.forEach(({ index, groupOffsetX, groupOffsetY, groupOffsetZ }) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = `#${index}  X:${groupOffsetX}  Y:${groupOffsetY}  Z:${groupOffsetZ}`;
      this.fixedSelect.appendChild(opt);
    });
    if (list.length > 0) {
      const idx = (selectIndex !== null) ? selectIndex : list.length - 1;
      this.fixedSelect.value = String(idx);
      this.api.selectFixed?.(idx);
    }
  }

  /* ---------------- read/apply ---------------- */

  _collectPatchFromInputs() {
    const patch = {};
    for (const [id, def] of Object.entries(this.inputs)) {
      const v = parseFloat(def.box?.value ?? def.slider?.value);
      if (!Number.isFinite(v)) continue;
      patch[def.key] = v;
    }
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

  _syncValuesFromAPI() {
    const c = this.api.get?.() ?? {};
    for (const [id, def] of Object.entries(this.inputs)) {
      const key = def.key;
      if (!key) continue;
      let v = c[key];
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