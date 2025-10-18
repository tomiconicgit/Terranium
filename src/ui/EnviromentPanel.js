// src/ui/EnvironmentPanel.js
// Small UI for switching sky/lighting Day↔Dusk and tweaking the plume light rig.
//
// Main wires it like:
//
// this.envPanel = new EnvironmentPanelUI({
//   setDay:  () => this.applyDayPreset(),
//   setDusk: () => this.applyDuskPreset(),
//   getPlume: () => this.plumeRig?.getParams(),
//   setPlume: (patch) => this.plumeRig?.setParams(patch),
// }, this.debugger);

export class EnvironmentPanelUI {
  constructor(api, dbg) {
    this.api = api;
    this.debugger = dbg;
    this.panel = null;
    this.ctrl = {};
    this._build();
  }

  _build() {
    const container = document.getElementById('ui-container') || document.body;

    // Toggle button
    const openBtn = document.createElement('button');
    openBtn.id = 'environment-panel-btn';
    openBtn.textContent = 'Environment';
    openBtn.title = 'Open environment & plume lighting controls';
    openBtn.style.cssText = `
      position:fixed; top:20px; left:20px; z-index:11;
      padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.25);
      background:rgba(30,30,36,0.9); color:#fff; cursor:pointer;`;
    openBtn.onclick = () => {
      if (!this.panel) return;
      this.panel.style.display = (this.panel.style.display === 'block') ? 'none' : 'block';
      if (this.panel.style.display === 'block') this._syncFromRig();
    };
    container.appendChild(openBtn);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'environment-panel';
    panel.style.cssText = `
      position:fixed; top:60px; left:20px; z-index:10; width:340px; max-height:76vh;
      overflow:auto; padding:14px; display:none; border-radius:10px;
      background:rgba(24,24,28,0.95); color:#fff; border:1px solid rgba(255,255,255,0.18);
      box-shadow:0 10px 20px rgba(0,0,0,0.35); backdrop-filter:blur(8px);
      -webkit-overflow-scrolling: touch;`;
    (document.getElementById('ui-container') || document.body).appendChild(panel);
    this.panel = panel;

    const h = document.createElement('h4');
    h.textContent = 'Environment & Plume Lighting';
    h.style.cssText = 'margin:0 0 10px; border-bottom:1px solid #3f3f45; padding-bottom:8px;';
    panel.appendChild(h);

    // Day / Dusk row
    const rowDay = document.createElement('div');
    rowDay.style.cssText = 'display:flex; gap:10px; margin-bottom:14px;';
    const dayBtn = document.createElement('button');
    dayBtn.textContent = 'Day';
    dayBtn.style.cssText = 'flex:1; padding:8px; background:#2c7ef2; color:#fff; border:none; border-radius:6px; cursor:pointer;';
    dayBtn.onclick = () => { try { this.api.setDay?.(); } catch(e){ this.debugger?.handleError(e,'EnvPanel.Day'); } };
    const duskBtn = document.createElement('button');
    duskBtn.textContent = 'Dusk';
    duskBtn.style.cssText = 'flex:1; padding:8px; background:#f28c2c; color:#fff; border:none; border-radius:6px; cursor:pointer;';
    duskBtn.onclick = () => { try { this.api.setDusk?.(); } catch(e){ this.debugger?.handleError(e,'EnvPanel.Dusk'); } };
    rowDay.appendChild(dayBtn); rowDay.appendChild(duskBtn);
    panel.appendChild(rowDay);

    // Subheader
    const sub = document.createElement('h5');
    sub.textContent = 'Rocket Flame Lighting';
    sub.style.cssText = 'margin:8px 0 8px;';
    panel.appendChild(sub);

    const form = document.createElement('div');
    form.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
    panel.appendChild(form);

    // helpers
    const mkSlider = (label, id, min, max, step, suffix, tooltip) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <label style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span title="${tooltip||''}">${label}</span>
          <span><input type="number" id="${id}-num" style="width:90px; background:#1c1c22; color:#fff; border:1px solid #3a3a3f; border-radius:4px; padding:3px;" step="${step}" min="${min}" max="${max}"> ${suffix||''}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" style="width:100%; accent-color:#4f8ff7;">
      `;
      form.appendChild(wrap);
      const s = wrap.querySelector('#'+id);
      const n = wrap.querySelector('#'+id+'-num');
      return { s, n, min, max, step };
    };
    const mkColor = (label, id, def) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <label style="display:flex; justify-content:space-between; align-items:center;">
          <span>${label}</span>
          <input type="color" id="${id}" value="${def}" style="width:42px; height:28px; padding:0; border:none; background:transparent;">
        </label>
      `;
      form.appendChild(wrap);
      return wrap.querySelector('#'+id);
    };

