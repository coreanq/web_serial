import { LogBufferConfig, OptimizedLogService } from '../services/OptimizedLogService';
import { i18n } from '../locales';

export class LogSettingsPanel {
  private logService: OptimizedLogService;
  private container: HTMLElement;
  private isVisible: boolean = false;
  private onClearCallback?: () => void;
  private currentTheme: 'light' | 'dark' = 'light'; // Default theme

  constructor(logService: OptimizedLogService) {
    this.logService = logService;
    this.container = this.createSettingsPanel();
  }

  public setClearCallback(callback: () => void): void {
    console.log('LogSettingsPanel.setClearCallback called'); // Debug log
    this.onClearCallback = callback;
    console.log('Callback set successfully:', !!this.onClearCallback); // Debug log
  }

  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'log-settings-panel fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center';
    panel.id = 'log-settings-panel';
    
    panel.innerHTML = `
      <div class="${this.getThemeClasses().panelBg} rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b ${this.getThemeClasses().border}">
          <h2 class="text-xl font-semibold ${this.getThemeClasses().textPrimary}">
            📊 ${i18n.t('log.settings.title')}
          </h2>
          <button id="close-settings" class="${this.getThemeClasses().textMuted} hover:${this.getThemeClasses().textPrimary.replace('text-', 'hover:text-')}">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          
          <!-- Buffer Settings -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium ${this.getThemeClasses().textPrimary}">🔄 ${i18n.t('log.settings.memoryManagement')}</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium ${this.getThemeClasses().textSecondary} mb-2">
                  ${i18n.t('log.settings.bufferSize')}
                </label>
                <input type="number" id="buffer-size" min="100" max="50000" step="100"
                       class="w-full px-3 py-2 border ${this.getThemeClasses().border} rounded-md shadow-sm 
                              focus:ring-blue-500 focus:border-blue-500 ${this.getThemeClasses().inputBg} ${this.getThemeClasses().textPrimary}">
                <p class="text-xs ${this.getThemeClasses().textMuted} mt-1">
                  ${i18n.t('log.settings.bufferSizeDesc')}
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium ${this.getThemeClasses().textSecondary} mb-2">
                  ${i18n.t('log.export.format')}
                </label>
                <select id="export-format" 
                        class="w-full px-3 py-2 border ${this.getThemeClasses().border} rounded-md shadow-sm 
                               focus:ring-blue-500 focus:border-blue-500 ${this.getThemeClasses().inputBg} ${this.getThemeClasses().textPrimary}">
                  <option value="json">${i18n.t('log.export.json')}</option>
                  <option value="csv">${i18n.t('log.export.csv')}</option>
                  <option value="txt">${i18n.t('log.export.txt')}</option>
                </select>
                <p class="text-xs ${this.getThemeClasses().textMuted} mt-1">
                  ${i18n.t('log.settings.exportFormatDesc')}
                </p>
              </div>
            </div>

            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-blue-800 ${this.currentTheme === 'dark' ? 'dark:text-blue-200' : ''}">
                    ${i18n.t('log.settings.circularBufferInfo')}
                  </h4>
                  <p class="text-sm text-blue-700 ${this.currentTheme === 'dark' ? 'dark:text-blue-300' : ''} mt-1">
                    ${i18n.t('log.settings.circularBufferDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Stats -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium ${this.getThemeClasses().textPrimary}">📈 ${i18n.t('log.settings.statistics')}</h3>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="${this.getThemeClasses().background} p-3 rounded-lg">
                <div class="text-xl font-bold text-blue-600 dark:text-blue-400" id="stat-memory-logs">-</div>
                <div class="text-xs ${this.getThemeClasses().textMuted}">${i18n.t('log.settings.memoryLogs')}</div>
              </div>
              
              <div class="${this.getThemeClasses().background} p-3 rounded-lg">
                <div class="text-xl font-bold text-green-600 dark:text-green-400" id="stat-total-logs">-</div>
                <div class="text-xs ${this.getThemeClasses().textMuted}">${i18n.t('log.settings.totalLogs')}</div>
              </div>

              <div class="${this.getThemeClasses().background} p-3 rounded-lg">
                <div class="text-xl font-bold text-purple-600 dark:text-purple-400" id="stat-indexeddb-logs">-</div>
                <div class="text-xs ${this.getThemeClasses().textMuted}">${i18n.t('log.settings.indexedDBLogs')}</div>
              </div>
              
              <div class="${this.getThemeClasses().background} p-3 rounded-lg">
                <div class="text-xl font-bold text-orange-600 dark:text-orange-400" id="stat-indexeddb-size">-</div>
                <div class="text-xs ${this.getThemeClasses().textMuted}">${i18n.t('log.settings.indexedDBSize')}</div>
              </div>
            </div>

          </div>

          <!-- Actions -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium ${this.getThemeClasses().textPrimary}">🔧 ${i18n.t('log.settings.actions')}</h3>
            
            <div class="flex flex-wrap gap-3">
              <button id="export-memory-logs" 
                      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                             focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                📁 ${i18n.t('log.settings.memoryLogs')} ${i18n.t('common.save')}
              </button>

              <button id="export-all-logs" 
                      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                             focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                💾 ${i18n.t('log.settings.totalLogs')} ${i18n.t('common.save')}
              </button>
              
              <button id="clear-logs" 
                      class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 
                             focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                🗑️ ${i18n.t('log.clearLogs')}
              </button>

              <button id="clear-all-logs" 
                      class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 
                             focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                🗂️ ${i18n.t('log.settings.clearAllLogsWithDB')}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end space-x-3 p-6 border-t ${this.getThemeClasses().border}">
          <button id="cancel-settings" 
                  class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 
                         focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
            ${i18n.t('common.cancel')}
          </button>
          <button id="save-settings" 
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            ${i18n.t('common.save')}
          </button>
        </div>
      </div>
    `;

