// Chrome Extension Options Page

interface SettingsConfig {
  timeout: number;
  retryCount: number;
  showTimestamps: boolean;
  autoScroll: boolean;
  hexFormat: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableDebug: boolean;
  nativeAppPath?: string;
}

class ChromeExtensionOptions {
  private defaultSettings: SettingsConfig = {
    timeout: 5000,
    retryCount: 3,
    showTimestamps: true,
    autoScroll: true,
    hexFormat: true,
    logLevel: 'info',
    enableDebug: false
  };

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadSettings();
    this.render();
    this.setupEventListeners();
  }

  private render() {
    const container = document.getElementById('options-app');
    if (!container) return;

    container.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <!-- Communication Settings -->
        <section class="bg-dark-surface border border-dark-border rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Communication Settings</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Response Timeout (ms)</label>
              <input type="number" id="timeout" class="input-field w-full" min="1000" max="30000">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-2">Retry Count</label>
              <input type="number" id="retry-count" class="input-field w-full" min="0" max="10">
            </div>
          </div>
        </section>

        <!-- Display Settings -->
        <section class="bg-dark-surface border border-dark-border rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Display Settings</h2>
          
          <div class="space-y-4">
            <label class="flex items-center gap-3">
              <input type="checkbox" id="show-timestamps" class="w-4 h-4">
              <span>Show timestamps in logs</span>
            </label>
            
            <label class="flex items-center gap-3">
              <input type="checkbox" id="auto-scroll" class="w-4 h-4">
              <span>Auto-scroll logs</span>
            </label>
            
            <label class="flex items-center gap-3">
              <input type="checkbox" id="hex-format" class="w-4 h-4">
              <span>Display data in HEX format</span>
            </label>
          </div>
        </section>

        <!-- Advanced Settings -->
        <section class="bg-dark-surface border border-dark-border rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Advanced Settings</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Log Level</label>
              <select id="log-level" class="input-field w-full">
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            
            <div class="flex items-center">
              <label class="flex items-center gap-3">
                <input type="checkbox" id="enable-debug" class="w-4 h-4">
                <span>Enable debug mode</span>
              </label>
            </div>
          </div>
        </section>

        <!-- Native App Settings -->
        <section class="bg-dark-surface border border-dark-border rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Native App Settings</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Native App Status</label>
              <div id="native-status" class="p-3 rounded-md bg-dark-panel">
                <span id="native-status-text">Checking...</span>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-2">Native App Path (Optional)</label>
              <input type="text" id="native-app-path" class="input-field w-full" 
                     placeholder="/usr/local/bin/modbus-native-app">
              <p class="text-xs text-dark-text-muted mt-1">
                Leave empty to use default path
              </p>
            </div>
          </div>
        </section>

        <!-- Actions -->
        <div class="flex gap-4">
          <button id="save-settings" class="btn-primary">Save Settings</button>
          <button id="reset-settings" class="btn-secondary">Reset to Defaults</button>
          <button id="test-native" class="btn-secondary">Test Native App</button>
        </div>

        <!-- Status Messages -->
        <div id="status-message" class="mt-4 p-3 rounded-md hidden"></div>
      </div>
    `;
  }

  private setupEventListeners() {
    // Save settings
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset settings
    document.getElementById('reset-settings')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // Test native app
    document.getElementById('test-native')?.addEventListener('click', () => {
      this.testNativeApp();
    });

    // Auto-save on changes
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.saveSettings();
      });
    });
  }

  private async loadSettings() {
    return new Promise<void>((resolve) => {
      chrome.storage.sync.get(this.defaultSettings, (result) => {
        // Update UI with loaded settings
        const timeoutInput = document.getElementById('timeout') as HTMLInputElement;
        const retryInput = document.getElementById('retry-count') as HTMLInputElement;
        const timestampsInput = document.getElementById('show-timestamps') as HTMLInputElement;
        const autoScrollInput = document.getElementById('auto-scroll') as HTMLInputElement;
        const hexFormatInput = document.getElementById('hex-format') as HTMLInputElement;
        const logLevelSelect = document.getElementById('log-level') as HTMLSelectElement;
        const debugInput = document.getElementById('enable-debug') as HTMLInputElement;
        const nativePathInput = document.getElementById('native-app-path') as HTMLInputElement;

        if (timeoutInput) timeoutInput.value = result.timeout.toString();
        if (retryInput) retryInput.value = result.retryCount.toString();
        if (timestampsInput) timestampsInput.checked = result.showTimestamps;
        if (autoScrollInput) autoScrollInput.checked = result.autoScroll;
        if (hexFormatInput) hexFormatInput.checked = result.hexFormat;
        if (logLevelSelect) logLevelSelect.value = result.logLevel;
        if (debugInput) debugInput.checked = result.enableDebug;
        if (nativePathInput) nativePathInput.value = result.nativeAppPath || '';

        resolve();
      });
    });
  }

  private saveSettings() {
    const settings: SettingsConfig = {
      timeout: parseInt((document.getElementById('timeout') as HTMLInputElement)?.value) || 5000,
      retryCount: parseInt((document.getElementById('retry-count') as HTMLInputElement)?.value) || 3,
      showTimestamps: (document.getElementById('show-timestamps') as HTMLInputElement)?.checked || false,
      autoScroll: (document.getElementById('auto-scroll') as HTMLInputElement)?.checked || false,
      hexFormat: (document.getElementById('hex-format') as HTMLInputElement)?.checked || false,
      logLevel: (document.getElementById('log-level') as HTMLSelectElement)?.value as any || 'info',
      enableDebug: (document.getElementById('enable-debug') as HTMLInputElement)?.checked || false,
      nativeAppPath: (document.getElementById('native-app-path') as HTMLInputElement)?.value || undefined
    };

    chrome.storage.sync.set(settings, () => {
      this.showStatus('Settings saved successfully', 'success');
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'settings_updated',
        settings: settings
      });
    });
  }

  private resetSettings() {
    chrome.storage.sync.set(this.defaultSettings, () => {
      this.loadSettings();
      this.showStatus('Settings reset to defaults', 'info');
    });
  }

  private async testNativeApp() {
    try {
      const response = await this.sendMessageToBackground({
        type: 'check_native_status'
      });

      const statusEl = document.getElementById('native-status-text');
      if (statusEl) {
        if (response.connected) {
          statusEl.textContent = '✅ Native app connected';
          statusEl.className = 'text-green-400';
        } else {
          statusEl.textContent = '❌ Native app not connected';
          statusEl.className = 'text-red-400';
        }
      }

    } catch (error) {
      this.showStatus(`Native app test failed: ${error}`, 'error');
    }
  }

  private sendMessageToBackground(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info') {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `mt-4 p-3 rounded-md ${
      type === 'success' ? 'bg-green-900 text-green-200' :
      type === 'error' ? 'bg-red-900 text-red-200' :
      'bg-blue-900 text-blue-200'
    }`;
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  new ChromeExtensionOptions();
});