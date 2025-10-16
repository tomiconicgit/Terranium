import { Debugger } from './Debugger.js';
import { Main } from './src/Main.js';

class Loader {
    constructor() {
        this.debugger = new Debugger();
        this.main = null; 
        
        // DOM Elements for the new UI
        this.progressBar = document.getElementById('progress-bar');
        this.percentageText = document.getElementById('progress-percentage-text');
        this.statusText = document.getElementById('loader-status-text');
        this.enterButton = document.getElementById('enter-button');
        this.loaderContainer = document.getElementById('loader-container');
        this.debuggerMessageArea = document.getElementById('debugger-message-area');

        // Initial setup for the debugger message area
        this.debuggerMessageArea.style.display = 'none';

        this.loadManifest();
    }

    async loadManifest() {
        try {
            const manifest = Main.getManifest();
            const totalItems = manifest.length;
            
            for (let i = 0; i < totalItems; i++) {
                const item = manifest[i];
                this.updateStatus(`Installing ${item.name}...`);
                
                await new Promise(resolve => setTimeout(resolve, 150)); 
                
                this.debugger.log(`Checked: ${item.name}`);

                const progress = ((i + 1) / totalItems) * 100;
                this.updateProgress(progress);
            }

            this.loadingSuccessful();
        } catch (error) {
            this.loadingFailed(error);
        }
    }

    updateProgress(percentage) {
        this.progressBar.style.width = `${percentage}%`;
        this.percentageText.textContent = `${Math.round(percentage)}%`;
    }

    updateStatus(text) {
        this.statusText.textContent = text;
    }

    loadingSuccessful() {
        this.updateStatus('Installation complete. Click Enter to begin!');
        this.enterButton.disabled = false;
        this.enterButton.textContent = 'ENTER';
        this.enterButton.onclick = () => this.startGame();
    }

    loadingFailed(error) {
        this.debuggerMessageArea.style.display = 'block';
        const safeErrorMessage = error.message.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        this.debuggerMessageArea.innerHTML = `<h4>🛑 Error Detected:</h4><p>${error.message}</p>
            <button onclick="navigator.clipboard.writeText('${safeErrorMessage}')
            .then(() => alert('Error copied!'))
            .catch(err => console.error('Failed to copy error: ', err))">Copy Error</button>`;
        this.progressBar.style.backgroundColor = '#d43b3b';
        this.updateStatus('A critical error occurred during installation.');
    }
    
    startGame() {
        this.loaderContainer.style.opacity = '0';
        setTimeout(() => {
            this.loaderContainer.style.display = 'none';
        }, 500);
        
        this.main = new Main(this.debugger);
        this.main.start();
    }
}

window.onload = () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }
    
    new Loader();
};
