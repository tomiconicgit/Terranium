<script>
// bootstrap.js — staged loader with progress %, tweening, and stall notice

document.addEventListener('DOMContentLoaded', () => {
  // --- UI: build a compact progress bar inside #loading ---
  const loadingRoot = document.getElementById('loading') || (() => {
    const d = document.createElement('div'); d.id = 'loading'; document.body.appendChild(d); return d;
  })();

  const style = document.createElement('style');
  style.textContent = `
    #loading {
      position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #eaeaea; background:#000;
    }
    .ld-card {
      width: min(420px, 88vw); padding: 16px 16px 14px; border-radius: 12px;
      background: rgba(18,20,24,0.65); backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    .ld-title { font-weight: 600; font-size: 16px; letter-spacing: .2px; margin-bottom: 10px; color:#fff; }
    .ld-row { display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; }
    .ld-status { font-size: 12px; color:#b9c2cf; min-height: 1em; }
    .ld-pct { font-variant-numeric: tabular-nums; font-size: 12px; color:#dfe7f3; }
    .ld-bar {
      width: 100%; height: 8px; border-radius: 999px; background: #161a20; overflow: hidden; position: relative;
      border: 1px solid rgba(255,255,255,0.07);
    }
    .ld-fill {
      position:absolute; inset:0; width:0%; border-radius: inherit; transform-origin: left center;
      background: linear-gradient(90deg, #1e90ff, #42ffd2);
    }
    .ld-hint { margin-top:8px; font-size:11px; color:#8aa0b8; min-height:1em; }
    .ld-warn { color:#ffb86b; }
    .ld-err  { color:#ff6666; }
  `;
  document.head.appendChild(style);

  loadingRoot.innerHTML = `
    <div class="ld-card">
      <div class="ld-title">Terranium — loading…</div>
      <div class="ld-row">
        <div class="ld-status" id="ld-status">Starting…</div>
        <div class="ld-pct" id="ld-pct">0%</div>
      </div>
      <div class="ld-bar"><div class="ld-fill" id="ld-fill"></div></div>
      <div class="ld-hint" id="ld-hint"></div>
    </div>
  `;

  const elFill = document.getElementById('ld-fill');
  const elPct  = document.getElementById('ld-pct');
  const elStat = document.getElementById('ld-status');
  const elHint = document.getElementById('ld-hint');

  // --- Progress engine (tweened) ---
  let targetPct = 0;
  let currentPct = 0;
  let lastBump = performance.now();
  const tweenSpeed = 0.18; // higher = faster
  function raf() {
    currentPct += (targetPct - currentPct) * tweenSpeed;
    const shown = Math.min(99.0, currentPct); // avoid hitting 100 before we actually finish
    elFill.style.width = shown.toFixed(1) + '%';
    elPct.textContent = Math.round(shown) + '%';
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function setProgress(p, label) {
    targetPct = Math.max(targetPct, Math.min(100, p));
    lastBump = performance.now();
    if (label) elStat.textContent = label;
  }

  function bump(by, label) {
    setProgress(targetPct + by, label);
  }

  function fail(msg) {
    elStat.textContent = 'Load failed';
    elHint.textContent = msg || 'Unknown error';
    elHint.classList.remove('ld-warn'); elHint.classList.add('ld-err');
  }

  // Watchdog: if progress hasn't advanced for N seconds, show hint
  const STALL_MS = 8000;
  setInterval(() => {
    if (targetPct >= 100) return;
    const idle = performance.now() - lastBump;
    if (idle > STALL_MS) {
      elHint.textContent = 'Still working… (slow network or blocked file). If it stays here, refresh.';
      elHint.classList.add('ld-warn');
    }
  }, 2000);

  // Allow the app to report deeper asset progress (HDR/textures) if desired:
  //   document.dispatchEvent(new CustomEvent('bootstrap-progress', { detail: { value: 72, label: 'Loading HDRI…' } }))
  document.addEventListener('bootstrap-progress', (e) => {
    const v = Number(e?.detail?.value);
    const label = e?.detail?.label;
    if (!Number.isNaN(v)) setProgress(v, label);
  });

  // Helper to add scripts with nice errors
  function add(src, { type, defer } = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      if (type) s.type = type;
      if (defer) s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.body.appendChild(s);
    });
  }

  // --- Staged load plan (percent allocations) ---
  // You can tweak weights; they should sum to 100 before main.js finishes.
  const stages = [
    { name: 'Core',         pct: 25, url: 'https://unpkg.com/three@0.128.0/build/three.min.js' },
    { name: 'RGBELoader',   pct: 20, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/RGBELoader.js' },
    { name: 'fflate',       pct: 10, url: 'https://unpkg.com/three@0.128.0/examples/js/libs/fflate.min.js' },
    { name: 'EXRLoader',    pct: 15, url: 'https://unpkg.com/three@0.128.0/examples/js/loaders/EXRLoader.js' },
    // Leave ~20–25% headroom for app bootstrap / first frame
  ];

  (async () => {
    setProgress(2, 'Starting…');

    for (const st of stages) {
      elHint.textContent = '';
      await add(st.url).then(() => {
        bump(st.pct, `Loaded ${st.name}`);
      }).catch((err) => {
        console.error(err);
        fail(err.message);
        throw err;
      });
    }

    // Load the app module
    setProgress(targetPct + 10, 'Starting app…');
    await add('src/main.js', { type: 'module' })
      .then(() => {
        setProgress(100, 'Ready');
        // Small delay so users see 100%
        setTimeout(() => {
          if (loadingRoot) loadingRoot.style.display = 'none';
        }, 250);
      })
      .catch((err) => {
        console.error(err);
        fail(err.message);
        // Keep the overlay visible so the error is readable
      });

  })().catch((err) => {
    console.error(err);
    fail(err.message || String(err));
  });

  // Expose a simple hook in case your app wants to override/hard-set progress
  window.tcSetProgress = (value, label) => setProgress(value, label);
});
</script>