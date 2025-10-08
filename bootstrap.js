<!-- loads THREE (global), RGBELoader, fflate, EXRLoader, then your app -->
<script>
document.addEventListener('DOMContentLoaded', () => {
  const loadingDiv = document.getElementById('loading');

  function add(src, {type, defer} = {}) {
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

  (async () => {
    // Use unpkg for r128 with the non-module "examples/js" loaders
    await add('https://unpkg.com/three@0.128.0/build/three.min.js');
    await add('https://unpkg.com/three@0.128.0/examples/js/loaders/RGBELoader.js');

    // EXRLoader depends on fflate (non-module build)
    await add('https://unpkg.com/three@0.128.0/examples/js/libs/fflate.min.js');
    await add('https://unpkg.com/three@0.128.0/examples/js/loaders/EXRLoader.js');

    // Now load your module entry
    await add('src/main.js', { type: 'module' });

    if (loadingDiv) loadingDiv.style.display = 'none';
  })().catch(err => {
    console.error(err);
    if (loadingDiv) loadingDiv.textContent = 'Failed to load: ' + err.message;
  });
});
</script>