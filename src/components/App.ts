import { ConnectionPanel } from './panels/ConnectionPanel';
import { LogPanel } from './panels/LogPanel';
import { CommandPanel } from './panels/CommandPanel';
import { LogSettingsPanel } from './LogSettingsPanel';
import { AppState, ConnectionStatus } from '../types';
import { OptimizedLogService } from '../services/OptimizedLogService';
import { i18n } from '../locales';

export class App {
  private state: AppState;
  private connectionPanel: ConnectionPanel;
  private logPanel: LogPanel;
  private commandPanel: CommandPanel;
  private logSettingsPanel: LogSettingsPanel | null = null;
  private connectionPanelPosition: 'top' | 'left' | 'right' = 'left';
  private connectionPanelVisible: boolean = true;
  private pendingRepeatLogs: any[] = [];
  private lastLogUpdateTime = 0;
  private logUpdateThrottleMs = 250; // Update logs every 250ms during repeat mode for better sequence visibility
  private batchSize = 50; // Batch size for log processing
  private logEntryPool: any[] = []; // Object pool for log entries
  private maxPoolSize = 500; // Maximum pool size for memory management
  private gcTimer: NodeJS.Timeout | null = null; // Garbage collection timer
  private optimizedLogService!: OptimizedLogService; // Central log service with memory limits

  constructor() {
    this.state = {
      connectionStatus: 'disconnected',
      connectionConfig: {
        type: 'RTU',
        serial: {
          port: undefined,
          portName: 'No port selected',
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1
        }
      },
      isAutoScroll: true,
      filter: {}
    };

    // Initialize panels
    this.connectionPanel = new ConnectionPanel(
      this.onConnectionChange.bind(this), 
      this.onDataReceived.bind(this)
    );
    this.logPanel = new LogPanel();
    this.commandPanel = new CommandPanel(this.onCommandSend.bind(this), this.onRepeatModeChanged.bind(this));
    
    // Set initial compact mode based on default position
    const isCompact = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
    this.connectionPanel.setCompactMode(isCompact);

    // Listen for panel background color changes
    document.addEventListener('panelBackgroundChange', () => {
      this.updatePanelBackground();
    });

    // Initialize optimized log service with Object Pool callback
    this.optimizedLogService = new OptimizedLogService(undefined, this.recycleLogEntry.bind(this));
    
    // Initialize memory management
    this.initializeMemoryManagement();
    
    // Listen for language changes
    i18n.onLanguageChange(() => {
      this.onLanguageChange();
    });
  }

  async mount(container: HTMLElement): Promise<void> {
    // Debug log for initial position
    console.log('Initial connectionPanelPosition:', this.connectionPanelPosition);
    
    container.innerHTML = this.render();
    this.attachEventListeners();
    await this.mountChildComponents();
    
    // Apply initial layout based on default panel position
    this.updateLayout();
    
    // Log after initial layout
    console.log('Layout applied, current position:', this.connectionPanelPosition);
  }

