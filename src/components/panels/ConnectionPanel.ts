import { ConnectionType, ConnectionStatus, SerialPort } from '../../types';
import { SerialService } from '../../services/SerialService';
import { WebSocketService, ModbusTcpConfig } from '../../services/WebSocketService';

export class ConnectionPanel {
  private activeTab: ConnectionType = 'RTU';
  private onConnectionChange: (status: ConnectionStatus, config?: any) => void;
  private onDataReceived?: (data: string) => void;
  private serialService: SerialService;
  private webSocketService: WebSocketService;
  private selectedPort: SerialPort | null = null;
  private grantedPorts: SerialPort[] = [];
  private isCompactMode: boolean = false;
  private tcpConnectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private webSocketStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private autoReconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3; // Reduced from 5 to 3
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentTcpConfig: ModbusTcpConfig | null = null;
  private lastDisconnectTime: number = 0;
  private disconnectDebounceMs: number = 100; // 100ms debounce for disconnect events - more responsive
  private lastErrorTime: number = 0;
  private errorDebounceMs: number = 5000; // 5 second debounce for error messages

  constructor(
    onConnectionChange: (status: ConnectionStatus, config?: any) => void, 
    onDataReceived?: (data: string) => void
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onDataReceived = onDataReceived;
    this.serialService = new SerialService();
    this.webSocketService = new WebSocketService();
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // WebSocket connection status
    this.webSocketService.onMessage('ws_connected', () => {
      console.log('WebSocket proxy connected');
      this.webSocketStatus = 'connected';
      this.updateWebSocketStatusDisplay();
    });

    // Handle server's 'connected' message too
    this.webSocketService.onMessage('connected', () => {
      console.log('WebSocket proxy server connected');
      this.webSocketStatus = 'connected';
      this.updateWebSocketStatusDisplay();
    });

    this.webSocketService.onMessage('ws_disconnected', () => {
      console.log('WebSocket proxy disconnected');
      this.webSocketStatus = 'disconnected';
      this.updateWebSocketStatusDisplay();
      if (this.tcpConnectionStatus === 'connected') {
        this.tcpConnectionStatus = 'error';
        this.onConnectionChange('error');
        this.updateButtonStates(false);
      }
    });

    this.webSocketService.onMessage('ws_error', () => {
      console.error('WebSocket proxy connection error');
      this.webSocketStatus = 'error';
      this.updateWebSocketStatusDisplay();
    });

    // TCP Modbus connection status
    this.webSocketService.onMessage('tcp_connected', (data) => {
      console.log('✅ TCP Modbus connected successfully:', data.message);
      
      // Clear any pending reconnect attempts immediately
      this.clearReconnectTimeout();
      
      // Reset reconnection state and re-enable auto reconnect
      this.reconnectAttempts = 0;
      this.lastDisconnectTime = 0;
      this.lastErrorTime = 0;
      this.autoReconnectEnabled = true;
      
      // Update connection status
      this.tcpConnectionStatus = 'connected';
      
      // Update current config with server confirmation data if available
      if (data.host && data.port) {
        this.currentTcpConfig = {
          host: data.host,
          port: data.port
        };
        console.log(`📍 Connection config updated: ${data.host}:${data.port}`);
      }
      
      this.onConnectionChange('connected', this.getCurrentConfig());
      this.updateButtonStates(true);
      this.updateTcpStatusDisplay();
    });

    this.webSocketService.onMessage('tcp_disconnected', (data) => {
      const now = Date.now();
      const timeSinceLastDisconnect = now - this.lastDisconnectTime;
      
      // Enhanced debounce logic to prevent spam and duplicate processing
      if (timeSinceLastDisconnect < this.disconnectDebounceMs) {
        // Only log first few duplicate events to avoid spam
        if (timeSinceLastDisconnect === 0 || Math.random() < 0.1) {
          console.log(`Ignoring duplicate disconnect event (${timeSinceLastDisconnect}ms since last)`);
        }
        return;
      }
      
      // Additional check: if already disconnected, ignore
      if (this.tcpConnectionStatus === 'disconnected') {
        console.log('Ignoring disconnect event - already disconnected');
        return;
      }
      
      console.log(`TCP Modbus disconnected: ${data.message} (${timeSinceLastDisconnect}ms since last)`);
      this.lastDisconnectTime = now;
      
      // Only process disconnect if we were previously connected or connecting
      if (this.tcpConnectionStatus === 'connected' || this.tcpConnectionStatus === 'connecting') {
        console.log('Processing legitimate disconnect event');
        
        // Clear any existing reconnect timeout before changing state
        this.clearReconnectTimeout();
        
        this.tcpConnectionStatus = 'disconnected';
        this.onConnectionChange('disconnected');
        this.updateButtonStates(false);
        this.updateTcpStatusDisplay();
        
        // Auto-reconnect if enabled, not exceeded max attempts, and current config exists
        if (this.autoReconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts && this.currentTcpConfig) {
          console.log('Scheduling auto-reconnect due to unexpected disconnection');
          this.scheduleReconnect();
        } else if (!this.currentTcpConfig) {
          console.log('No current TCP config available for reconnection');
        }
      } else {
        console.log('Ignoring disconnect event - not in connected/connecting state');
      }
    });

    this.webSocketService.onMessage('tcp_error', (data) => {
      const now = Date.now();
      const timeSinceLastError = now - this.lastErrorTime;
      
      // Debounce error messages to prevent spam
      if (timeSinceLastError >= this.errorDebounceMs) {
        console.error('TCP Modbus error:', data);
        this.lastErrorTime = now;
      }
      
      this.tcpConnectionStatus = 'error';
      this.onConnectionChange('error');
      this.updateButtonStates(false);
      this.updateTcpStatusDisplay();
      
      // Auto-reconnect on timeout errors with attempt limit
      if (data.error === 'Connection timeout' && 
          this.autoReconnectEnabled && 
          this.currentTcpConfig &&
          this.reconnectAttempts < this.maxReconnectAttempts) {
        
        if (timeSinceLastError >= this.errorDebounceMs) {
          console.log(`Connection timeout detected (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}), attempting auto-reconnect...`);
        }
        this.scheduleReconnect();
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Auto-reconnect disabled.`);
        this.autoReconnectEnabled = false;
      }
    });

    // Data received from Modbus device
    this.webSocketService.onMessage('data', (data) => {
      console.log('Received from Modbus device:', data.data);
      if (this.onDataReceived) {
        this.onDataReceived(data.data);
      }
    });

    this.webSocketService.onMessage('error', (data) => {
      console.error('WebSocket service error:', data);
      alert(`WebSocket Error: ${data.message}`);
    });
  }

  async mount(container: HTMLElement): Promise<void> {
    // Load granted ports first
    await this.loadGrantedPorts();
    container.innerHTML = this.render();
    this.attachEventListeners();
  }

  private render(): string {
    return `
      <div class="space-y-4">
        <!-- Tab Navigation -->
        <div class="flex border-b border-dark-border">
          <button class="tab-button ${this.activeTab === 'RTU' ? 'active' : ''}" data-tab="RTU">
            RTU (Serial)
          </button>
          <button class="tab-button ${this.activeTab === 'TCP' ? 'active' : ''}" data-tab="TCP">
            TCP/IP
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          ${this.activeTab === 'RTU' ? this.renderRtuTab() : this.renderTcpTab()}
        </div>

        <!-- Connection Controls -->
        <div class="flex items-center gap-3 pt-4 border-t border-dark-border">
          <button class="btn-primary" id="connect-btn">
            Connect
          </button>
          <button class="btn-secondary" id="disconnect-btn" disabled>
            Disconnect
          </button>
          ${SerialService.isSupported() && this.selectedPort ? `
            <button class="btn-secondary text-xs px-2 py-1" id="force-close-btn" title="Force close port if stuck">
              🔧 Force Close
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderRtuTab(): string {
    const isWebSerialSupported = SerialService.isSupported();
    
    return `
      <div class="space-y-4">
        <!-- Web Serial API Support Status -->
        <div class="p-3 rounded-md ${isWebSerialSupported 
          ? 'bg-green-900/20 border border-green-500/30' 
          : 'bg-red-900/20 border border-red-500/30'}">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${isWebSerialSupported ? 'bg-green-500' : 'bg-red-500'}"></div>
            <span class="text-sm font-medium">
              ${isWebSerialSupported ? 'Web Serial API Supported' : 'Web Serial API Not Supported'}
            </span>
          </div>
          ${!isWebSerialSupported ? `
            <p class="text-xs text-dark-text-muted mt-1">
              Please use Chrome/Edge 89+ or enable the Web Serial API flag
            </p>
          ` : ''}
        </div>

        <div class="${this.isCompactMode ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'}">
          <!-- Serial Port Selection -->
          <div class="${this.isCompactMode ? '' : 'lg:col-span-2'}">
            <label class="block text-sm font-medium text-dark-text-secondary mb-2">
              Serial Port
            </label>
            <div class="space-y-2">
              ${isWebSerialSupported ? `
                <div class="flex gap-2">
                  <button class="btn-primary flex-1 ${this.isCompactMode ? 'text-sm py-1' : ''}" id="select-port-btn">
                    📍 ${this.isCompactMode ? 'Port' : 'Select Serial Port'}
                  </button>
                  <button class="btn-secondary ${this.isCompactMode ? 'text-sm py-1 px-2' : ''}" id="refresh-ports-btn" title="Refresh granted ports">
                    🔄
                  </button>
                </div>
                
                ${this.grantedPorts.length > 0 ? `
                  <select class="input-field w-full ${this.isCompactMode ? 'text-sm' : ''}" id="granted-ports">
                    <option value="">Choose from granted ports...</option>
                    ${this.grantedPorts.map((port, index) => {
                      const info = port.getInfo();
                      const label = info.usbVendorId && info.usbProductId 
                        ? `USB Device (VID: ${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}, PID: ${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()})`
                        : `Serial Port ${index + 1}`;
                      return `<option value="${index}">${label}</option>`;
                    }).join('')}
                  </select>
                ` : `
                  <p class="text-xs text-dark-text-muted">
                    No previously granted ports. Click "Select Serial Port" to choose a port.
                  </p>
                `}
                
                <div class="text-xs" id="selected-port-info">
                  <div class="flex items-center gap-2">
                    <span class="${this.selectedPort ? 'text-dark-text-secondary' : 'text-dark-text-muted'}">
                      ${this.selectedPort ? this.getPortDisplayName(this.selectedPort) : 'No port selected'}
                    </span>
                    ${this.selectedPort ? `
                      <div class="flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full ${this.serialService.getConnectionStatus() ? 'bg-green-500' : 'bg-gray-400'}"></div>
                        <span class="text-xs ${this.serialService.getConnectionStatus() ? 'text-green-400' : 'text-gray-400'}">
                          ${this.serialService.getConnectionStatus() ? 'Connected' : 'Available'}
                        </span>
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : `
                <select class="input-field w-full" id="serial-port" disabled>
                  <option>Web Serial API not supported</option>
                </select>
              `}
            </div>
          </div>

          <!-- Baud Rate -->
          <div>
            <label class="block text-sm font-medium text-dark-text-secondary mb-2">
              Baud Rate
            </label>
            <select class="input-field w-full ${this.isCompactMode ? 'text-sm' : ''}" id="baud-rate">
              <option value="1200">1200</option>
              <option value="2400">2400</option>
              <option value="4800">4800</option>
              <option value="9600" selected>9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
              <option value="230400">230400</option>
              <option value="460800">460800</option>
              <option value="custom">Custom...</option>
            </select>
            <input 
              type="text" 
              class="input-field w-full ${this.isCompactMode ? 'text-sm' : ''} mt-2 hidden" 
              id="baud-rate-custom" 
              placeholder="Enter custom baud rate"
              pattern="[0-9]*"
              inputmode="numeric"
            >
          </div>

          <!-- Parity -->
          <div>
            <label class="block text-sm font-medium text-dark-text-secondary mb-2">
              Parity
            </label>
            <select class="input-field w-full ${this.isCompactMode ? 'text-sm' : ''}" id="parity">
              <option value="none" selected>None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  private renderTcpTab(): string {
    return `
      <div class="space-y-4">
        <!-- WebSocket Server Status -->
        <div class="p-3 rounded-md ${this.getWebSocketStatusClass()}">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${this.getWebSocketIndicatorClass()}"></div>
            <span class="text-sm font-medium">
              ${this.getWebSocketStatusText()}
            </span>
          </div>
          <p class="text-xs text-dark-text-muted mt-1">
            WebSocket Proxy: ws://localhost:8080
          </p>
        </div>

        <!-- Modbus TCP Connection Status -->
        <div class="p-3 rounded-md ${this.getTcpStatusClass()}">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${this.getTcpIndicatorClass()}"></div>
            <span class="text-sm font-medium">
              ${this.getTcpStatusText()}
            </span>
          </div>
          <p class="text-xs text-dark-text-muted mt-1">
            ${this.getTcpStatusDetail()}
          </p>
        </div>

        <!-- TCP Connection Settings -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark-text-secondary mb-2">
              IP Address
            </label>
            <input 
              type="text" 
              class="input-field w-full" 
              id="tcp-host"
              placeholder="192.168.1.100"
              value="127.0.0.1"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-dark-text-secondary mb-2">
              Port
            </label>
            <input 
              type="number" 
              class="input-field w-full" 
              id="tcp-port"
              placeholder="502"
              value="5020"
              min="1"
              max="65535"
            />
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Tab switching
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabType = target.dataset.tab as ConnectionType;
        this.switchTab(tabType);
      });
    });

    // Connection buttons
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const forceCloseBtn = document.getElementById('force-close-btn');

    connectBtn?.addEventListener('click', () => this.handleConnect());
    disconnectBtn?.addEventListener('click', () => this.handleDisconnect());
    forceCloseBtn?.addEventListener('click', () => this.handleForceClose());

    // Baud rate custom input toggle
    const baudRateSelect = document.getElementById('baud-rate') as HTMLSelectElement;
    const baudRateCustom = document.getElementById('baud-rate-custom') as HTMLInputElement;
    
    baudRateSelect?.addEventListener('change', () => {
      if (baudRateSelect.value === 'custom') {
        baudRateCustom?.classList.remove('hidden');
        baudRateCustom?.focus();
      } else {
        baudRateCustom?.classList.add('hidden');
      }
    });

    // Serial port buttons (RTU tab only)
    if (this.activeTab === 'RTU' && SerialService.isSupported()) {
      const selectPortBtn = document.getElementById('select-port-btn');
      const refreshPortsBtn = document.getElementById('refresh-ports-btn');
      const grantedPortsSelect = document.getElementById('granted-ports') as HTMLSelectElement;

      selectPortBtn?.addEventListener('click', () => this.handleSelectPort());
      refreshPortsBtn?.addEventListener('click', () => this.handleRefreshPorts());
      
      grantedPortsSelect?.addEventListener('change', (e) => {
        const selectedIndex = parseInt((e.target as HTMLSelectElement).value);
        if (!isNaN(selectedIndex) && this.grantedPorts[selectedIndex]) {
          this.selectedPort = this.grantedPorts[selectedIndex];
          this.updateSelectedPortInfo();
        }
      });
    }
  }

  private switchTab(tabType: ConnectionType): void {
    // Only proceed if actually switching to a different tab
    if (this.activeTab === tabType) {
      return;
    }
    
    this.activeTab = tabType;
    const container = document.querySelector('.tab-content');
    if (container) {
      container.innerHTML = tabType === 'RTU' ? this.renderRtuTab() : this.renderTcpTab();
      // Reattach event listeners after content change
      this.attachEventListeners();
    }

    // Notify about connection type change for AutoCRC setting update
    const currentStatus = this.tcpConnectionStatus === 'connected' || 
                          this.serialService.getConnectionStatus() ? 'connected' : 'disconnected';
    this.onConnectionChange(currentStatus as ConnectionStatus, { type: tabType });

    // Update tab button states
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');

    // Auto-connect to WebSocket when switching to TCP tab with server status check
    if (tabType === 'TCP' && !this.webSocketService.isConnected()) {
      console.log('TCP tab selected, checking proxy server status...');
      this.webSocketStatus = 'connecting';
      this.updateWebSocketStatusDisplay();
      
      // Check if proxy server is running first
      this.webSocketService.checkServerStatus().then(status => {
        if (status.running) {
          console.log('Proxy server is running, connecting...');
          return this.webSocketService.connect();
        } else {
          console.warn('Proxy server not running:', status.error);
          this.webSocketStatus = 'error';
          this.updateWebSocketStatusDisplay();
          this.showProxyServerGuide(status.error || 'Proxy server not available');
          throw new Error(status.error || 'Proxy server not running');
        }
      }).then(() => {
        console.log('WebSocket connection completed successfully');
      }).catch(error => {
        console.error('WebSocket connection failed:', error);
        this.webSocketStatus = 'error';
        this.updateWebSocketStatusDisplay();
      });
    }
  }

  // Show proxy server download and setup guide
  private showProxyServerGuide(errorMessage: string): void {
    const guideHtml = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="proxy-guide-modal">
        <div class="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-dark-text-primary">Proxy Server Required</h3>
            <button class="text-dark-text-muted hover:text-dark-text-primary" onclick="document.getElementById('proxy-guide-modal').remove()">
              ✕
            </button>
          </div>
          
          <div class="mb-4">
            <p class="text-sm text-dark-text-secondary mb-2">${errorMessage}</p>
            <p class="text-sm text-dark-text-secondary">TCP/IP Modbus 기능을 사용하려면 프록시 서버가 필요합니다.</p>
          </div>
          
          <div class="space-y-3">
            <div class="bg-dark-panel rounded p-3">
              <h4 class="text-sm font-medium text-dark-text-primary mb-2">📥 다운로드 & 실행</h4>
              <p class="text-xs text-dark-text-muted mb-2">플랫폼에 맞는 실행 파일을 다운로드하세요:</p>
              <div class="space-y-1 text-xs">
                <div>• Windows: <code class="bg-dark-surface px-1 rounded">modbus-proxy-windows.exe</code></div>
                <div>• macOS: <code class="bg-dark-surface px-1 rounded">modbus-proxy-macos</code></div>
                <div>• Linux: <code class="bg-dark-surface px-1 rounded">modbus-proxy-linux</code></div>
              </div>
            </div>
            
            <div class="bg-dark-panel rounded p-3">
              <h4 class="text-sm font-medium text-dark-text-primary mb-2">🚀 실행 방법</h4>
              <p class="text-xs text-dark-text-muted mb-1">1. 다운로드한 파일을 더블클릭하여 실행</p>
              <p class="text-xs text-dark-text-muted mb-1">2. 서버가 포트 8080에서 시작됨</p>
              <p class="text-xs text-dark-text-muted">3. 이 페이지에서 TCP 탭을 다시 클릭</p>
            </div>
          </div>
          
          <div class="flex gap-2 mt-4">
            <button class="btn-primary flex-1 text-sm" onclick="window.open('https://github.com/your-repo/releases', '_blank')">
              📥 다운로드
            </button>
            <button class="btn-secondary text-sm" onclick="document.getElementById('proxy-guide-modal').remove()">
              나중에
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if any
    document.getElementById('proxy-guide-modal')?.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', guideHtml);
  }

  // Load previously granted serial ports
  private async loadGrantedPorts(): Promise<void> {
    if (!SerialService.isSupported()) {
      return;
    }

    try {
      this.grantedPorts = await this.serialService.getGrantedPorts();
    } catch (error) {
      console.error('Failed to load granted ports:', error);
      this.grantedPorts = [];
    }
  }

  // Handle serial port selection
  private async handleSelectPort(): Promise<void> {
    if (!SerialService.isSupported()) {
      alert('Web Serial API is not supported in this browser');
      return;
    }

    try {
      // Disconnect from current port if connected
      if (this.serialService.getConnectionStatus()) {
        await this.serialService.disconnect();
        this.onConnectionChange('disconnected');
        this.updateButtonStates(false);
      }

      const port = await this.serialService.requestPort();
      this.selectedPort = port;
      
      // Refresh granted ports list
      await this.loadGrantedPorts();
      
      // Update UI
      this.refreshUI();
      this.updateSelectedPortInfo();
      
    } catch (error) {
      console.error('Failed to select port:', error);
      if (error instanceof Error) {
        if (error.message.includes('No serial port was selected')) {
          // User cancelled port selection - not an error
          return;
        }
        alert(`Failed to select port: ${error.message}`);
      }
    }
  }

  // Handle refresh ports
  private async handleRefreshPorts(): Promise<void> {
    await this.loadGrantedPorts();
    this.refreshUI();
  }

  // Update selected port info display
  private updateSelectedPortInfo(): void {
    const portInfoElement = document.getElementById('selected-port-info');
    if (portInfoElement) {
      const isConnected = this.serialService.getConnectionStatus();
      portInfoElement.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="${this.selectedPort ? 'text-dark-text-secondary' : 'text-dark-text-muted'}">
            ${this.selectedPort ? this.getPortDisplayName(this.selectedPort) : 'No port selected'}
          </span>
          ${this.selectedPort ? `
            <div class="flex items-center gap-1">
              <div class="w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}"></div>
              <span class="text-xs ${isConnected ? 'text-green-400' : 'text-gray-400'}">
                ${isConnected ? 'Connected' : 'Available'}
              </span>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  // Get display name for a port
  private getPortDisplayName(port: SerialPort): string {
    const info = port.getInfo();
    if (info.usbVendorId && info.usbProductId) {
      return `USB Device (VID: ${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}, PID: ${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()})`;
    }
    return 'Serial Port';
  }

  // Refresh the UI after port changes
  private refreshUI(): void {
    if (this.activeTab === 'RTU') {
      const container = document.querySelector('.tab-content');
      if (container) {
        container.innerHTML = this.renderRtuTab();
        this.attachEventListeners();
      }
    }
  }

  private async handleConnect(): Promise<void> {
    if (this.activeTab === 'RTU') {
      await this.handleRtuConnect();
    } else {
      await this.handleTcpConnect();
    }
  }

  private async handleRtuConnect(): Promise<void> {
    if (!SerialService.isSupported()) {
      alert('Web Serial API is not supported in this browser');
      return;
    }

    if (!this.selectedPort) {
      alert('Please select a serial port first');
      return;
    }

    // Check if already connected to this port
    if (this.serialService.getConnectionStatus()) {
      alert('Already connected to a serial port. Disconnect first to reconnect.');
      return;
    }

    // Check if connection is already in progress
    if (this.serialService.getConnectionProgress()) {
      alert('Connection already in progress. Please wait for it to complete.');
      return;
    }

    // Disable connect button to prevent multiple clicks
    this.updateButtonStates(false, true);
    this.onConnectionChange('connecting');

    try {
      const config = this.getCurrentConfig();
      const serialOptions = {
        baudRate: config.serial.baudRate,
        dataBits: config.serial.dataBits,
        stopBits: config.serial.stopBits,
        parity: config.serial.parity
      };

      await this.serialService.connect(this.selectedPort, serialOptions);
      
      this.onConnectionChange('connected', config);
      this.updateButtonStates(true, false);
      this.updateSelectedPortInfo();
      
      // Start reading data
      this.startDataReading();
      
    } catch (error) {
      console.error('Connection failed:', error);
      
      // Immediately reset button state
      this.updateButtonStates(false, false);
      this.onConnectionChange('error');
      
      // Reset to disconnected state after showing error briefly
      setTimeout(() => {
        this.onConnectionChange('disconnected');
        this.updateSelectedPortInfo();
      }, 2000);
      
      if (error instanceof Error) {
        // Provide helpful error messages
        if (error.message.includes('already open')) {
          alert(`Connection failed: ${error.message}\n\nTip: Try refreshing the page or disconnecting other applications using this port.`);
        } else {
          alert(`Connection failed: ${error.message}`);
        }
      }
    }
  }

  private async handleTcpConnect(): Promise<void> {
    // Enable auto-reconnect when user initiates connection
    this.autoReconnectEnabled = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimeout();
    
    this.tcpConnectionStatus = 'connecting';
    this.onConnectionChange('connecting');
    this.updateButtonStates(false, true);

    try {
      // Connect to WebSocket proxy server first
      if (!this.webSocketService.isConnected()) {
        this.webSocketStatus = 'connecting';
        this.updateWebSocketStatusDisplay();
        await this.webSocketService.connect();
      }

      // Get TCP connection config
      const config = this.getCurrentConfig();
      const tcpConfig: ModbusTcpConfig = {
        host: config.tcp.host,
        port: config.tcp.port
      };

      console.log(`🔌 Attempting to connect to Modbus TCP device at ${tcpConfig.host}:${tcpConfig.port}`);
      console.log(`📊 Connection state: WS=${this.webSocketStatus}, TCP=${this.tcpConnectionStatus}, Reconnect attempts=${this.reconnectAttempts}`);

      // Store current config for status display
      this.currentTcpConfig = tcpConfig;
      
      // Connect to Modbus device via WebSocket proxy
      await this.webSocketService.connectToModbusDevice(tcpConfig);

    } catch (error) {
      console.error('TCP connection failed:', error);
      this.tcpConnectionStatus = 'error';
      this.onConnectionChange('error');
      this.updateButtonStates(false, false);
      
      if (error instanceof Error) {
        alert(`TCP Connection failed: ${error.message}`);
      }
    }
  }

  private async handleDisconnect(): Promise<void> {
    try {
      // Disable auto-reconnect when user manually disconnects
      this.autoReconnectEnabled = false;
      this.clearReconnectTimeout();
      
      if (this.activeTab === 'RTU' && this.serialService.getConnectionStatus()) {
        await this.serialService.disconnect();
      } else if (this.activeTab === 'TCP' && this.tcpConnectionStatus === 'connected') {
        await this.webSocketService.disconnectFromModbusDevice();
      }
      
      this.tcpConnectionStatus = 'disconnected';
      this.reconnectAttempts = 0;
      this.currentTcpConfig = null;
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updateSelectedPortInfo();
      this.updateTcpStatusDisplay();
      
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force update UI even if disconnect fails
      this.tcpConnectionStatus = 'disconnected';
      this.currentTcpConfig = null;
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updateTcpStatusDisplay();
    }
  }


  // Handle force close port
  private async handleForceClose(): Promise<void> {
    if (!this.selectedPort) {
      return;
    }

    if (!confirm('Force close the selected port? This will attempt to close the port even if it\'s being used by another application.')) {
      return;
    }

    try {
      // Force disconnect through service
      await this.serialService.disconnect();
      
      // Try to close the port directly if still open
      if (this.selectedPort.readable !== null || this.selectedPort.writable !== null) {
        try {
          await this.selectedPort.close();
        } catch (error) {
          console.warn('Direct port close failed:', error);
        }
      }

      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updateSelectedPortInfo();
      
      alert('✅ Port force closed successfully. You can now try to reconnect.');
      
    } catch (error) {
      console.error('Force close failed:', error);
      alert(`❌ Force close failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Start reading data from serial port
  private startDataReading(): void {
    if (!this.serialService.getConnectionStatus()) {
      return;
    }

    this.serialService.startReading(
      (data: Uint8Array) => {
        // Handle received data
        const hexString = SerialService.uint8ArrayToHex(data);
        console.log('Received data:', hexString);
        
        // Send to parent component via callback
        if (this.onDataReceived) {
          this.onDataReceived(hexString);
        }
      },
      (error: Error) => {
        console.error('Serial read error:', error);
        this.onConnectionChange('error');
      }
    );
  }

  private getCurrentConfig(): any {
    if (this.activeTab === 'RTU') {
      const baudRateSelect = (document.getElementById('baud-rate') as HTMLSelectElement)?.value || '9600';
      const baudRateCustom = (document.getElementById('baud-rate-custom') as HTMLInputElement)?.value || '9600';
      const baudRate = parseInt(baudRateSelect === 'custom' ? baudRateCustom : baudRateSelect);
      const parity = (document.getElementById('parity') as HTMLSelectElement)?.value || 'none';
      
      return {
        type: 'RTU',
        serial: { 
          port: this.selectedPort,
          portName: this.selectedPort ? this.getPortDisplayName(this.selectedPort) : 'No port selected',
          baudRate, 
          parity, 
          dataBits: 8, 
          stopBits: 1 
        }
      };
    } else {
      const host = (document.getElementById('tcp-host') as HTMLInputElement)?.value || '127.0.0.1';
      const port = parseInt((document.getElementById('tcp-port') as HTMLInputElement)?.value || '5020');

      return {
        type: 'TCP',
        tcp: { host, port }
      };
    }
  }

  private updateButtonStates(connected: boolean, connecting: boolean = false): void {
    const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

    if (connectBtn && disconnectBtn) {
      // Disable connect button if connected or connecting
      connectBtn.disabled = connected || connecting;
      
      // Update connect button text based on state
      if (connecting) {
        connectBtn.textContent = 'Connecting...';
      } else {
        connectBtn.textContent = 'Connect';
      }
      
      // Disable disconnect button unless connected
      disconnectBtn.disabled = !connected;
    }
  }

  // Set compact mode for the panel
  public setCompactMode(compact: boolean): void {
    this.isCompactMode = compact;
  }

  // Public method to get serial service for command sending
  getSerialService(): SerialService {
    return this.serialService;
  }

  // Public method to get WebSocket service for TCP command sending
  getWebSocketService(): WebSocketService {
    return this.webSocketService;
  }

  // WebSocket status helper methods
  private getWebSocketStatusClass(): string {
    switch (this.webSocketStatus) {
      case 'connected':
        return 'bg-green-900/20 border border-green-500/30';
      case 'connecting':
        return 'bg-yellow-900/20 border border-yellow-500/30';
      case 'error':
        return 'bg-red-900/20 border border-red-500/30';
      default:
        return 'bg-gray-900/20 border border-gray-500/30';
    }
  }

  private getWebSocketIndicatorClass(): string {
    switch (this.webSocketStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  private getWebSocketStatusText(): string {
    switch (this.webSocketStatus) {
      case 'connected':
        return 'WebSocket Proxy Connected';
      case 'connecting':
        return 'Connecting to WebSocket Proxy...';
      case 'error':
        return 'WebSocket Proxy Connection Failed';
      default:
        return 'WebSocket Proxy Disconnected';
    }
  }

  private updateWebSocketStatusDisplay(): void {
    if (this.activeTab === 'TCP') {
      // Refresh TCP tab to update WebSocket status
      const container = document.querySelector('.tab-content');
      if (container) {
        container.innerHTML = this.renderTcpTab();
        this.attachEventListeners();
      }
    }
  }

  private updateTcpStatusDisplay(): void {
    if (this.activeTab === 'TCP') {
      // Refresh TCP tab to update Modbus TCP status
      const container = document.querySelector('.tab-content');
      if (container) {
        container.innerHTML = this.renderTcpTab();
        this.attachEventListeners();
      }
    }
  }

  // Auto-reconnect helper methods
  private scheduleReconnect(): void {
    // Prevent multiple simultaneous reconnect attempts
    if (this.reconnectTimeout) {
      console.log('Reconnect already scheduled, ignoring duplicate request');
      return;
    }
    
    // Additional check: don't reconnect if we just attempted recently
    const timeSinceLastReconnect = Date.now() - this.lastDisconnectTime;
    if (timeSinceLastReconnect < 3000) { // Wait at least 3 seconds between reconnect attempts
      console.log(`Delaying reconnect - only ${timeSinceLastReconnect}ms since last disconnect`);
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.scheduleReconnect();
      }, 3000 - timeSinceLastReconnect);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff with max 30s
    
    console.log(`📞 Scheduling TCP reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      // Double check that we still need to reconnect and haven't exceeded max attempts
      if (!this.autoReconnectEnabled || this.tcpConnectionStatus === 'connected' || this.reconnectAttempts > this.maxReconnectAttempts) {
        console.log('❌ Cancelling reconnect attempt - conditions changed:', {
          autoReconnectEnabled: this.autoReconnectEnabled,
          status: this.tcpConnectionStatus,
          attempts: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts
        });
        return;
      }
      
      console.log(`🔄 Attempting TCP reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      try {
        // Use current config if available, otherwise get from form
        let tcpConfig = this.currentTcpConfig;
        if (!tcpConfig) {
          const config = this.getCurrentConfig();
          tcpConfig = {
            host: config.tcp.host,
            port: config.tcp.port
          };
          this.currentTcpConfig = tcpConfig;
        }
        
        // Update status to show reconnection attempt
        this.tcpConnectionStatus = 'connecting';
        this.onConnectionChange('connecting');
        this.updateButtonStates(false, true);
        this.updateTcpStatusDisplay();
        
        await this.webSocketService.reconnectToModbusDevice(tcpConfig);
        
      } catch (error) {
        console.error('❌ TCP reconnect failed:', error);
        
        // Try again if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.autoReconnectEnabled) {
          this.scheduleReconnect();
        } else {
          console.log('🚫 Max TCP reconnect attempts reached or auto-reconnect disabled');
          this.autoReconnectEnabled = false;
          this.tcpConnectionStatus = 'error';
          this.onConnectionChange('error');
          this.updateButtonStates(false, false);
          this.updateTcpStatusDisplay();
        }
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      console.log('Clearing TCP reconnect timeout');
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Public method to enable/disable auto-reconnect
  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
    if (!enabled) {
      this.clearReconnectTimeout();
    }
  }

  // TCP status helper methods
  private getTcpStatusClass(): string {
    switch (this.tcpConnectionStatus) {
      case 'connected':
        return 'bg-green-900/20 border border-green-500/30';
      case 'connecting':
        return 'bg-yellow-900/20 border border-yellow-500/30';
      case 'error':
        return 'bg-red-900/20 border border-red-500/30';
      default:
        return 'bg-gray-900/20 border border-gray-500/30';
    }
  }

  private getTcpIndicatorClass(): string {
    switch (this.tcpConnectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  private getTcpStatusText(): string {
    switch (this.tcpConnectionStatus) {
      case 'connected':
        return 'Modbus TCP Connected';
      case 'connecting':
        return 'Connecting to Modbus Device...';
      case 'error':
        return 'Modbus TCP Connection Failed';
      default:
        return 'Modbus TCP Disconnected';
    }
  }

  private getTcpStatusDetail(): string {
    if (this.currentTcpConfig) {
      const statusPrefix = this.tcpConnectionStatus === 'connected' ? 'Connected to:' :
                          this.tcpConnectionStatus === 'connecting' ? 'Connecting to:' :
                          this.tcpConnectionStatus === 'error' ? 'Failed to connect to:' :
                          'Last attempted:';
      return `${statusPrefix} ${this.currentTcpConfig.host}:${this.currentTcpConfig.port}`;
    }
    return 'No connection attempted';
  }

  // Cleanup method to remove event handlers
  public cleanup(): void {
    // Clear any pending timeouts
    this.clearReconnectTimeout();
    
    // Remove WebSocket event handlers
    this.webSocketService.offMessage('ws_connected');
    this.webSocketService.offMessage('connected');
    this.webSocketService.offMessage('ws_disconnected');
    this.webSocketService.offMessage('ws_error');
    this.webSocketService.offMessage('tcp_connected');
    this.webSocketService.offMessage('tcp_disconnected');
    this.webSocketService.offMessage('tcp_error');
    
    // Disconnect services
    if (this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }
  }
}