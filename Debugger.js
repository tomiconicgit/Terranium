// Debugger.js

export const Debugger = {
  loader: null,

  init(loaderInstance) {
    this.loader = loaderInstance;
    
    // --- Global JavaScript Error Catcher ---
    window.addEventListener('error', event => {
      this.report(event.error, 'Unhandled Script Error');
    });

    // --- Unhandled Promise Rejection Catcher ---
    window.addEventListener('unhandledrejection', event => {
      this.report(event.reason, 'Unhandled Promise Rejection');
    });
    
    // --- WebGL Error Catcher ---
    const appElement = document.getElementById('app');
    if (appElement) {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(...args) {
            const context = originalGetContext.apply(this, args);
            if (context && context.hasOwnProperty('getExtension')) {
                const debugExt = context.getExtension('WEBGL_debug_renderer_info');
                if (debugExt) {
                    const renderer = context.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
                    console.log(`GPU Renderer: ${renderer}`);
                }
            }
            return context;
        };
    }
  },

  report(error, context = 'Runtime Error') {
    let message = `Context: ${context}\n`;
    if (error instanceof Error) {
      message += `Type: ${error.name}\nMessage: ${error.message}\n\nStack Trace:\n${error.stack}`;
    } else if (typeof error === 'string') {
      message += `Details: ${error}`;
    } else {
      message += `Details: ${JSON.stringify(error, null, 2)}`;
    }

    console.error(`[Debugger] ${context}:`, error);
    if (this.loader) {
      this.loader.showError(message);
    }
  }
};