    this.setupEventListeners(panel);
    return panel;
  }

  private setupEventListeners(panel: HTMLElement): void {
    // 패널 닫기
    const closeBtn = panel.querySelector('#close-settings') as HTMLElement;
    const cancelBtn = panel.querySelector('#cancel-settings') as HTMLElement;
    closeBtn?.addEventListener('click', () => this.hide());
    cancelBtn?.addEventListener('click', () => this.hide());

    // 배경 클릭으로 닫기
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        this.hide();
      }
    });

    // 설정 저장
    const saveBtn = panel.querySelector('#save-settings') as HTMLElement;
    saveBtn?.addEventListener('click', () => this.saveSettings());

    // 메모리 로그만 저장
    const exportMemoryBtn = panel.querySelector('#export-memory-logs') as HTMLElement;
    exportMemoryBtn?.addEventListener('click', () => this.exportMemoryLogs());

    // 전체 로그 저장 (DB 초기화)
    const exportAllBtn = panel.querySelector('#export-all-logs') as HTMLElement;
    exportAllBtn?.addEventListener('click', () => this.exportAllLogsWithDBClear());

    // 메모리 로그 지우기
    const clearBtn = panel.querySelector('#clear-logs') as HTMLElement;
    clearBtn?.addEventListener('click', () => this.clearLogs());

    // 전체 로그 지우기 (DB 포함)
    const clearAllBtn = panel.querySelector('#clear-all-logs') as HTMLElement;
    clearAllBtn?.addEventListener('click', () => this.clearAllLogs());

    // 실시간 통계 업데이트
    this.startStatsUpdate();
  }

  public show(): void {
    if (!this.isVisible) {
      this.loadCurrentSettings();
      this.updateStats();
      document.body.appendChild(this.container);
      this.container.classList.remove('hidden');
      this.isVisible = true;
    }
  }

  public hide(): void {
    if (this.isVisible) {
      this.container.classList.add('hidden');
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.isVisible = false;
    }
  }

  private loadCurrentSettings(): void {
    const config = this.logService.getConfig();
    
    (this.container.querySelector('#buffer-size') as HTMLInputElement).value = config.bufferSize.toString();
    (this.container.querySelector('#export-format') as HTMLSelectElement).value = config.exportFormat;
  }

  private saveSettings(): void {
    try {
      const newConfig: Partial<LogBufferConfig> = {
        bufferSize: parseInt((this.container.querySelector('#buffer-size') as HTMLInputElement).value),
        exportFormat: (this.container.querySelector('#export-format') as HTMLSelectElement).value as 'json' | 'csv' | 'txt'
      };

      this.logService.updateConfig(newConfig);
      this.showNotification(i18n.t('log.settings.settingsSaved'), 'success');
      this.hide();
    } catch (error) {
      this.showNotification(i18n.t('log.settings.settingsSaveError'), 'error');
      console.error('Failed to save settings:', error);
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const stats = await this.logService.getStats();
      
      (this.container.querySelector('#stat-memory-logs') as HTMLElement).textContent = stats.memoryLogs.toLocaleString();
      (this.container.querySelector('#stat-total-logs') as HTMLElement).textContent = stats.totalLogs.toLocaleString();
      (this.container.querySelector('#stat-indexeddb-logs') as HTMLElement).textContent = stats.indexedDBLogs.toLocaleString();
      (this.container.querySelector('#stat-indexeddb-size') as HTMLElement).textContent = stats.indexedDBSize;
    } catch (error) {
      console.error('Failed to update stats:', error);
      // 오류 시 기본값 표시
      (this.container.querySelector('#stat-memory-logs') as HTMLElement).textContent = '-';
      (this.container.querySelector('#stat-total-logs') as HTMLElement).textContent = '-';
      (this.container.querySelector('#stat-indexeddb-logs') as HTMLElement).textContent = '-';
      (this.container.querySelector('#stat-indexeddb-size') as HTMLElement).textContent = '-';
    }
  }

  private startStatsUpdate(): void {
    // 5초마다 통계 업데이트
    setInterval(() => {
      if (this.isVisible) {
        this.updateStats();
      }
    }, 5000);
  }

  private async exportMemoryLogs(): Promise<void> {
    try {
      await this.logService.exportAllLogs();
      this.showNotification(i18n.t('log.settings.memoryLogsSaved'), 'success');
      this.updateStats();
    } catch (error) {
      this.showNotification(i18n.t('log.settings.memoryLogsSaveError'), 'error');
      console.error('Failed to export memory logs:', error);
    }
  }

  private async exportAllLogsWithDBClear(): Promise<void> {
    try {
      await this.logService.exportAllLogsIncludingIndexedDB();
      this.showNotification(i18n.t('log.settings.allLogsSaved'), 'success');
      this.updateStats();
    } catch (error) {
      this.showNotification(i18n.t('log.settings.allLogsSaveError'), 'error');
      console.error('Failed to export all logs:', error);
    }
  }


  private async clearLogs(): Promise<void> {
    console.log('LogSettingsPanel.clearLogs called'); // Debug log
    console.log('onClearCallback available:', !!this.onClearCallback); // Debug log
    
    try {
      // Call App's clear functionality if available
      if (this.onClearCallback) {
        console.log('Calling onClearCallback from LogSettingsPanel'); // Debug log
        this.onClearCallback();
      } else {
        console.log('No callback available, using direct service call'); // Debug log
        // Fallback to direct service call
        this.logService.clearLogs();
      }
      this.updateStats();
      this.showNotification(i18n.t('log.settings.memoryLogsCleared'), 'success');
    } catch (error) {
      this.showNotification(i18n.t('log.settings.memoryClearError'), 'error');
      console.error('Failed to clear memory logs:', error);
    }
  }

  private async clearAllLogs(): Promise<void> {
    console.log('LogSettingsPanel.clearAllLogs called'); // Debug log
    console.log('onClearCallback available:', !!this.onClearCallback); // Debug log
    
    try {
      // Call App's clear functionality if available
      if (this.onClearCallback) {
        console.log('Calling onClearCallback from LogSettingsPanel (clearAll)'); // Debug log
        this.onClearCallback();
      } else {
        console.log('No callback available, using direct service call (clearAll)'); // Debug log
        // Fallback to direct service call
        await this.logService.clearAllLogs();
      }
      this.updateStats();
      this.showNotification(i18n.t('log.settings.allLogsCleared'), 'success');
    } catch (error) {
      this.showNotification(i18n.t('log.settings.allClearError'), 'error');
      console.error('Failed to clear all logs:', error);
    }
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-white ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Clean up resources
  public destroy(): void {
    try {
      // Hide and remove panel if visible
      this.hide();
      
      // Remove from DOM if it's still there
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      
      // Clear references
      this.logService = null as any;
      this.container = null as any;
      this.isVisible = false;
      
      console.log('[LogSettingsPanel] Destroyed successfully');
    } catch (error) {
      console.error('[LogSettingsPanel] Error during destroy:', error);
    }
  }

  /**
   * Handle language change - re-create the panel
   */
  onLanguageChange(): void {
    if (this.isVisible) {
      // Re-create the panel with new language
      this.container.remove();
      this.container = this.createSettingsPanel();
      document.body.appendChild(this.container);
      this.container.classList.remove('hidden');
      
      // Reload current settings and stats
      this.loadCurrentSettings();
      this.updateStats();
    }
  }

  /**
   * Get theme-specific CSS classes
   */
  private getThemeClasses(): { 
    background: string; 
    panelBg: string; 
    border: string; 
    inputBg: string; 
    textPrimary: string; 
    textSecondary: string; 
    textMuted: string 
  } {
    if (this.currentTheme === 'light') {
      return {
        background: 'bg-gray-50',
        panelBg: 'bg-white',
        border: 'border-gray-200',
        inputBg: 'bg-white',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-800',
        textMuted: 'text-gray-600'
      };
    } else {
      return {
        background: 'bg-dark-bg',
        panelBg: 'bg-dark-surface',
        border: 'border-dark-border',
        inputBg: 'bg-dark-surface',
        textPrimary: 'text-dark-text-primary',
        textSecondary: 'text-dark-text-secondary',
        textMuted: 'text-dark-text-muted'
      };
    }
  }

  /**
   * Handle theme change from parent App
   */
  public onThemeChange(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    // Re-create the settings panel with new theme
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = this.createSettingsPanel();
  }
}