// bootstrap.js: Handles loading screen and async loading of main app

document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    
    // Load Three.js from CDN
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.onload = () => {
        const rgbeScript = document.createElement('script');
        rgbeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/RGBELoader.js';
        rgbeScript.onload = () => {
            const exrScript = document.createElement('script');
            exrScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/EXRLoader.js';
            exrScript.onload = () => {
                // Load main.js after loaders
                const mainScript = document.createElement('script');
                mainScript.src = 'src/main.js';
                mainScript.type = 'module';
                mainScript.onload = () => {
                    loadingDiv.style.display = 'none';
                };
                document.body.appendChild(mainScript);
            };
            document.body.appendChild(exrScript);
        };
        document.body.appendChild(rgbeScript);
    };
    document.body.appendChild(threeScript);
});