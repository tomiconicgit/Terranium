// bootstrap.js: Handles loading screen and async loading of main app

document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    
    // Load Three.js from CDN
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.onload = () => {
        // Load main.js after Three.js
        const mainScript = document.createElement('script');
        mainScript.src = 'src/main.js';
        mainScript.type = 'module';
        mainScript.onload = () => {
            loadingDiv.style.display = 'none';
        };
        document.body.appendChild(mainScript);
    };
    document.body.appendChild(threeScript);
});