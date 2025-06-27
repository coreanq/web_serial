import { ConnectionPanel } from './panels/ConnectionPanel';
import { LogPanel } from './panels/LogPanel';
import { CommandPanel } from './panels/CommandPanel';
import { AppState, ConnectionStatus } from '../types';

export class App {
  private state: AppState;
  private connectionPanel: ConnectionPanel;
  private logPanel: LogPanel;
  private commandPanel: CommandPanel;
  private connectionPanelPosition: 'top' | 'left' | 'right' = 'left';
  private connectionPanelVisible: boolean = true;

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
      logs: [],
      isAutoScroll: true,
      filter: {}
    };

    // Initialize panels
    this.connectionPanel = new ConnectionPanel(
      this.onConnectionChange.bind(this), 
      this.onDataReceived.bind(this)
    );
    this.logPanel = new LogPanel();
    this.commandPanel = new CommandPanel(this.onCommandSend.bind(this));
    
    // Set initial compact mode based on default position
    const isCompact = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
    this.connectionPanel.setCompactMode(isCompact);
  }

  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = this.render();
    this.attachEventListeners();
    await this.mountChildComponents();
  }

  private render(): string {
    return `
      <div class="min-h-screen bg-dark-bg p-4">
        <div class="max-w-7xl mx-auto">
          <!-- Header with Controls -->
          <header class="text-center py-4 mb-4">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-dark-text-primary">
                  🔧 Modbus Protocol Debugger Dashboard
                </h1>
              </div>
              
              <!-- Panel Controls -->
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-dark-text-muted">Panel:</span>
                  <select id="panel-position" class="input-field btn-sm">
                    <option value="top" ${this.connectionPanelPosition === 'top' ? 'selected' : ''}>📍 Top</option>
                    <option value="left" ${this.connectionPanelPosition === 'left' ? 'selected' : ''}>⬅️ Left</option>
                    <option value="right" ${this.connectionPanelPosition === 'right' ? 'selected' : ''}>➡️ Right</option>
                  </select>
                </div>
                <button id="toggle-connection-panel" class="btn-secondary btn-sm">
                  ${this.connectionPanelVisible ? '🔼 Hide' : '🔽 Show'} Connection
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
    
    // Add event listener for minimize button (will be added after layout update)
    this.attachMinimizeListener();
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
    }

    if (commandContent) {
      this.commandPanel.mount(commandContent);
    }
  }

  private renderLayout(): string {
    const connectionPanel = this.connectionPanelVisible ? `
      <div id="connection-panel" class="panel ${this.getConnectionPanelClasses()}">
        <div class="panel-header flex items-center justify-between">
          <span>Connection Settings</span>
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
      default:
        return `
          <div class="space-y-4">
            ${connectionPanel}
            ${this.renderMainContent()}
          </div>
        `;
    }
  }

  private renderMainContent(): string {
    const isConnectionPanelSide = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
    const logPanelHeight = isConnectionPanelSide ? 'h-screen-adjusted panel-full-height' : 'h-96';
    const commandPanelHeight = isConnectionPanelSide ? 'h-screen-adjusted panel-full-height' : 'h-96';
    const logContentClass = isConnectionPanelSide ? 'panel-content p-0 log-content-full' : 'panel-content p-0';
    
    return `
      <!-- Main Layout: Log Panel (left) + Command Panel (right) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 ${isConnectionPanelSide ? 'h-screen-adjusted' : ''}">
        <!-- Log Panel -->
        <div class="lg:col-span-2 ${isConnectionPanelSide ? 'h-full' : ''}">
          <div id="log-panel" class="panel ${logPanelHeight}">
            <div class="panel-header">
              Real-time Communication Log
            </div>
            <div class="${logContentClass}" id="log-content">
              <!-- Log panel content will be mounted here -->
            </div>
          </div>
        </div>

        <!-- Command Panel -->
        <div class="lg:col-span-1 ${isConnectionPanelSide ? 'h-full' : ''}">
          <div id="command-panel" class="panel ${commandPanelHeight}">
            <div class="panel-header">
              Manual Command
            </div>
            <div class="panel-content ${isConnectionPanelSide ? 'h-full overflow-y-auto' : ''}" id="command-content">
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
    
    switch (this.connectionPanelPosition) {
      case 'left':
        return `${baseClasses} ${visibilityClass} panel-positioned-left panel-compact h-screen-adjusted panel-full-height`;
      case 'right':
        return `${baseClasses} ${visibilityClass} panel-positioned-right panel-compact h-screen-adjusted panel-full-height`;
      case 'top':
      default:
        return `${baseClasses} ${visibilityClass} panel-positioned-top`;
    }
  }

  private updateLayout(): void {
    const layoutContainer = document.getElementById('layout-container');
    const toggleButton = document.getElementById('toggle-connection-panel');
    
    // Update connection panel compact mode based on position
    const isCompact = this.connectionPanelPosition === 'left' || this.connectionPanelPosition === 'right';
    this.connectionPanel.setCompactMode(isCompact);
    
    if (layoutContainer) {
      layoutContainer.innerHTML = this.renderLayout();
      // Re-mount child components after layout change
      this.mountChildComponents();
      // Re-attach minimize listener after layout change
      this.attachMinimizeListener();
    }
    
    if (toggleButton) {
      toggleButton.innerHTML = `${this.connectionPanelVisible ? '🔼 Hide' : '🔽 Show'} Connection`;
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
      this.state.connectionConfig.type as 'RTU' | 'TCP',
      status === 'connected'
    );
    
    this.updateStatus();
  }

  private async onCommandSend(command: string): Promise<void> {
    // Add command to log
    const logEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      direction: 'send' as const,
      data: command
    };
    
    this.state.logs.push(logEntry);
    this.logPanel.updateLogs(this.state.logs);
    
    // Send command to actual connection if connected
    try {
      if (this.state.connectionStatus === 'connected') {
        if (this.state.connectionConfig.type === 'RTU') {
          // Get serial service from connection panel
          const serialService = this.connectionPanel.getSerialService();
          if (serialService && serialService.getConnectionStatus()) {
            await serialService.sendHexString(command);
            console.log('RTU Command sent successfully:', command);
          }
        } else if (this.state.connectionConfig.type === 'TCP') {
          // Get WebSocket service from connection panel
          const webSocketService = this.connectionPanel.getWebSocketService();
          if (webSocketService && webSocketService.isConnected()) {
            await webSocketService.sendModbusCommand(command);
            console.log('TCP Command sent successfully:', command);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send command:', error);
      
      // Add error to log
      const errorLogEntry = {
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
        direction: 'recv' as const,
        data: '',
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.state.logs.push(errorLogEntry);
      this.logPanel.updateLogs(this.state.logs);
    }
  }

  private onDataReceived(data: string): void {
    // Add received data to log
    const logEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      direction: 'recv' as const,
      data: data
    };
    
    this.state.logs.push(logEntry);
    this.logPanel.updateLogs(this.state.logs);
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
}