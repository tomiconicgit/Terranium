// bootstrap.js — better error detail (CORS), centered loader, dynamic import

(function attachErrorOverlay(){
  const show = (title, msg, meta='') => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.94);color:#fff;' +
      'font:12px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:16px;white-space:pre-wrap;overflow:auto';
    el.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${title}</div><div>${msg}</div>${meta?`<div style="opacity:.7;margin-top:8px">${meta}</div>`:''}`;
    document.body.appendChild(el);
  };
  // capture filename/line too
  window.addEventListener('error', e => {
    const meta = `\nFile: ${e.filename || '(unknown)'}:${e.lineno || 0}:${e.colno || 0}`;
    show('Unhandled error', (e.message || 'Script error.') + (e.error?.stack ? '\n\n'+e.error.stack : ''), meta);
  }, true);
  window.addEventListener('unhandledrejection', e => show('Unhandled rejection', String(e.reason)), true);
})();

document.addEventListener('DOMContentLoaded', () => {
  // centered overlay
  const loadingRoot = document.getElementById('loading') || (() => {
    const d = document.createElement('div'); d.id = 'loading'; document.body.appendChild(d); return d;
  })();
  loadingRoot.removeAttribute('style');
  loadingRoot.style.cssText =
    'position:fixed;inset:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
    'min-height:100svh;height:100dvh;width:100%;display:grid;place-items:center;background:#000;color:#eaeaea;' +
    'z-index:2147483646;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial';

  loadingRoot.innerHTML = `
    <div style="width:min(420px,88vw);padding:16px 16px 12px;border-radius:12px;background:rgba(18,20,24,.7);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 24px rgba(0,0,0,.35)">
      <div style="text-align:center;font-weight:600;font-size:16px;color:#fff;margin-bottom:10px">Terranium — loading…</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
        <div id="ld-status" style="font-size:12px;color:#b9c2cf;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Starting…</div>
        <div id="ld-pct" style="font-variant-numeric:tabular-nums;font-size:12px;color:#dfe7f3;width:3.5em;text-align:right">0%</div>
      </div>
      <div style="width:100%;height:10px;border-radius:999px;background:#161a20;overflow:hidden;border:1px solid rgba(255,255,255,.07);position:relative">
        <div id="ld-fill" style="position:absolute;inset:0;width:0%;border-radius:inherit;transform-origin:left center;background:linear-gradient(90deg,#1e90ff,#42ffd2)"></div>
      </div>
      <div id="ld-hint" style="margin-top:8px;font-size:11px;color:#8aa0b8;min-height:1em"></div>
      <details id="ld-details" style="display:none;margin-top:8px">
        <summary style="cursor:pointer;font-size:11px;color:#cdd7e3">Show error details</summary>
        <pre id="ld-pre" style="margin-top:6px;max-height:35vh;overflow:auto;background:#0b0b0c;color:#eaeaea;padding:8px;border-radius:8px"></pre>
      </details>
    </div>
  `;

  const elFill = document.getElementById('ld-fill');
  const elPct  = document.getElementById('ld-pct');
  const elStat = document.getElementById('ld-status');
  const elHint = document.getElementById('ld-hint');
  const elDet  = document.getElementById('ld-details');
  const elPre  = document.getElementById('ld-pre');

  // progress
  let targetPct = 0, currentPct = 0, lastBump = performance.now();
  const tweenSpeed = 0.18;
  (function raf(){ currentPct += (targetPct - currentPct) * tweenSpeed;
    const shown = Math.min(99.0, currentPct);
    elFill.style.width = shown.toFixed(1) + '%';
    elPct.textContent = Math.round(shown) + '%';
    requestAnimationFrame(raf);
  })();
  const setProgress = (p, label) => { targetPct = Math.max(targetPct, Math.min(100, p)); lastBump = performance.now(); if (label) elStat.textContent = label; };
  const bump = (by, label) => setProgress(targetPct + by, label);
  const showError = (title, msg) => { elStat.textContent = title || 'Load failed'; elHint.textContent = 'Tap to expand details below.'; elHint.style.color = '#ff6666'; elDet.style.display = ''; elPre.textContent = msg || 'Unknown error'; };

  // stall hint
  setInterval(() => {
    if (targetPct >= 100) return;
    if (performance.now() - lastBump > 8000) {
      elHint.textContent = 'Still working… (slow network or blocked file). If it stays here, refresh.';
      elHint.style.color = '#ffb86b';
    }
  }, 2000);

  // app can push progress
  document.addEventListener('bootstrap-progress', (e) => {
    const v = Number(e?.detail?.value); const label = e?.detail?.label;
    if (!Number.isNaN(v)) setProgress(v, label);
  });

  // helper (now sets crossOrigin for CDN scripts so errors aren’t masked)
  function add(src, { type, defer, crossOrigin } = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      if (type) s.type = type;
      if (defer) s.defer = true;
      if (crossOrigin) s.crossOrigin = crossOrigin; // <-- key
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(s);
    });
  }

  const stages = [
    { name: 'Core',       pct: 25, url: 'https://unpkg.com/three@0.128.0/build/three.min.js' },
    { name: 'RGBELoader', pct: 20, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/RGBELoader.js' },
    { name: 'fflate',     pct: 10, url: 'https://unpkg.com/three@0.128.0/examples/js/libs/fflate.min.js' },
    { name: 'EXRLoader',  pct: 15, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/EXRLoader.js' },
  ];

  (async () => {
    setProgress(2, 'Starting…');

    for (const st of stages) {
      elHint.textContent = '';
      try { await add(st.url, { crossOrigin: 'anonymous' }); bump(st.pct, `Loaded ${st.name}`); }
      catch (err) { console.error(err); showError('Load failed', `${err.message}\n\nCheck network/CORS and the URL.`); throw err; }
    }

    // main module (dynamic import gives precise failing import if any)
    setProgress(targetPct + 15, 'Starting app…'); // ~85%
    const appUrl = new URL('./src/main.js', document.baseURI).href;

    // preflight
    try {
      const res = await fetch(appUrl + `?cb=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${appUrl}\nCheck filename & casing.`);
    } catch (err) { console.error(err); showError('App file not reachable', String(err?.message || err)); return; }

    try {
      await import(appUrl + `?cb=${Date.now()}`);
      setProgress(100, 'Ready');
      setTimeout(() => { loadingRoot.style.display = 'none'; }, 250);
    } catch (err) {
      console.error(err);
      showError('App start failed', (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err));
    }
  })();
});