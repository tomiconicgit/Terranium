/**
 * Injects the necessary CSS for a professional bootstrap sequence.
 */
function injectBootstrapCSS() {
    // Import a clean, professional font from Google Fonts
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const cssStyles = `
        :root {
            --primary-accent: #00aaff; /* A vibrant, clean blue */
            --background-color: #000000;
            --text-color: #e0e0e0;
            --ui-background: #1a1a1a;
        }

        body {
            background-color: var(--background-color);
            color: var(--text-color);
            font-family: 'Montserrat', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
        }

        #app-root {
            width: 100%;
            text-align: center;
            opacity: 1;
            transition: opacity 0.5s ease-in-out;
        }

        /* Cinematic Intro Text */
        .cinematic-text {
            font-size: 2.5rem;
            font-weight: 300;
            letter-spacing: 0.5em;
            text-transform: uppercase;
            opacity: 0;
            transform: scale(0.95);
            transition: opacity 2s ease-in-out, transform 2s ease-in-out;
        }

        /* Loading Screen UI */
        .loading-container {
            width: 80%;
            max-width: 500px;
            margin: 0 auto;
            opacity: 0;
            transition: opacity 1s ease-in;
        }

        #loading-text {
            font-size: 0.9rem;
            font-weight: 300;
            letter-spacing: 1px;
            color: #aaa;
            height: 20px;
            transition: all 0.3s;
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background-color: var(--ui-background);
            border-radius: 2px;
            margin: 10px auto;
            overflow: hidden;
        }

        #progress-fill {
            width: 0%;
            height: 100%;
            background-color: var(--primary-accent);
            box-shadow: 0 0 10px var(--primary-accent);
            border-radius: 2px;
            transition: width 0.4s ease-out;
        }

        /* Start Button */
        #start-button {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.2rem;
            font-weight: 400;
            letter-spacing: 2px;
            text-transform: uppercase;
            padding: 15px 40px;
            margin-top: 30px;
            background-color: transparent;
            color: var(--primary-accent);
            border: 1px solid var(--primary-accent);
            border-radius: 4px;
            cursor: pointer;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.5s ease-out;
        }
        
        #start-button.visible {
            opacity: 1;
            transform: translateY(0);
        }

        #start-button:hover {
            background-color: var(--primary-accent);
            color: #fff;
            box-shadow: 0 0 20px var(--primary-accent);
        }

        /* General 'visible' class for fade-in animations */
        .visible {
            opacity: 1;
            transform: scale(1);
        }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = cssStyles;
    document.head.appendChild(styleElement);
}


// --- DOM and State Management ---
const appRoot = document.getElementById('app-root');

// --- Cinematic Intro ---
function playCinematicIntro() {
    return new Promise(resolve => {
        appRoot.innerHTML = `<div class="cinematic-text">ICONIC DEVELOPMENTS</div>`;
        const introText = appRoot.querySelector('.cinematic-text');
        
        // Sequence: Fade In -> Hold -> Fade Out
        setTimeout(() => introText.classList.add('visible'), 100);       // Fade in
        setTimeout(() => introText.classList.remove('visible'), 4000);   // Start fade out
        setTimeout(resolve, 6000);                                       // Resolve after fade out completes
    });
}

// --- Loading Screen ---
function showLoadingScreen() {
    return new Promise(resolve => {
        appRoot.innerHTML = `
            <div class="loading-container">
                <div class="progress-bar">
                    <div id="progress-fill"></div>
                </div>
                <p id="loading-text">Initializing boot sequence...</p>
            </div>
        `;
        const loadingContainer = appRoot.querySelector('.loading-container');
        setTimeout(() => loadingContainer.classList.add('visible'), 100);

        // --- Simulate More Realistic File Verification ---
        const filesToLoad = [
            'manifest.json', 'assets/core/engine.min.js', 'assets/shaders/terrain_frag.glsl',
            'assets/textures/skybox_px.png', 'assets/models/player_ship.gltf', 'config/settings.json'
        ];
        let filesLoaded = 0;
        const loadingText = document.getElementById('loading-text');
        const progressFill = document.getElementById('progress-fill');

        const fileCheckInterval = setInterval(() => {
            if (filesLoaded < filesToLoad.length) {
                const file = filesToLoad[filesLoaded];
                loadingText.textContent = `Verifying: ${file}...`;
                filesLoaded++;
                
                const progress = (filesLoaded / filesToLoad.length) * 100;
                progressFill.style.width = `${progress}%`;
            } else {
                clearInterval(fileCheckInterval);
                loadingText.textContent = 'System ready. Awaiting input.';
                setTimeout(resolve, 1000); // Wait a moment before showing button
            }
        }, 500); // Time per file
    });
}

// --- Start Game Screen ---
function showStartScreen() {
    // The loading UI is already visible, we just add the button to it.
    const loadingContainer = appRoot.querySelector('.loading-container');
    
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Game';
    startButton.id = 'start-button';
    
    startButton.addEventListener('click', () => {
        console.log("Starting Terranium...");
        appRoot.style.opacity = '0'; // Fade out the entire UI
        setTimeout(() => {
             appRoot.innerHTML = '<p>Game has started!</p>';
             appRoot.style.opacity = '1';
        }, 500);
    });

    loadingContainer.appendChild(startButton);
    // Use a timeout to allow the element to be in the DOM before adding the class
    setTimeout(() => startButton.classList.add('visible'), 100);
}

// --- Main Application Flow ---
async function main() {
    injectBootstrapCSS();
    await playCinematicIntro();
    await showLoadingScreen();
    showStartScreen();
}

// Start the bootstrap process
main();

