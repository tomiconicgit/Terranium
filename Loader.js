// Loader.js

class GameLoader {
  constructor() {
    this.initUI();
    this.start();
  }

  initUI() {
    const styles = `
      #loader-card {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #05070b;
        color: white;
        transition: opacity 0.5s ease-out;
        z-index: 100;
      }
      #loader-card.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .loader-content {
        background: rgba(20, 22, 25, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 32px;
        width: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
        backdrop-filter: blur(10px);
      }
      h1 { font-size: 48px; font-weight: 700; margin: 0 0 16px; }
      #logo { width: 100px; height: 100px; margin-bottom: 24px; /* styles from previous index.html */ }
      #logo .rocket-body { animation: float 3s ease-in-out infinite; }
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
      #logo .flame { transform-origin: 50% 100%; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
      #logo .flame1 { animation-name: flicker-1; animation-duration: 0.8s; }
      #logo .flame2 { animation-name: flicker-2; animation-duration: 1.0s; animation-delay: 0.2s; }
      #logo .flame3 { animation-name: flicker-3; animation-duration: 1.2s; animation-delay: 0.5s; }
      @keyframes flicker-1 { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.9); } }
      @keyframes flicker-2 { 0%, 100% { transform: scaleY(1); } 60% { transform: scaleY(1.1); } }
      @keyframes flicker-3 { 0%, 100% { transform: scaleY(1); } 40% { transform: scaleY(0.85); } }
      
      .progress-bar { width: 100%; height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
      .progress-bar-inner { width: 0%; height: 100%; background: var(--accent); transition: width 0.2s ease-out; }
      .status-text { font-size: 12px; color: rgba(255,255,255,0.6); height: 16px; text-align: center; }
      
      .error-box {
        display: none;
        width: 100%;
        background: rgba(255, 50, 50, 0.1);
        border: 1px solid rgba(255, 80, 80, 0.3);
        border-radius: 8px;
        padding: 12px;
        margin-top: 16px;
        font-family: monospace;
        font-size: 11px;
        color: #ffaaaa;
        max-height: 100px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .copy-error-btn {
        background: #ff5050; color: white; border: none; padding: 6px 12px; border-radius: 6px;
        margin-top: 8px; cursor: pointer; font-size: 12px; font-weight: bold;
      }
      .start-btn {
        display: none;
        font-size: 20px; padding: 14px 32px; border-radius: 12px;
        background: var(--accent); color: #000; border: none; cursor: pointer;
        font-weight: 600; margin-top: 20px;
      }
    `;

    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

    const loaderHTML = `
      <div id="loader-card">
        <div class="loader-content">
          <h1>Terranium</h1>
          <svg id="logo" viewBox="0 0 100 125">
            <g class="rocket-body" fill="#e6eef7" transform="translate(0 -5)"><path d="M 65 95 C 65 95 85 75 85 50 C 85 25 50 0 50 0 C 50 0 15 25 15 50 C 15 75 35 95 35 95 L 65 95 Z" /><path d="M 50 95 L 50 105 L 56 105 A 6 6 0 0 1 50 111 A 6 6 0 0 1 44 105 L 50 105" stroke="#e6eef7" stroke-width="3" stroke-linecap="round" fill="none" /></g><g class="flames" transform="translate(0 5)"><path class="flame flame3" d="M 40 100 C 40 110 45 115 50 125 C 55 115 60 110 60 100 C 60 90 40 90 40 100 Z" fill="#ff4d00" opacity="0.8"/><path class="flame flame2" d="M 42 100 C 42 108 46 112 50 120 C 54 112 58 108 58 100 C 58 92 42 92 42 100 Z" fill="#ff863d" /><path class="flame flame1" d="M 45 100 C 45 105 47 108 50 115 C 53 108 55 105 55 100 C 55 95 45 95 45 100 Z" fill="#ffde9a" /></g>
          </svg>
          <div class="progress-bar"><div class="progress-bar-inner"></div></div>
          <p class="status-text">Booting system...</p>
          <div class="error-box">
            <pre id="error-content"></pre>
            <button class="copy-error-btn">Copy Error</button>
          </div>
          <button class="start-btn">Enter World</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHTML);

    this.ui = {
      card: document.getElementById('loader-card'),
      progressBar: document.querySelector('.progress-bar-inner'),
      statusText: document.querySelector('.status-text'),
      errorBox: document.querySelector('.error-box'),
      errorContent: document.getElementById('error-content'),
      copyBtn: document.querySelector('.copy-error-btn'),
      startBtn: document.querySelector('.start-btn')
    };

    this.ui.copyBtn.addEventListener('click', () => this.copyError());
  }
  
  updateProgress(progress) { this.ui.progressBar.style.width = `${progress * 100}%`; }
  updateStatus(text) { this.ui.statusText.textContent = text; }

  showError(message) {
    this.ui.errorContent.textContent = message;
    this.ui.errorBox.style.display = 'block';
  }
  
  copyError() {
    navigator.clipboard.writeText(this.ui.errorContent.textContent).then(() => {
        this.ui.copyBtn.textContent = 'Copied!';
        setTimeout(() => { this.ui.copyBtn.textContent = 'Copy Error'; }, 2000);
    });
  }

  showStartButton() {
    this.ui.startBtn.style.display = 'block';
    this.updateStatus('World ready. Press Enter.');
  }

  async start() {
    try {
      this.updateStatus('Initializing debugger...');
      const { Debugger } = await import('./Debugger.js');
      Debugger.init(this);
      
      this.updateStatus('Loading main application...');
      const { Main } = await import('./src/Main.js');
      
      const game = new Main(this);
      
      this.ui.startBtn.onclick = () => {
        this.ui.card.classList.add('hidden');
        game.start();
      };

    } catch (error) {
      // This catches errors during module import or Main class instantiation
      console.error("Critical boot error:", error);
      Debugger.report(error, 'Boot failed');
    }
  }
}

// Instantiate the loader to kick everything off.
new GameLoader();
