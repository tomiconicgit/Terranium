export class Debugger {
    constructor() {
        this.notificationContainer = document.getElementById('debugger-notifications');
        
        // Global error handlers
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError(error, 'Global');
            return true; // Prevents the default browser console error
        };
        
        window.onunhandledrejection = (event) => {
            this.handleError(event.reason, 'Promise');
        };

        console.log("Debugger initialized.");
    }

    log(message) {
        console.log(`[DEBUG] ${message}`);
    }

    handleError(error, context = 'General') {
        console.error(`[${context} ERROR]`, error);
        
        const message = error.message || 'An unknown error occurred.';
        this.showNotification(`[${context}] ${message}`, 'error');
    }

    warn(message, context = 'Warning') {
        console.warn(`[${context} WARNING] ${message}`);
        this.showNotification(`[${context}] ${message}`, 'warning');
    }
    
    showNotification(message, type = 'error') {
        const card = document.createElement('div');
        card.className = `debugger-card ${type}`;
        
        const title = document.createElement('h4');
        title.textContent = type === 'error' ? '🛑 Error Detected' : '⚠️ System Warning';
        
        const description = document.createElement('p');
        description.textContent = message;
        
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy to Clipboard';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(message)
                .then(() => {
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => copyButton.textContent = 'Copy to Clipboard', 2000);
                })
                .catch(err => console.error('Failed to copy error: ', err));
        };
        
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(copyButton);
        
        this.notificationContainer.appendChild(card);
        
        setTimeout(() => {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 500);
        }, 10000);
    }
}
