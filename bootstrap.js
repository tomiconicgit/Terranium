/**
 * Injects the necessary CSS for the bootstrap sequence directly into the HTML head.
 * This makes the loading screen and intro self-contained.
 */
function injectBootstrapCSS() {
    const cssStyles = `
        body {
            background-color: #000;
            color: #fff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
        }

        .cinematic-text {
            font-size: 3rem;
            font-weight: 300;
            letter-spacing: 4px;
            opacity: 0;
            transition: opacity 1.5s ease-in-out;
        }

        .loading-container {
            opacity: 0;
            transition: opacity 0.5s ease-in;
        }

        .progress-bar {
            width: 50%;
            max-width: 400px;
            height: 20px;
            background-color: #222;
            border: 1px solid #444;
            border-radius: 10px;
            margin: 20px auto;
            overflow: hidden;
        }

        #progress-fill {
            width: 0%;
            height: 100%;
            background-color: #00bfff; /* Deep Sky Blue */
            transition: width 0.5s ease-out;
        }

        .start-button {
            font-size: 1.5rem;
            padding: 15px 30px;
            background-color: #00bfff;
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.5s ease-in, transform 0.2s ease-out;
            transform: scale(0.95);
        }

        .start-button:hover {
            background-color: #009acd;
            transform: scale(1);
        }

        /* General 'visible' class for fade-in animations */
        .visible {
            opacity: 1;
            transform: scale(1);
        }
    `;

    // Create a <style> element and append it to the <head>
    const styleElement = document.createElement('style');
    styleElement.textContent = cssStyles;
    document.head.appendChild(styleElement);
}

// Get the main app container from the HTML
const appRoot = document.getElementById('app-root');

// --- Cinematic Intro ---
function playCinematicIntro() {
    return new Promise(resolve => {
        const introText = document.createElement('div');
        introText.textContent = 'Iconic Developments';
        introText.classList.add('cinematic-text');
        
        appRoot.innerHTML = '';
        appRoot.appendChild(introText);
        
        setTimeout(() => introText.classList.add('visible'), 100);
        setTimeout(() => introText.classList.remove('visible'), 3000);
        setTimeout(resolve, 4500);
    });
}

// --- Loading Screen ---
function showLoadingScreen() {
    return new Promise(resolve => {
        const loadingContainer = document.createElement('div');
        loadingContainer.classList.add('loading-container');
        loadingContainer.innerHTML = `
            <p id="loading-text">Loading game files...</p>
            <div class="progress-bar">
                <div id="progress-fill"></div>
            </div>
        `;

        appRoot.innerHTML = '';
        appRoot.appendChild(loadingContainer);
        setTimeout(() => loadingContainer.classList.add('visible'), 100);

        const filesToLoad = ['src/test.js', 'assets/textures.dat', 'assets/models.bin'];
        let filesLoaded = 0;

        const fileCheckInterval = setInterval(() => {
            if (filesLoaded < filesToLoad.length) {
                const file = filesToLoad[filesLoaded];
                document.getElementById('loading-text').textContent = `Verifying ${file}...`;
                filesLoaded++;
                
                const progress = (filesLoaded / filesToLoad.length) * 100;
                document.getElementById('progress-fill').style.width = `${progress}%`;
            } else {
                clearInterval(fileCheckInterval);
                document.getElementById('loading-text').textContent = 'All files ready.';
                setTimeout(resolve, 1000);
            }
        }, 800);
    });
}

// --- Start Game Screen ---
function showStartScreen() {
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Game';
    startButton.id = 'start-button';
    startButton.classList.add('start-button');
    
    startButton.addEventListener('click', () => {
        console.log("Starting the main application...");
        // This is where you would load your main game script, e.g., app.js
        appRoot.innerHTML = '<p>Game has started!</p>';
    });

    appRoot.innerHTML = '';
    appRoot.appendChild(startButton);
    setTimeout(() => startButton.classList.add('visible'), 100);
}

// --- Main Application Flow ---
async function main() {
    // 1. Inject CSS
    injectBootstrapCSS();

    // 2. Play Intro
    await playCinematicIntro();
    
    // 3. Show Loading Screen
    await showLoadingScreen();

    // 4. Show Start Screen
    showStartScreen();
}

// Start the bootstrap process
main();

