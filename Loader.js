import { Debugger } from './Debugger.js';
import { Main } from './src/Main.js';

class Loader {
    constructor() {
        this.debugger = new Debugger();
        this.main = null; // Will be instantiated after loading
        
        // DOM Elements
        this.progressBar = document.getElementById('progress-bar');
        this.percentageText = document.getElementById('progress-percentage');
        this.statusText = document.getElementById('loader-status');
        this.enterButton = document.getElementById('enter-button');
        this.loaderContainer = document.getElementById('loader-container');
        this.logoContainer = document.getElementById('loader-logo');
        
        this.createProceduralLogo();
        this.loadManifest();
    }

    createProceduralLogo() {
        // Simple procedural SVG: A rotating, multi-layered crystal/planet shape
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 100 100");

        const colors = ["#4f8ff7", "#8A2BE2", "#41E0D0"];
        for (let i = 0; i < 3; i++) {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", "25");
            rect.setAttribute("y", "25");
            rect.setAttribute("width", "50");
            rect.setAttribute("height", "50");
            rect.setAttribute("fill", "none");
            rect.setAttribute("stroke", colors[i]);
            rect.setAttribute("stroke-width", "3");
            
            const animate = document.createElementNS(svgNS, "animateTransform");
            animate.setAttribute("attributeName", "transform");
            animate.setAttribute("type", "rotate");
            animate.setAttribute("from", `${i * 30} 50 50`);
            animate.setAttribute("to", `${360 + i * 30} 50 50`);
            animate.setAttribute("dur", `${8 + i * 2}s`);
            animate.setAttribute("repeatCount", "indefinite");
            
            rect.appendChild(animate);
            svg.appendChild(rect);
        }
        this.logoContainer.appendChild(svg);
    }

    async loadManifest() {
        try {
            // Get the list of scripts/assets to load from Main.js
            const manifest = Main.getManifest();
            const totalItems = manifest.length;
            
            for (let i = 0; i < totalItems; i++) {
                const item = manifest[i];
                this.updateStatus(`Loading ${item.name}...`);
                
                // Here you would add actual loading logic (e.g., for models, textures)
                // We will simulate it with a short delay
                await new Promise(resolve => setTimeout(resolve, 150)); 
                
                // Run a debugger check (for simulation purposes)
                this.debugger.log(`Checked: ${item.name}`);

                // Update progress
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
        this.updateStatus('All systems ready. Engage when prepared.');
        this.enterButton.disabled = false;
        this.enterButton.textContent = 'ENTER';
        this.enterButton.onclick = () => this.startGame();
    }

    loadingFailed(error) {
        this.debugger.handleError(error, 'Loader');
        this.progressBar.style.backgroundColor = '#d43b3b';
        this.updateStatus('A critical error occurred. See details below.');
    }
    
    startGame() {
        this.loaderContainer.style.opacity = '0';
        // Wait for the fade-out transition to finish before removing it
        setTimeout(() => {
            this.loaderContainer.style.display = 'none';
        }, 500);
        
        // Instantiate and start the main game logic
        this.main = new Main(this.debugger);
        this.main.start();
    }
}

// Initialize the loader when the script is executed
window.onload = () => new Loader();
