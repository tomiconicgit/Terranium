/* Cinematic bootstrap for PWA
   Sequence (~6.5s total):
   0.0–0.5s  : black
   0.5–1.2s  : cyan scanline + noise hiss
   1.2–2.8s  : logo flicker/glitch in darkness
   2.8–6.0s  : lunar surface flyover + crisp logo
   6.0–6.5s  : fade to app and import ./src/main.js

   Requirements: vendor/three.module.js (and nothing else)
   Optional (auto-handled): assets/audio/intro.ogg (short static+hum), if present
*/

(() => {
  const onReady = (fn) =>
    (document.readyState === 'loading')
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();

  onReady(() => {
    // Mark bootstrap active so your app can suppress its own overlay if needed.
    window.__tcBootstrapActive = true;

    // Root mount
    const root = document.body;

    // ---------- Styles ----------
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap');

      :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --scan-cyan: #00eaff;
        --logo-white: #e8f0ff;
        --accent: #7ecbff;
      }
      html, body { margin:0; padding:0; height:100%; background:#000; color:#fff; overflow:hidden; }
      .cin-wrap {
        position:fixed; inset:0; z-index:999999;
        background: #000; display:grid; place-items:center;
        font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .cin-fg {
        position:absolute; inset:0; pointer-events:none;
      }
      /* Subtle film grain */
      .cin-grain::before {
        content:''; position:absolute; inset:0; opacity:.08; mix-blend-mode:screen;
        background-image:
          radial-gradient(transparent 0, transparent 1px, rgba(255,255,255,.15) 1px, rgba(255,255,255,.15) 2px, transparent 2px);
        background-size: 3px 3px; filter:contrast(120%);
        animation: grainShift 1.2s steps(2,end) infinite;
      }
      @keyframes grainShift { 50% { transform: translate3d(1px,-1px,0); } }

      /* Cyan scanline */
      .scanline {
        position:absolute; left:0; right:0; height:1px; background:var(--scan-cyan);
        box-shadow: 0 0 18px 4px rgba(0,234,255,.55), 0 0 2px rgba(0,234,255,1);
        transform: translateY(50vh) scaleY(0.8);
        opacity:0;
      }

      /* Logo block */
      .logo {
        display:flex; flex-direction:column; align-items:center; gap:.35rem;
        letter-spacing:.06em; text-align:center; opacity:0; filter: blur(2px);
        transform: translateY(8px);
      }
      .logo-id {
        font-family:'Anton', sans-serif;
        font-size: clamp(60px, 16vw, 180px);
        line-height:.8; color:var(--logo-white);
        letter-spacing:.02em;
        text-shadow: 0 0 18px rgba(126,203,255,.25);
      }
      .logo-text {
        font-family:'Anton', sans-serif;
        font-weight: 800;
        font-size: clamp(18px, 5.6vw, 44px);
        letter-spacing:.18em;
        color: var(--logo-white);
        text-shadow: 0 0 12px rgba(126,203,255,.15);
      }
      .logo-rule {
        width: clamp(120px, 40vw, 520px); height:2px;
        background: linear-gradient(90deg, transparent, #5ab8ff 35%, #a8dcff 50%, #5ab8ff 65%, transparent);
        margin:.4rem 0 .2rem;
        opacity:.85;
      }

      /* Glitch (CSS only, mild) */
      .glitchy {
        animation: logoIn .38s ease-out forwards, glitch .7s steps(6,end) .1s 2;
      }
      @keyframes logoIn {
        to { opacity:1; filter:blur(0); transform: translateY(0); }
      }
      @keyframes glitch {
        0%   { clip-path: inset(0 0 0 0); transform: translate3d(0,0,0); }
        20%  { clip-path: inset(0 0 80% 0); transform: translate3d(-1px,1px,0); }
        40%  { clip-path: inset(80% 0 0 0); transform: translate3d(1px,-1px,0); }
        60%  { clip-path: inset(10% 0 30% 0); }
        80%  { clip-path: inset(40% 0 20% 0); }
        100% { clip-path: inset(0 0 0 0); }
      }

      /* Fade to app */
      .fade-out { animation: fadeOut .55s ease-in forwards; }
      @keyframes fadeOut { to { opacity:0; filter:blur(4px); } }

      /* HUD hint (small) */
      .hint {
        position:absolute; bottom: calc(10px + var(--safe-bottom));
        width:100%; text-align:center; font-size:.78rem; opacity:.35; letter-spacing:.04em;
      }
    `;
    document.head.appendChild(style);

    // ---------- DOM ----------
    const wrap = document.createElement('div');
    wrap.className = 'cin-wrap cin-grain';
    wrap.setAttribute('aria-hidden', 'true');

    const fg = document.createElement('div');
    fg.className = 'cin-fg';
    wrap.appendChild(fg);

    // Scanline
    const scan = document.createElement('div');
    scan.className = 'scanline';
    fg.appendChild(scan);

    // Logo block
    const logo = document.createElement('div');
    logo.className = 'logo';
    logo.innerHTML = `
      <div class="logo-id">ID</div>
      <div class="logo-rule"></div>
      <div class="logo-text">ICONIC DEVELOPMENTS</div>
    `;
    wrap.appendChild(logo);

    // Hint
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '© Iconic Developments';
    wrap.appendChild(hint);

    root.appendChild(wrap);

    // ---------- Audio (optional) ----------
    let audio;
    try {
      audio = new Audio('assets/audio/intro.ogg'); // add a short static+low-hum if you like
      audio.crossOrigin = 'anonymous';
      audio.volume = 0.35;
      // Don’t block sequence if it can’t autoplay on iOS; ignore errors.
      audio.play().catch(() => {});
    } catch (_) {}

    // ---------- Three.js scene ----------
    // Load THREE from your vendor bundle
    let THREE;
    try {
      // If you're already loading three globally elsewhere, use window.THREE instead.
      // eslint-disable-next-line no-undef
      THREE = window.THREE ?? null;
      if (!THREE) throw new Error('THREE not on window. Include vendor/three.module.js via <script type="module"> in index.html, or expose THREE globally.');
    } catch (e) {
      console.warn('[Cinematic] THREE not found on window. Attempting dynamic import...');
    }

    // Create renderer attached to wrap
    let renderer, scene, camera, clock, controls = null, raf = 0, disposed = false;

    function init3D() {
      // Lazy bail-out if three’s unavailable
      if (!window.THREE) return;

      THREE = window.THREE;

      const w = innerWidth, h = innerHeight;
      renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      wrap.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x020205, 0.03);

      camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 1500);
      camera.position.set(-6, 3.2, 7.5);
      camera.lookAt(0, 0.8, -6);

      // Stars
      const starGeo = new THREE.BufferGeometry();
      const starCount = 800;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 180 + Math.random()*220;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random()*2)-1);
        positions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i*3+1] = r * Math.cos(phi);
        positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({ size: 0.9, sizeAttenuation: true, color: 0x9ecfff, transparent:true, opacity: .85, depthWrite:false });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      // Moon surface (procedural displaced plane for “lunar” look)
      const size = 300, seg = 220;
      const plane = new THREE.PlaneGeometry(size, size, seg, seg);
      // Displace vertices with layered noise-ish function
      const pos = plane.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const r = Math.hypot(x, y);
        const n =
          craterNoise(x, y, 0.006) * 1.4 +
          craterNoise(x+33, y-17, 0.012) * 0.7 +
          craterNoise(x*0.6, y*1.4, 0.02) * 0.35;
        // Gentle curvature + craters
        const curve = -0.0018 * r;
        pos.setZ(i, (n + curve));
      }
      plane.computeVertexNormals();

      const moonMat = new THREE.MeshStandardMaterial({
        color: 0x9ea4ad,
        roughness: 0.95,
        metalness: 0.0,
      });
      const moon = new THREE.Mesh(plane, moonMat);
      moon.rotation.x = -Math.PI / 2;
      moon.receiveShadow = true;
      moon.castShadow = false;
      scene.add(moon);

      // Rim light + key light for lunar look
      const hemi = new THREE.HemisphereLight(0x9bbcff, 0x101014, 0.35);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xcfe3ff, 1.1);
      dir.position.set(-12, 14, 6);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024,1024);
      dir.shadow.camera.near = 0.5;
      dir.shadow.camera.far = 80;
      dir.shadow.normalBias = 0.02;
      scene.add(dir);

      // A faint back light to rim the terrain
      const rim = new THREE.DirectionalLight(0x88b0ff, 0.35);
      rim.position.set(12, 8, -10);
      scene.add(rim);

      // Camera path targets
      clock = new THREE.Clock();

      // Resize
      addEventListener('resize', () => {
        if (!renderer || disposed) return;
        const W = innerWidth, H = innerHeight;
        renderer.setSize(W, H);
        camera.aspect = W/H; camera.updateProjectionMatrix();
      });

      // Render loop
      const startT = performance.now();
      (function loop() {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        const t = (performance.now() - startT) / 1000;

        // Subtle star twinkle (scale material size)
        starMat.size = 0.9 + Math.sin(t*1.7)*0.08;

        // Camera glide forward + slight dolly and pan for drama
        const fly = Math.min(1, Math.max(0, (t - 2.8) / 2.6)); // 0..1 during 2.8–5.4s
        const ease = (x)=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
        const k = ease(fly);
        camera.position.x = -6 + 4.8*k;
        camera.position.y = 3.2 + 0.4*Math.sin(t*0.7)*(1-k) + 0.4*k;
        camera.position.z = 7.5 - 6.9*k;
        camera.lookAt(0, 0.85 + 0.2*k, -6 + 1.2*k);

        renderer.render(scene, camera);
      })();
    }

    // Simple crater-ish noise based on radial bumps
    function craterNoise(x, y, f) {
      const s = Math.sin, c = Math.cos;
      const r = Math.hypot(x, y)*f;
      const a = s(x*f*2.3) * c(y*f*1.7);
      const b = s((x+y)*f*0.9) * s((x-y)*f*1.3);
      const crater = -Math.exp(-r*1.6) * 1.4; // central basin
      return (a*0.6 + b*0.4) + crater*0.12;
    }

    // ---------- Timeline ----------
    // 0.5s: scanline appears, sweeps; 1.2s: logo flickers; 2.8s: start 3D
    const t0 = performance.now();

    // Scanline anim
    setTimeout(() => {
      scan.style.opacity = '1';
      scan.animate(
        [
          { transform: 'translateY(0vh) scaleY(0.8)', offset: 0 },
          { transform: 'translateY(100vh) scaleY(1.2)', offset: 1 }
        ],
        { duration: 550, easing: 'cubic-bezier(.22,.7,.23,1)' }
      ).onfinish = () => { scan.style.opacity = '0'; };
    }, 500);

    // Logo glitch-in
    setTimeout(() => {
      logo.classList.add('glitchy');
    }, 1200);

    // Bring up 3D lunar view behind logo
    setTimeout(() => {
      try { init3D(); } catch (e) { console.error('[Cinematic] init3D failed:', e); }
      // Sharpen logo and hold (remove glitch)
      setTimeout(() => { logo.classList.remove('glitchy'); logo.style.opacity = '1'; logo.style.filter = 'none'; }, 500);
    }, 2800);

    // Fade out and load app
    setTimeout(async () => {
      wrap.classList.add('fade-out');
      try { audio && audio.pause(); } catch (_) {}
      // Clean up three
      setTimeout(() => {
        disposed = true;
        if (renderer) {
          cancelAnimationFrame(raf);
          renderer.dispose?.();
          wrap.removeChild(renderer.domElement);
        }
        scene = camera = renderer = null;
        // Remove cinematic wrapper
        wrap.remove();
      }, 520);

      // ---- Load your app after the cinematic ----
      // If you already have a gated loader, call it here instead.
      try {
        // Dynamically import your app entry
        await import('./src/main.js');
      } catch (err) {
        console.error('[Bootstrap] Failed to load app:', err);
        // Fallback: show a minimal error overlay
        showErrorOverlay('Failed to start app', err);
      } finally {
        window.__tcBootstrapActive = false;
      }
    }, 6000);

    // ---------- Error overlay ----------
    function showErrorOverlay(msg, err) {
      const pre = (err && (err.stack || err.message)) ? '\n\n' + (err.stack || err.message) : '';
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(10,12,16,.96);' +
        'color:#fff;font-family:ui-monospace,Menlo,monospace;padding:18px;overflow:auto;white-space:pre-wrap';
      el.textContent = '[Bootstrap] ' + msg + pre;
      document.body.appendChild(el);
    }

    // ---------- Global safeguards ----------
    window.addEventListener('error', (e) => {
      console.error('[Bootstrap] error', e.message, e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Bootstrap] unhandledrejection', e.reason);
    });
  });
})();