  private render(): string {
    console.log('render() called, connectionPanelPosition:', this.connectionPanelPosition);
    
    return `
      <div class="min-h-screen bg-dark-bg p-4">
        <div class="max-w-7xl mx-auto">
          <!-- Header with Controls -->
          <header class="text-center py-4 mb-4">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-dark-text-primary">
                  🔧 ${i18n.t('app.title')}
                </h1>
              </div>
              
              <!-- Panel Controls -->
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-dark-text-muted">${i18n.t('panel.position')}:</span>
                  <select id="panel-position" class="input-field btn-sm">
                    <option value="top" ${this.connectionPanelPosition === 'top' ? 'selected' : ''}>📍 ${i18n.t('panel.top')}</option>
                    <option value="left" ${this.connectionPanelPosition === 'left' ? 'selected' : ''}>⬅️ ${i18n.t('panel.left')}</option>
                    <option value="right" ${this.connectionPanelPosition === 'right' ? 'selected' : ''}>➡️ ${i18n.t('panel.right')}</option>
                  </select>
                </div>
                <button id="toggle-connection-panel" class="btn-secondary btn-sm">
                  ${this.connectionPanelVisible ? '🔼 ' + i18n.t('panel.hide') : '🔽 ' + i18n.t('panel.show')}
                </button>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-dark-text-muted">${i18n.t('common.language')}:</span>
                  <select id="language-selector" class="input-field btn-sm">
                    <option value="en" ${i18n.getCurrentLanguage() === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                    <option value="ko" ${i18n.getCurrentLanguage() === 'ko' ? 'selected' : ''}>🇰🇷 한국어</option>
                  </select>
                </div>
                <button id="global-settings" class="btn-secondary btn-sm" title="${i18n.t('common.settings')}">
                  ⚙️ ${i18n.t('common.settings')}
                </button>
              </div>
            </div>
            
            <div class="flex items-center justify-center gap-2">
              <div class="status-indicator ${this.getStatusClass()}"></div>
              <span class="text-sm text-dark-text-secondary">
                ${this.getStatusText()}
              </span>
            </div>
          </header>

          <!-- Dynamic Layout Container -->
          <div id="layout-container">
            ${this.renderLayout()}
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Connection panel position controls
    const positionSelect = document.getElementById('panel-position') as HTMLSelectElement;
    const toggleButton = document.getElementById('toggle-connection-panel') as HTMLButtonElement;
    
    positionSelect?.addEventListener('change', (e) => {
      this.connectionPanelPosition = (e.target as HTMLSelectElement).value as 'top' | 'left' | 'right';
      this.updateLayout();
    });
    
    toggleButton?.addEventListener('click', () => {
      this.connectionPanelVisible = !this.connectionPanelVisible;
      this.updateLayout();
    });

    // Language selector
    const languageSelector = document.getElementById('language-selector') as HTMLSelectElement;
    languageSelector?.addEventListener('change', (e) => {
      const selectedLanguage = (e.target as HTMLSelectElement).value as 'en' | 'ko';
      i18n.setLanguage(selectedLanguage);
      this.onLanguageChange();
    });

    // Global settings button
    const globalSettingsButton = document.getElementById('global-settings') as HTMLButtonElement;
    globalSettingsButton?.addEventListener('click', () => {
      this.showGlobalSettings();
    });
    
    // Add event listener for minimize button (will be added after layout update)
    this.attachMinimizeListener();
    
    // Add log panel control event listeners (will be added after layout update)
    this.attachLogPanelListeners();
  }
  
  private attachMinimizeListener(): void {
    // Use setTimeout to ensure the minimize button exists after layout update
    setTimeout(() => {
      const minimizeButton = document.getElementById('minimize-connection');
      minimizeButton?.addEventListener('click', () => {
        this.connectionPanelVisible = false;
        this.updateLayout();
      });
    }, 0);
  }

  private attachLogPanelListeners(): void {
    // Use setTimeout to ensure the log panel buttons exist after layout update
    setTimeout(() => {
      // Clear logs button
      const clearButton = document.getElementById('clear-logs');
      clearButton?.addEventListener('click', () => {
        this.onLogsClear();
      });

      // Log settings button removed
    }, 0);
  }

  private async mountChildComponents(): Promise<void> {
    const connectionContent = document.getElementById('connection-content');
    const logContent = document.getElementById('log-content');
    const commandContent = document.getElementById('command-content');

    if (connectionContent) {
      // Ensure compact mode is set before mounting
      const isCompact = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
      this.connectionPanel.setCompactMode(isCompact);
      await this.connectionPanel.mount(connectionContent);
    }

    if (logContent) {
      this.logPanel.mount(logContent);
      // Set callback for log clearing to handle pending repeat logs
      this.logPanel.setClearLogsCallback(this.onLogsClear.bind(this));
      // Set initial connection type for packet analysis
      this.logPanel.setConnectionType(
        this.state.connectionConfig.type as 'RTU' | 'TCP_NATIVE'
      );
    }

    if (commandContent) {
      this.commandPanel.mount(commandContent);
    }
  }

  private renderLayout(): string {
    const connectionPanel = this.connectionPanelVisible ? `
      <div id="connection-panel" class="panel ${this.getConnectionPanelClasses()}">
        <div class="panel-header flex items-center justify-between">
          <span>${i18n.t('connection.title')}</span>
          <button id="minimize-connection" class="text-xs text-dark-text-muted hover:text-dark-text-primary">
            ${this.connectionPanelPosition === 'top' ? '−' : '×'}
          </button>
        </div>
        <div class="panel-content" id="connection-content">
          <!-- Connection panel content will be mounted here -->
        </div>
      </div>
    ` : '';

    switch (this.connectionPanelPosition) {
      case 'left':
        return `
          <div class="grid ${this.connectionPanelVisible ? 'grid-cols-1 xl:grid-cols-5' : 'grid-cols-1'} gap-4 h-screen-adjusted">
            ${this.connectionPanelVisible ? `
              <!-- Left Connection Panel -->
              <div class="xl:col-span-1 h-full">
                ${connectionPanel}
              </div>
              
              <!-- Main Content -->
              <div class="xl:col-span-4 h-full">
                ${this.renderMainContent()}
              </div>
            ` : `
              <!-- Main Content Full Width -->
              <div class="col-span-1 h-full">
                ${this.renderMainContent()}
              </div>
            `}
          </div>
        `;
        
      case 'right':
        return `
          <div class="grid ${this.connectionPanelVisible ? 'grid-cols-1 xl:grid-cols-5' : 'grid-cols-1'} gap-4 h-screen-adjusted">
            ${this.connectionPanelVisible ? `
              <!-- Main Content -->
              <div class="xl:col-span-4 h-full">
                ${this.renderMainContent()}
              </div>
              
              <!-- Right Connection Panel -->
              <div class="xl:col-span-1 h-full">
                ${connectionPanel}
              </div>
            ` : `
              <!-- Main Content Full Width -->
              <div class="col-span-1 h-full">
                ${this.renderMainContent()}
              </div>
            `}
          </div>
        `;
        
      case 'top':
        return `
          <div class="space-y-4">
            ${connectionPanel}
            ${this.renderMainContent()}
          </div>
        `;
        
      default:
        console.warn('Unknown panel position:', this.connectionPanelPosition, 'defaulting to left');
        // Force left position for unknown values
        this.connectionPanelPosition = 'left';
        return `
          <div class="grid ${this.connectionPanelVisible ? 'grid-cols-1 xl:grid-cols-5' : 'grid-cols-1'} gap-4 h-screen-adjusted">
            ${this.connectionPanelVisible ? `
              <!-- Left Connection Panel -->
              <div class="xl:col-span-1 h-full">
                ${connectionPanel}
              </div>
              
              <!-- Main Content -->
              <div class="xl:col-span-4 h-full">
                ${this.renderMainContent()}
              </div>
            ` : `
              <!-- Main Content Full Width -->
              <div class="col-span-1 h-full">
                ${this.renderMainContent()}
              </div>
            `}
          </div>
        `;
    }
  }

  private renderMainContent(): string {
    return `
      <!-- Main Layout: Log Panel (left) + Command Panel (right) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <!-- Log Panel with fixed height -->
        <div class="lg:col-span-2">
          <div id="log-panel" class="panel panel-fixed">
            <div class="panel-header flex-shrink-0 flex items-center justify-between">
              <span>${i18n.t('log.title')}</span>
              <div class="flex items-center gap-2">
                <button class="btn-secondary text-sm py-1 px-3" id="clear-logs">
                  ${i18n.t('log.clearLogs')}
                </button>
              </div>
            </div>
            <div class="panel-content flex-1 min-h-0 p-0" id="log-content">
              <!-- Log panel content will be mounted here -->
            </div>
          </div>
        </div>

        <!-- Command Panel with flexible height -->
        <div class="lg:col-span-1">
          <div id="command-panel" class="panel">
            <div class="panel-header">
              ${i18n.t('command.manual.title')}
            </div>
            <div class="panel-content" id="command-content">
              <!-- Command panel content will be mounted here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getConnectionPanelClasses(): string {
    const baseClasses = 'layout-transition';
    const visibilityClass = this.connectionPanelVisible ? 'panel-visible' : 'panel-hidden';
    const backgroundClass = this.connectionPanel ? this.connectionPanel.getPanelBackgroundClass() : 'bg-gray-900/10';
    
    switch (this.connectionPanelPosition) {
      case 'left':
        return `${baseClasses} ${visibilityClass} ${backgroundClass} panel-positioned-left panel-compact h-screen-adjusted panel-full-height debug-layout-left`;
      case 'right':
        return `${baseClasses} ${visibilityClass} ${backgroundClass} panel-positioned-right panel-compact h-screen-adjusted panel-full-height debug-layout-right`;
      case 'top':
        return `${baseClasses} ${visibilityClass} ${backgroundClass} panel-positioned-top debug-layout-top`;
      default:
        console.warn('getConnectionPanelClasses: Unknown position:', this.connectionPanelPosition);
        return `${baseClasses} ${visibilityClass} ${backgroundClass} panel-positioned-left panel-compact h-screen-adjusted panel-full-height debug-layout-left`;
    }
  }

  private updateLayout(): void {
    console.log('updateLayout called, connectionPanelPosition:', this.connectionPanelPosition);
    
    const layoutContainer = document.getElementById('layout-container');
    const toggleButton = document.getElementById('toggle-connection-panel');
    
    // Update connection panel compact mode based on position
    const isCompact = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
    this.connectionPanel.setCompactMode(isCompact);
    
    if (layoutContainer) {
      console.log('Rendering layout for position:', this.connectionPanelPosition);
      layoutContainer.innerHTML = this.renderLayout();
      // Re-mount child components after layout change
      this.mountChildComponents();
      // Re-attach minimize listener after layout change
      this.attachMinimizeListener();
      // Re-attach log panel listeners after layout change
      this.attachLogPanelListeners();
    }
    
    if (toggleButton) {
      toggleButton.innerHTML = `${this.connectionPanelVisible ? '🔼 Hide' : '🔽 Show'} Connection`;
    }
  }

  private updatePanelBackground(): void {
    const connectionPanelElement = document.getElementById('connection-panel');
    if (connectionPanelElement) {
      const newClasses = `panel ${this.getConnectionPanelClasses()}`;
      connectionPanelElement.className = newClasses;
    }
  }

  private getStatusClass(): string {
    switch (this.state.connectionStatus) {
      case 'connected': return 'status-connected';
      case 'connecting': return 'status-connecting';
      case 'error': return 'status-error';
      default: return 'status-disconnected';
    }
  }

  private getStatusText(): string {
    switch (this.state.connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  }

  private onConnectionChange(status: ConnectionStatus, config?: any): void {
    this.state.connectionStatus = status;
    if (config) {
      this.state.connectionConfig = config;
    }
    
    // Update command panel with connection status
    this.commandPanel.updateConnectionStatus(
      this.state.connectionConfig.type as 'RTU' | 'TCP_NATIVE',
      status === 'connected'
    );
    
    // Update log panel with connection type for proper packet analysis
    this.logPanel.setConnectionType(
      this.state.connectionConfig.type as 'RTU' | 'TCP_NATIVE'
    );
    
    this.updateStatus();
  }

  private async onCommandSend(command: string, isRepeating?: boolean): Promise<void> {
    // Send command to actual connection if connected
    try {
      if (this.state.connectionStatus === 'connected') {
        // Get current connection type directly from connection panel
        const currentConnectionType = this.getCurrentConnectionType();
        
        if (currentConnectionType === 'RTU') {
          // Create log entry using object pool
          const logEntry = this.createLogEntry(
            Date.now().toString(),
            new Date(),
            'send',
            command
          );
          
          if (isRepeating) {
            // Add to pending logs and update with throttling
            this.addToThrottledLogs(logEntry);
          } else {
            // Immediate update for non-repeating commands using optimized service
            this.optimizedLogService.addLog(logEntry);
            this.updateLogPanelFromService();
          }
          
          // Get serial service from connection panel
          const serialService = this.connectionPanel.getSerialService();
          if (serialService && serialService.getConnectionStatus()) {
            await serialService.sendHexString(command);
          }
        } else if (currentConnectionType === 'TCP_NATIVE') {
          // Get TCP Native service from connection panel
          const tcpNativeService = this.connectionPanel.getTcpNativeService();
          if (tcpNativeService && tcpNativeService.isTcpConnected()) {
            // Get the actual data that will be sent (with MBAP header for ModbusTCP)
            const actualSentData = this.getActualTcpData(command);
            
            // Create log entry using object pool
            const logEntry = this.createLogEntry(
              Date.now().toString(),
              new Date(),
              'send',
              actualSentData
            );
            
            if (isRepeating) {
              // Add to pending logs and update with throttling
              this.addToThrottledLogs(logEntry);
            } else {
              // Immediate update for non-repeating commands using optimized service
              this.optimizedLogService.addLog(logEntry);
              this.updateLogPanelFromService();
            }
            
            // Send ModbusTCP packet with MBAP header
            tcpNativeService.sendData(actualSentData);
            if (!isRepeating) {
              console.log('TCP Native Command sent successfully:', actualSentData);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send command:', error);
      
      // Only add error to log if not repeating (errors are rare and should be shown immediately)
      if (!isRepeating) {
        const errorLogEntry = this.createLogEntry(
          (Date.now() + 1).toString(),
          new Date(),
          'recv',
          '',
          error instanceof Error ? error.message : String(error)
        );
        
        this.optimizedLogService.addLog(errorLogEntry);
        this.updateLogPanelFromService();
      }
    }
  }

  private async addToThrottledLogs(logEntry: any): Promise<void> {
    this.pendingRepeatLogs.push(logEntry);
    
    // Flush based on batch size or time threshold
    if (this.pendingRepeatLogs.length >= this.batchSize) {
      await this.flushPendingLogs();
    } else {
      const now = Date.now();
      if (now - this.lastLogUpdateTime >= this.logUpdateThrottleMs) {
        await this.flushPendingLogs();
      }
    }
  }

  private async flushThrottledLogs(): Promise<void> {
    if (this.pendingRepeatLogs.length === 0) return;
    
    // Add logs to optimized service instead of state.logs
    for (const logEntry of this.pendingRepeatLogs) {
      this.optimizedLogService.addLog(logEntry);
    }
    
    // Update log panel from service
    this.updateLogPanelFromService();
    
    // Recycle objects to pool before clearing
    for (const logEntry of this.pendingRepeatLogs) {
      this.recycleLogEntry(logEntry);
    }
    
    // Clear pending logs and update timestamp
    this.pendingRepeatLogs = [];
    this.lastLogUpdateTime = Date.now();
  }


  private updateLogPanelFromService(): void {
    // Get logs from optimized service instead of state.logs
    const allLogs = this.optimizedLogService.getAllLogs();
    this.logPanel.updateLogs(allLogs);
  }

  private initializeMemoryManagement(): void {
    // Schedule periodic garbage collection every 30 seconds
    this.gcTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, 30000);

    // Listen for page unload to clean up
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private createLogEntry(id: string, timestamp: Date, direction: 'send' | 'recv', data: string, error?: string): any {
    // Try to reuse object from pool
    let logEntry = this.logEntryPool.pop();
    
    if (!logEntry) {
      // Create new object if pool is empty
      logEntry = {};
    }
    
    // Reset and populate object
    logEntry.id = id;
    logEntry.timestamp = timestamp;
    logEntry.direction = direction;
    logEntry.data = data;
    logEntry.error = error;
    
    return logEntry;
  }

  private recycleLogEntry(logEntry: any): void {
    // Return object to pool if pool size is under limit
    if (this.logEntryPool.length < this.maxPoolSize) {
      // Clear references to help GC
      logEntry.error = undefined;
      logEntry.data = '';
      this.logEntryPool.push(logEntry);
    }
  }

  private performMemoryCleanup(): void {
    // Trim pool size if it's grown too large
    if (this.logEntryPool.length > this.maxPoolSize) {
      this.logEntryPool = this.logEntryPool.slice(0, this.maxPoolSize);
    }

    // Force garbage collection if available (development only)
    if (typeof window.gc === 'function') {
      window.gc();
    }
  }

  private cleanup(): void {
    // Clear timers
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Clear object pool
    this.logEntryPool = [];
    this.pendingRepeatLogs = [];
  }

  // Complete application shutdown and resource cleanup
  public async destroy(): Promise<void> {
    try {
      // Clean up OptimizedLogService first (flushes pending exports)
      if (this.optimizedLogService) {
        await this.optimizedLogService.destroy();
      }

      // Clean up child components
      if (this.connectionPanel) {
        // Disconnect any active connections (if connection exists)
        try {
          const serialService = this.connectionPanel.getSerialService?.();
          if (serialService && serialService.getConnectionStatus()) {
            await serialService.disconnect();
          }
          
          const tcpService = this.connectionPanel.getTcpNativeService?.();
          if (tcpService && tcpService.isTcpConnected()) {
            await tcpService.disconnect();
          }
        } catch (error) {
          console.warn('[App] Error disconnecting services:', error);
        }
      }

      if (this.logPanel && typeof this.logPanel.destroy === 'function') {
        this.logPanel.destroy();
      }

      if (this.commandPanel && typeof this.commandPanel.destroy === 'function') {
        this.commandPanel.destroy();
      }

      if (this.logSettingsPanel && typeof this.logSettingsPanel.destroy === 'function') {
        this.logSettingsPanel.destroy();
      }

      // Remove global event listeners
      document.removeEventListener('panelBackgroundChange', this.updatePanelBackground);
      window.removeEventListener('beforeunload', this.cleanup);

      // Clear all timers and intervals
      this.cleanup();

      // Final memory cleanup
      this.performMemoryCleanup();

      console.log('[App] Destroyed successfully');
    } catch (error) {
      console.error('[App] Error during destroy:', error);
    }
  }

  private async flushPendingLogs(): Promise<void> {
    await this.flushThrottledLogs();
  }

  private async onRepeatModeChanged(isRepeating: boolean): Promise<void> {
    // Update LogPanel repeat mode status to control tooltip display
    this.logPanel.setRepeatMode(isRepeating);
    
    if (!isRepeating) {
      // Repeat mode stopped, flush any remaining pending logs
      await this.flushPendingLogs();
    }
  }

  private onLogsClear(): void {
    // Clear optimized service instead of state.logs
    this.optimizedLogService.clearLogs();
    
    // Recycle pending repeat logs to pool before clearing
    for (const log of this.pendingRepeatLogs) {
      this.recycleLogEntry(log);
    }
    
    // Clear pending repeat logs
    this.pendingRepeatLogs = [];
    this.lastLogUpdateTime = 0;
    
    // Reset incremental rendering tracking in App level
    this.resetIncrementalTracking();
    
    // Update the log panel from service
    this.updateLogPanelFromService();
  }

  private resetIncrementalTracking(): void {
    // Reset any App-level tracking variables related to incremental rendering
    // This ensures clean state for next logging session
  }

  private getCurrentConnectionType(): 'RTU' | 'TCP_NATIVE' {
    // Get current active tab from connection panel
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
      const tabType = activeTab.getAttribute('data-tab');
      if (tabType === 'TCP_NATIVE') return 'TCP_NATIVE';
      return 'RTU';
    }
    
    // Fallback to state if tab info not available
    return this.state.connectionConfig.type as 'RTU' | 'TCP_NATIVE' || 'RTU';
  }

  private getActualTcpData(pduHex: string, unitId: number = 1): string {
    // This mirrors the logic in WebSocketService.addMbapHeader
    const cleanPdu = pduHex.replace(/\s+/g, '');
    const pduLength = cleanPdu.length / 2;
    
    // Generate MBAP header
    const transactionId = (Date.now() % 65536).toString(16).padStart(4, '0').toUpperCase();
    const protocolId = '0000';
    const length = (1 + pduLength).toString(16).padStart(4, '0').toUpperCase();
    const unitIdHex = unitId.toString(16).padStart(2, '0').toUpperCase();
    
    const mbapHeader = transactionId + protocolId + length + unitIdHex;
    const fullPacket = mbapHeader + cleanPdu.toUpperCase();
    
    // Format with spaces for display
    return fullPacket.replace(/(.{2})/g, '$1 ').trim();
  }

  private async onDataReceived(data: string): Promise<void> {
    // Add received data to log immediately using object pool
    const logEntry = this.createLogEntry(
      Date.now().toString(),
      new Date(),
      'recv',
      data
    );
    
    // Use optimized service instead of state.logs
    this.optimizedLogService.addLog(logEntry);
    this.updateLogPanelFromService();
  }

  private updateStatus(): void {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-indicator + span');
    
    if (statusIndicator) {
      statusIndicator.className = `status-indicator ${this.getStatusClass()}`;
    }
    
    if (statusText) {
      statusText.textContent = this.getStatusText();
    }
  }

  private showGlobalSettings(): void {
    // Initialize LogSettingsPanel if not already created
    if (!this.logSettingsPanel) {
      this.logSettingsPanel = new LogSettingsPanel(this.optimizedLogService);
    }
    
    this.logSettingsPanel.show();
  }

  // Public methods for panel control
  public toggleConnectionPanel(): void {
    this.connectionPanelVisible = !this.connectionPanelVisible;
    this.updateLayout();
  }

  public setConnectionPanelPosition(position: 'top' | 'left' | 'right'): void {
    this.connectionPanelPosition = position;
    this.updateLayout();
  }

  public getConnectionPanelState(): { position: 'top' | 'left' | 'right', visible: boolean } {
    return {
      position: this.connectionPanelPosition,
      visible: this.connectionPanelVisible
    };
  }

  /**
   * Handle language change - re-render all UI components
   */
  private onLanguageChange(): void {
    // Get current container
    const container = document.querySelector('.min-h-screen') as HTMLElement;
    if (!container) return;

    // Store current state before re-rendering
    const currentState = {
      connectionStatus: this.state.connectionStatus,
      connectionConfig: this.state.connectionConfig,
      isAutoScroll: this.state.isAutoScroll,
      filter: this.state.filter
    };

    // Re-render the entire app with new language
    container.innerHTML = this.render();
    
    // Re-attach event listeners
    this.attachEventListeners();
    
    // Re-mount child components
    this.mountChildComponents().then(() => {
      // Restore state
      this.state = currentState;
      
      // Update status display
      this.updateStatus();
      
      // Apply current layout
      this.updateLayout();
      
      // Notify panels of language change
      this.connectionPanel?.onLanguageChange?.();
      this.logPanel?.onLanguageChange?.();
      this.commandPanel?.onLanguageChange?.();
      
      // Reset LogSettingsPanel to ensure it's recreated with new language
      if (this.logSettingsPanel) {
        this.logSettingsPanel.destroy();
        this.logSettingsPanel = null;
      }
    });
  }
}