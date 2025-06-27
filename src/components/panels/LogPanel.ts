import { LogEntry } from '../../types';

export class LogPanel {
  private logs: LogEntry[] = [];
  private isAutoScroll = true;
  private container: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = this.render();
    this.attachEventListeners();
    this.generateSampleLogs();
  }

  private render(): string {
    return `
      <div class="h-full flex flex-col">
        <!-- Log Controls -->
        <div class="flex items-center justify-between p-4 border-b border-dark-border bg-dark-panel">
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" id="auto-scroll" ${this.isAutoScroll ? 'checked' : ''} 
                class="rounded border-dark-border bg-dark-surface">
              <span class="text-dark-text-secondary">Auto Scroll</span>
            </label>
            
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Search logs..." 
                id="log-search"
                class="input-field text-sm w-48"
              />
              <button class="btn-secondary text-sm py-1 px-3" id="clear-logs">
                Clear
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-sm text-dark-text-secondary">
            <span id="log-count">${this.logs.length} entries</span>
            <button class="btn-secondary text-sm py-1 px-3" id="export-logs">
              Export
            </button>
          </div>
        </div>

        <!-- Log Content -->
        <div class="flex-1 overflow-hidden">
          <div class="h-full overflow-y-auto scrollbar-thin" id="log-container">
            ${this.renderLogs()}
          </div>
        </div>
      </div>
    `;
  }

  private renderLogs(): string {
    if (this.logs.length === 0) {
      return `
        <div class="flex items-center justify-center h-full text-dark-text-muted">
          <div class="text-center">
            <div class="text-4xl mb-4">📡</div>
            <p>No communication logs yet</p>
            <p class="text-sm">Connect to a Modbus device to start monitoring</p>
          </div>
        </div>
      `;
    }

    return this.logs.map(log => this.renderLogEntry(log)).join('');
  }

  private renderLogEntry(log: LogEntry): string {
    const timestamp = log.timestamp.toLocaleTimeString();
    const directionClass = log.direction === 'send' ? 'send' : 'recv';
    const directionText = log.direction === 'send' ? 'SEND' : 'RECV';
    
    return `
      <div class="log-entry" data-log-id="${log.id}">
        <div class="log-timestamp">${timestamp}</div>
        <div class="log-direction ${directionClass}">${directionText}</div>
        <div class="log-data">${this.formatLogData(log.data)}</div>
        ${log.responseTime ? `<div class="text-xs text-dark-text-muted">${log.responseTime}ms</div>` : ''}
        ${log.error ? `<div class="text-xs text-status-error">${log.error}</div>` : ''}
      </div>
    `;
  }

  private formatLogData(data: string): string {
    // Normalize input by removing all whitespace and converting to uppercase
    const cleaned = data.replace(/\s+/g, '').toUpperCase();
    
    // Ensure even length by padding with leading zero if necessary
    const evenLength = cleaned.length % 2 !== 0 ? '0' + cleaned : cleaned;
    
    // Split into 2-character hex bytes and add spacing
    const formatted = evenLength.replace(/(.{2})/g, '$1 ').trim();
    
    return formatted;
  }

  private attachEventListeners(): void {
    // Auto scroll toggle
    const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;
    autoScrollCheckbox?.addEventListener('change', (e) => {
      this.isAutoScroll = (e.target as HTMLInputElement).checked;
    });

    // Search functionality
    const searchInput = document.getElementById('log-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value;
      this.filterLogs(searchTerm);
    });

    // Clear logs
    const clearButton = document.getElementById('clear-logs');
    clearButton?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Export logs
    const exportButton = document.getElementById('export-logs');
    exportButton?.addEventListener('click', () => {
      this.exportLogs();
    });
  }

  updateLogs(logs: LogEntry[]): void {
    this.logs = logs;
    this.refreshLogDisplay();
    this.updateLogCount();
    
    if (this.isAutoScroll) {
      this.scrollToBottom();
    }
  }

  addLog(log: LogEntry): void {
    this.logs.push(log);
    this.updateLogs(this.logs);
  }

  private refreshLogDisplay(): void {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.innerHTML = this.renderLogs();
    }
  }

  private updateLogCount(): void {
    const logCountElement = document.getElementById('log-count');
    if (logCountElement) {
      logCountElement.textContent = `${this.logs.length} entries`;
    }
  }

  private scrollToBottom(): void {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  private filterLogs(searchTerm: string): void {
    const logEntries = document.querySelectorAll('.log-entry');
    const term = searchTerm.toLowerCase();

    logEntries.forEach(entry => {
      const text = entry.textContent?.toLowerCase() || '';
      const element = entry as HTMLElement;
      element.style.display = text.includes(term) ? 'flex' : 'none';
    });
  }

  private clearLogs(): void {
    if (confirm('Are you sure you want to clear all logs?')) {
      this.logs = [];
      this.refreshLogDisplay();
      this.updateLogCount();
    }
  }

  private exportLogs(): void {
    const csvContent = this.logs.map(log => 
      `${log.timestamp.toISOString()},${log.direction},${log.data},${log.error || ''}`
    ).join('\n');
    
    const header = 'Timestamp,Direction,Data,Error\n';
    const csv = header + csvContent;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modbus-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private generateSampleLogs(): void {
    // Generate some sample logs for demonstration
    const sampleLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5000),
        direction: 'send',
        data: '01 03 00 00 00 0A C5 CD'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 4900),
        direction: 'recv',
        data: '01 03 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 FA 6C',
        responseTime: 100
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 3000),
        direction: 'send',
        data: '01 06 00 00 00 FF 88 3A'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 2900),
        direction: 'recv',
        data: '01 06 00 00 00 FF 88 3A',
        responseTime: 95
      }
    ];

    this.updateLogs(sampleLogs);
  }
}