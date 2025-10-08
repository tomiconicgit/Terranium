// Get the main app container from the HTML
const appRoot = document.getElementById('app-root');

// --- Cinematic Intro ---
function playCinematicIntro() {
    return new Promise(resolve => {
        // Create the intro text element
        const introText = document.createElement('div');
        introText.textContent = 'Iconic Developments';
        introText.classList.add('cinematic-text');

        // Clear the app root and add the intro text
        appRoot.innerHTML = '';
        appRoot.appendChild(introText);

        // Animation sequence: fade in, hold, fade out
        setTimeout(() => introText.classList.add('visible'), 100); // Fade in
        setTimeout(() => introText.classList.remove('visible'), 3000); // Fade out
        setTimeout(resolve, 4500); // Wait for fade out to finish
    });
}

// --- Loading Screen ---
function showLoadingScreen() {
    return new Promise(resolve => {
        // Create loading screen elements
        const loadingContainer = document.createElement('div');
        loadingContainer.classList.add('loading-container');

        const loadingText = document.createElement('p');
        loadingText.id = 'loading-text';
        loadingText.textContent = 'Loading game files...';

        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        const progressFill = document.createElement('div');
        progressFill.id = 'progress-fill';
        progressBar.appendChild(progressFill);
        
        loadingContainer.appendChild(loadingText);
        loadingContainer.appendChild(progressBar);

        // Clear app root and show the loading screen
        appRoot.innerHTML = '';
        appRoot.appendChild(loadingContainer);
        setTimeout(() => loadingContainer.classList.add('visible'), 100);

        // --- Simulate File Loading ---
        const filesToLoad = ['src/test.js']; // Add other game files here
        let filesLoaded = 0;

        const fileCheckInterval = setInterval(() => {
            if (filesLoaded < filesToLoad.length) {
                const file = filesToLoad[filesLoaded];
                loadingText.textContent = `Verifying ${file}...`;
                filesLoaded++;
                
                const progress = (filesLoaded / filesToLoad.length) * 100;
                document.getElementById('progress-fill').style.width = `${progress}%`;
            } else {
                clearInterval(fileCheckInterval);
                loadingText.textContent = 'All files ready.';
                setTimeout(resolve, 1000); // Short delay before showing start button
            }
        }, 800); // Simulate time for each file check
    });
}

// --- Start Game Screen ---
function showStartScreen() {
    // Create start button
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Game';
    startButton.id = 'start-button';
    startButton.classList.add('start-button');

    // Add event listener to start the main game logic
    startButton.addEventListener('click', () => {
        console.log("Starting the main application...");
        // Here you would load and run your main game script (app.js)
        // For now, we'll just log to the console.
        appRoot.innerHTML = '<p>Game has started!</p>';
    });

    // Clear the app root and add the button
    appRoot.innerHTML = '';
    appRoot.appendChild(startButton);
    setTimeout(() => startButton.classList.add('visible'), 100);
}

// --- Main Application Flow ---
async function main() {
    await playCinematicIntro();
    await showLoadingScreen();
    showStartScreen();
}

// Start the bootstrap process
main();