    // Controls
    this.ctrl = {
      angle:   mkSlider('Spot Angle',       'pl_angle',   10, 60, 1, 'deg', 'Spot cone angle'),
      pen:     mkSlider('Spot Penumbra',    'pl_pen',      0, 60, 1, '%',   'Edge softness'),
      sScale:  mkSlider('Spot Intensity ×', 'pl_sscale',   0, 300, 1, '%',  'Multiplier (100% = default)'),
      pScale:  mkSlider('Point Intensity ×','pl_pscale',   0, 300, 1, '%',  'Multiplier (100% = default)'),
      dist:    mkSlider('Spot Distance',    'pl_dist',    50, 400, 1, 'm',  'Max range before falloff'),
      core:    mkColor('Cookie: Core',   'pl_core',  '#fff7e6'),
      orange:  mkColor('Cookie: Orange', 'pl_oran',  '#ffba78'),
      cyan:    mkColor('Cookie: Cyan',   'pl_cyan',  '#80fbfd'),
    };

    // Reset
    const resetRow = document.createElement('div');
    resetRow.style.cssText = 'display:flex; gap:10px; margin-top:4px;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Plume Light';
    resetBtn.style.cssText = 'flex:1; padding:8px; background:#2b2f3a; color:#fff; border:none; border-radius:6px; cursor:pointer;';
    resetBtn.onclick = () => this._apply({
      spotAngleDeg: 30, spotPenumbra: 0.35, spotDistance: 260,
      spotIntensityScale: 1.0, pointIntensityScale: 1.0,
      cookieCore: '#fff7e6', cookieOrange: '#ffba78', cookieCyan: '#80fbfd'
    });
    resetRow.appendChild(resetBtn);
    form.appendChild(resetRow);

    // Bind sliders ↔ numbers ↔ apply
    const link = (c, key, mapFromUI, mapToUI) => {
      const apply = () => this._apply({ [key]: mapFromUI() });
      c.s.oninput = () => { c.n.value = mapToUI(c.s.value); apply(); };
      c.n.onchange = () => {
        let v = parseFloat(c.n.value); if (!Number.isFinite(v)) v = parseFloat(c.s.value);
        v = Math.max(c.min, Math.min(c.max, v));
        c.n.value = mapToUI(v); c.s.value = v; apply();
      };
    };
    link(this.ctrl.angle,  'spotAngleDeg',      ()=>+this.ctrl.angle.s.value,  v=>String(+v));
    link(this.ctrl.pen,    'spotPenumbra',      ()=>+this.ctrl.pen.s.value/100, v=>String(+v));
    link(this.ctrl.sScale, 'spotIntensityScale',()=>+this.ctrl.sScale.s.value/100, v=>String(+v));
    link(this.ctrl.pScale, 'pointIntensityScale',()=>+this.ctrl.pScale.s.value/100, v=>String(+v));
    link(this.ctrl.dist,   'spotDistance',      ()=>+this.ctrl.dist.s.value,  v=>String(+v));

    // Colors
    const applyColors = () => this._apply({
      cookieCore:   this.ctrl.core.value,
      cookieOrange: this.ctrl.orange.value,
      cookieCyan:   this.ctrl.cyan.value
    });
    this.ctrl.core.oninput = applyColors;
    this.ctrl.orange.oninput = applyColors;
    this.ctrl.cyan.oninput = applyColors;

    this._syncFromRig();
  }

  _syncFromRig() {
    const p = this.api.getPlume?.();
    if (!p) return;
    const deg = p.spotAngleDeg ?? 30;
    const pen = (p.spotPenumbra ?? 0.35) * 100;
    const ss  = (p.spotIntensityScale ?? 1.0) * 100;
    const ps  = (p.pointIntensityScale ?? 1.0) * 100;
    const dist= p.spotDistance ?? 260;

    this.ctrl.angle.s.value  = String(deg);  this.ctrl.angle.n.value  = String(deg);
    this.ctrl.pen.s.value    = String(pen);  this.ctrl.pen.n.value    = String(pen);
    this.ctrl.sScale.s.value = String(ss);   this.ctrl.sScale.n.value = String(ss);
    this.ctrl.pScale.s.value = String(ps);   this.ctrl.pScale.n.value = String(ps);
    this.ctrl.dist.s.value   = String(dist); this.ctrl.dist.n.value   = String(dist);

    if (p.cookieCore)   this.ctrl.core.value   = toHex(p.cookieCore);
    if (p.cookieOrange) this.ctrl.orange.value = toHex(p.cookieOrange);
    if (p.cookieCyan)   this.ctrl.cyan.value   = toHex(p.cookieCyan);
  }

  _apply(patch) {
    try { this.api.setPlume?.(patch); }
    catch (e) { this.debugger?.handleError(e, 'EnvPanel.Apply'); }
  }
}

function toHex(c) {
  try { return (typeof c === 'string') ? c : '#ffffff'; }
  catch { return '#ffffff'; }
}