import { LogBufferConfig, OptimizedLogService } from '../services/OptimizedLogService';

export class LogSettingsPanel {
  private logService: OptimizedLogService;
  private container: HTMLElement;
  private isVisible: boolean = false;

  constructor(logService: OptimizedLogService) {
    this.logService = logService;
    this.container = this.createSettingsPanel();
  }

  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'log-settings-panel fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center';
    panel.id = 'log-settings-panel';
    
    panel.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            📊 로그 버퍼 설정
          </h2>
          <button id="close-settings" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          
          <!-- Buffer Settings -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">🔄 로그 버퍼 설정</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  버퍼 크기 (로그 개수)
                </label>
                <input type="number" id="buffer-size" min="100" max="50000" step="100"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                              focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  메모리에 보관할 최대 로그 수 (초과시 파일로 저장)
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  파일 형식
                </label>
                <select id="export-format" 
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                               focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                  <option value="json">JSON - 구조화된 데이터</option>
                  <option value="csv">CSV - 스프레드시트용</option>
                  <option value="txt">TXT - 간단한 텍스트</option>
                </select>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  오버플로우 시 저장될 파일 형식
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
                  <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200">
                    순환 버퍼 + IndexedDB 저장
                  </h4>
                  <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    설정한 버퍼 크기만큼 메모리에 보관하고, 초과된 로그는 즉시 IndexedDB에 저장됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Stats -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">📈 현재 상태</h3>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div class="text-xl font-bold text-blue-600 dark:text-blue-400" id="stat-memory-logs">-</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">메모리 로그</div>
              </div>
              
              <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div class="text-xl font-bold text-green-600 dark:text-green-400" id="stat-total-logs">-</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">전체 로그</div>
              </div>

              <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div class="text-xl font-bold text-purple-600 dark:text-purple-400" id="stat-indexeddb-logs">-</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">IndexedDB 로그</div>
              </div>
              
              <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div class="text-xl font-bold text-orange-600 dark:text-orange-400" id="stat-indexeddb-size">-</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">IndexedDB 크기</div>
              </div>
            </div>

            <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-purple-800 dark:text-purple-200">
                    IndexedDB 오버플로우 저장
                  </h4>
                  <p class="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    메모리 버퍼를 초과한 로그는 자동으로 IndexedDB에 저장됩니다. 전체 로그 저장 시 IndexedDB가 초기화됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">🔧 작업</h3>
            
            <div class="flex flex-wrap gap-3">
              <button id="export-memory-logs" 
                      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                             focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                📁 메모리 로그만 저장
              </button>

              <button id="export-all-logs" 
                      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                             focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                💾 전체 로그 저장 (DB 초기화)
              </button>
              
              <button id="clear-logs" 
                      class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 
                             focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                🗑️ 메모리 로그 지우기
              </button>

              <button id="clear-all-logs" 
                      class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 
                             focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                🗂️ 전체 로그 지우기 (DB 포함)
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button id="cancel-settings" 
                  class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 
                         focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
            취소
          </button>
          <button id="save-settings" 
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            저장
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
      this.showNotification('설정이 저장되었습니다!', 'success');
      this.hide();
    } catch (error) {
      this.showNotification('설정 저장 중 오류가 발생했습니다.', 'error');
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
      this.showNotification('메모리 로그가 성공적으로 저장되었습니다!', 'success');
      this.updateStats();
    } catch (error) {
      this.showNotification('메모리 로그 저장 중 오류가 발생했습니다.', 'error');
      console.error('Failed to export memory logs:', error);
    }
  }

  private async exportAllLogsWithDBClear(): Promise<void> {
    try {
      await this.logService.exportAllLogsIncludingIndexedDB();
      this.showNotification('전체 로그가 성공적으로 저장되고 IndexedDB가 초기화되었습니다!', 'success');
      this.updateStats();
    } catch (error) {
      this.showNotification('전체 로그 저장 중 오류가 발생했습니다.', 'error');
      console.error('Failed to export all logs:', error);
    }
  }


  private async clearLogs(): Promise<void> {
    if (confirm('메모리 로그를 삭제하시겠습니까? IndexedDB 로그는 유지됩니다.')) {
      try {
        this.logService.clearLogs(); // 동기 메서드
        this.updateStats();
        this.showNotification('메모리 로그가 삭제되었습니다.', 'success');
      } catch (error) {
        this.showNotification('메모리 로그 삭제 중 오류가 발생했습니다.', 'error');
        console.error('Failed to clear memory logs:', error);
      }
    }
  }

  private async clearAllLogs(): Promise<void> {
    if (confirm('모든 로그를 삭제하시겠습니까? (메모리 + IndexedDB) 이 작업은 되돌릴 수 없습니다.')) {
      try {
        await this.logService.clearAllLogs();
        this.updateStats();
        this.showNotification('모든 로그가 삭제되었습니다.', 'success');
      } catch (error) {
        this.showNotification('로그 삭제 중 오류가 발생했습니다.', 'error');
        console.error('Failed to clear all logs:', error);
      }
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
}