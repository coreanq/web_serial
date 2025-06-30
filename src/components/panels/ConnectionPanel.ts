import { ConnectionType, ConnectionStatus, SerialPort } from '../../types';
import { SerialService } from '../../services/SerialService';
import { TcpNativeService, TcpNativeConnection } from '../../services/TcpNativeService';

export class ConnectionPanel {
  private activeTab: ConnectionType = 'RTU';
  private onConnectionChange: (status: ConnectionStatus, config?: any) => void;
  private onDataReceived?: (data: string) => void;
  private serialService: SerialService;
  private tcpNativeService: TcpNativeService;
  private selectedPort: SerialPort | null = null;
  private grantedPorts: SerialPort[] = [];
  private isCompactMode: boolean = false;
  private tcpNativeStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private nativeProxyStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private currentNativeConfig: TcpNativeConnection | null = null;
  private manualDisconnect: boolean = false; // Flag to prevent auto-reconnect after manual disconnect

  constructor(
    onConnectionChange: (status: ConnectionStatus, config?: any) => void, 
    onDataReceived?: (data: string) => void
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onDataReceived = onDataReceived;
    this.serialService = new SerialService();
    this.tcpNativeService = new TcpNativeService();
    this.setupTcpNativeHandlers();
  }


  private setupTcpNativeHandlers(): void {
    // TCP Native connection status
    this.tcpNativeService.onConnectionChange((connected, error) => {
      console.log(`TCP Native connection change: connected=${connected}, error=${error}`);
      
      if (connected) {
        console.log('✅ TCP Native connected successfully');
        this.tcpNativeStatus = 'connected';
        this.onConnectionChange('connected', this.getCurrentConfig());
        this.updateButtonStates(true);
        // Only update status display, no re-rendering
        this.updateStatusDisplayOnly();
      } else {
        console.log('TCP Native disconnected', error ? `: ${error}` : '');
        
        // Don't trigger disconnect handling if manually disconnected
        if (this.manualDisconnect) {
          console.log('Manual disconnect - not triggering reconnection');
          this.tcpNativeStatus = 'disconnected';
        } else {
          this.tcpNativeStatus = error ? 'error' : 'disconnected';
        }
        
        this.onConnectionChange(error ? 'error' : 'disconnected');
        this.updateButtonStates(false);
        this.updateStatusDisplayOnly();
        this.updatePanelBackground();
      }
    });

    // Data received from TCP Native
    this.tcpNativeService.onData((data) => {
      console.log('Received from TCP Native:', data);
      if (this.onDataReceived) {
        this.onDataReceived(data);
      }
    });

    // TCP Native errors
    this.tcpNativeService.onError((error) => {
      console.error('TCP Native error:', error);
      this.updateStatusDisplayOnly();
    });

    // Native Proxy status changes
    this.tcpNativeService.onProxyStatus((connected) => {
      this.nativeProxyStatus = connected ? 'connected' : 'disconnected';
      this.updateStatusDisplayOnly();
    });
  }

  private updateStatusDisplayOnly(): void {
    // Simple status update without any re-rendering or event handling
    setTimeout(() => {
      if (this.activeTab === 'TCP_NATIVE') {
        this.updateStatusIndicators();
      }
    }, 0);
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
          <button class="tab-button ${this.activeTab === 'TCP_NATIVE' ? 'active' : ''}" data-tab="TCP_NATIVE">
            TCP Native
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          ${this.activeTab === 'RTU' ? this.renderRtuTab() : this.renderTcpNativeTab()}
        </div>

        <!-- Connection Controls -->
        <div class="flex items-center gap-3 pt-4 border-t border-dark-border">
          <button class="btn-primary flex items-center gap-2" id="connect-btn">
            <span id="connect-btn-text">Connect</span>
            <div id="connect-spinner" class="hidden animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
        
        <!-- Connection Progress Status -->
        <div id="connection-progress" class="hidden p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div class="flex items-center gap-2">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span class="text-sm text-blue-700 dark:text-blue-300" id="progress-message">
              Connecting to serial port...
            </span>
          </div>
          <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Waiting for browser permission and port access...
          </p>
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


  private renderTcpNativeTab(): string {
    return `
      <div class="space-y-4">
        <!-- Native Proxy Status -->
        <div class="p-3 rounded-md ${this.getNativeProxyStatusClass()} tcp-native-proxy-status cursor-pointer hover:bg-opacity-80 transition-colors" 
             title="${this.isNativeProxyFailed() ? '클릭하여 설치 가이드 보기' : '클릭하여 설치/설정 가이드 보기'}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full ${this.getNativeProxyIndicatorClass()} status-indicator"></div>
              <span class="text-sm font-medium status-text">
                ${this.getNativeProxyStatusText()}
              </span>
            </div>
            <div class="text-xs opacity-75">
              ${this.isNativeProxyFailed() ? '💡 설치하기' : 'ℹ️ 가이드'}
            </div>
          </div>
          <div class="text-xs text-dark-text-muted mt-1">
            <div class="flex items-center justify-between">
              <span class="${this.isCompactMode ? 'truncate' : ''}">Native Host: com.my_company.stdio_proxy</span>
            </div>
            ${this.isNativeProxyFailed() ? '<div class="text-yellow-400 animate-pulse text-center mt-1">↑ 클릭하여 설치하세요!</div>' : '<div class="text-gray-400 text-center mt-1">↑ 재설치/문제해결</div>'}
          </div>
        </div>

        <!-- TCP Native Connection Status -->
        <div class="p-3 rounded-md ${this.getTcpNativeStatusClass()} tcp-native-connection-status">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${this.getTcpNativeIndicatorClass()} status-indicator"></div>
            <span class="text-sm font-medium status-text">
              ${this.getTcpNativeStatusText()}
            </span>
          </div>
          <p class="text-xs text-dark-text-muted mt-1 status-detail">
            ${this.getTcpNativeStatusDetail()}
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
              id="tcp-native-host"
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
              id="tcp-native-port"
              placeholder="5020"
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
    // Remove existing event listeners to prevent duplicates
    this.removeEventListeners();
    
    // Tab switching
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
      button.addEventListener('click', this.handleTabClick);
    });

    // Connection buttons
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const forceCloseBtn = document.getElementById('force-close-btn');

    connectBtn?.addEventListener('click', this.handleConnectClick);
    disconnectBtn?.addEventListener('click', this.handleDisconnectClick);
    forceCloseBtn?.addEventListener('click', this.handleForceCloseClick);

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

    // Native Proxy status panel click handler (TCP_NATIVE tab only)
    if (this.activeTab === 'TCP_NATIVE') {
      const nativeProxyPanel = document.querySelector('.tcp-native-proxy-status');
      nativeProxyPanel?.addEventListener('click', () => {
        this.showNativeHostInstallGuide();
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
      container.innerHTML = tabType === 'RTU' ? this.renderRtuTab() : this.renderTcpNativeTab();
      // Reattach event listeners after content change
      this.attachEventListeners();
    }

    // Notify about connection type change for AutoCRC setting update
    const currentStatus = this.tcpNativeStatus === 'connected' ||
                          this.serialService.getConnectionStatus() ? 'connected' : 'disconnected';
    this.onConnectionChange(currentStatus as ConnectionStatus, { type: tabType });

    // Update tab button states
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');

    // Update panel background color when tab changes
    this.updatePanelBackground();

    // Auto-connect to Native Proxy when switching to TCP_NATIVE tab (only if not manually disconnected)
    if (tabType === 'TCP_NATIVE' && !this.tcpNativeService.isProxyReady() && !this.manualDisconnect) {
      console.log('TCP Native tab selected, connecting to native proxy...');
      this.nativeProxyStatus = 'connecting';
      this.updateTcpNativeStatusDisplay();
      
      this.tcpNativeService.init().then(() => {
        console.log('Native proxy connected successfully');
        this.nativeProxyStatus = 'connected';
        this.updateTcpNativeStatusDisplay();
      }).catch(error => {
        console.error('Native proxy connection failed:', error);
        this.nativeProxyStatus = 'error';
        this.updateTcpNativeStatusDisplay();
      });
    }
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
        this.updatePanelBackground();
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
    } else if (this.activeTab === 'TCP_NATIVE') {
      await this.handleTcpNativeConnect();
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
      // Connection already in progress, just update the UI to show current status
      this.showConnectionProgress('Connection already in progress...');
      console.log('Connection attempt ignored: already in progress');
      return;
    }

    // Show connection progress UI
    this.showConnectionProgress('Initializing connection...');
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

      // Update progress message for port access
      this.updateProgressMessage('Requesting port access permission...');
      
      // Add small delay to show the progress message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateProgressMessage('Opening serial port...');
      await this.serialService.connect(this.selectedPort, serialOptions);
      
      // Hide progress and show success
      this.hideConnectionProgress();
      this.onConnectionChange('connected', config);
      this.updateButtonStates(true, false);
      this.updateSelectedPortInfo();
      this.updatePanelBackground();
      
      // Start reading data
      this.startDataReading();
      
    } catch (error) {
      console.error('Connection failed:', error);
      
      // Hide progress UI
      this.hideConnectionProgress();
      
      // Immediately reset button state
      this.updateButtonStates(false, false);
      this.onConnectionChange('error');
      this.updatePanelBackground();
      
      // Reset to disconnected state after showing error briefly
      setTimeout(() => {
        this.onConnectionChange('disconnected');
        this.updateSelectedPortInfo();
        this.updatePanelBackground();
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


  private async handleTcpNativeConnect(): Promise<void> {
    // Check if already connected
    if (this.tcpNativeStatus === 'connected') {
      console.log('Already connected to TCP Native, ignoring duplicate request');
      return;
    }

    // Check if connection is in progress
    if (this.tcpNativeStatus === 'connecting') {
      console.log('TCP Native connection already in progress');
      return;
    }

    // Reset manual disconnect flag when user initiates connection
    this.manualDisconnect = false;

    this.tcpNativeStatus = 'connecting';
    // Only set proxy status to connecting if it's not already connected
    if (this.nativeProxyStatus !== 'connected') {
      this.nativeProxyStatus = 'connecting';
    }
    this.onConnectionChange('connecting');
    this.updateButtonStates(false, true);
    this.updateTcpNativeStatusDisplay();

    try {
      // Initialize and connect to native messaging host
      if (!this.tcpNativeService.isProxyReady()) {
        console.log('🔌 Connecting to native messaging host...');
        await this.tcpNativeService.init();
        // Note: nativeProxyStatus will be updated by onProxyStatus callback when proxy_started message is received
      }

      // Get TCP connection config
      const config = this.getCurrentConfig();
      const nativeConfig: TcpNativeConnection = {
        host: config.tcp.host,
        port: config.tcp.port
      };

      console.log(`🔌 Attempting to connect to TCP device at ${nativeConfig.host}:${nativeConfig.port} via native proxy`);

      // Store current config for status display
      this.currentNativeConfig = nativeConfig;
      
      // Connect to TCP device via native proxy
      await this.tcpNativeService.connect(nativeConfig);

    } catch (error) {
      console.error('TCP Native connection failed:', error);
      this.tcpNativeStatus = 'error';
      this.nativeProxyStatus = 'error';
      this.onConnectionChange('error');
      this.updateButtonStates(false, false);
      this.updateTcpNativeStatusDisplay();
      
      if (error instanceof Error) {
        alert(`TCP Native Connection failed: ${error.message}`);
      }
    }
  }

  private async handleDisconnect(): Promise<void> {
    try {
      // Set manual disconnect flag
      this.manualDisconnect = true;
      
      if (this.activeTab === 'RTU' && this.serialService.getConnectionStatus()) {
        await this.serialService.disconnect();
      } else if (this.activeTab === 'TCP_NATIVE' && this.tcpNativeStatus === 'connected') {
        this.tcpNativeService.disconnect(true); // Force manual disconnect
      }
      
      this.tcpNativeStatus = 'disconnected';
      this.currentNativeConfig = null;
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updateSelectedPortInfo();
      this.updateTcpNativeStatusDisplay();
      this.updatePanelBackground();
      
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force update UI even if disconnect fails
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updatePanelBackground();
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
      this.updatePanelBackground();
      
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
    } else if (this.activeTab === 'TCP_NATIVE') {
      const host = (document.getElementById('tcp-native-host') as HTMLInputElement)?.value || '127.0.0.1';
      const port = parseInt((document.getElementById('tcp-native-port') as HTMLInputElement)?.value || '5020');

      return {
        type: 'TCP_NATIVE',
        tcp: { host, port }
      };
    }
  }

  private showConnectionProgress(message: string): void {
    const progressDiv = document.getElementById('connection-progress');
    const progressMessage = document.getElementById('progress-message');
    const connectSpinner = document.getElementById('connect-spinner');
    const connectText = document.getElementById('connect-btn-text');
    
    if (progressDiv) {
      progressDiv.classList.remove('hidden');
    }
    if (progressMessage) {
      progressMessage.textContent = message;
    }
    if (connectSpinner) {
      connectSpinner.classList.remove('hidden');
    }
    if (connectText) {
      connectText.textContent = 'Connecting...';
    }
  }

  private updateProgressMessage(message: string): void {
    const progressMessage = document.getElementById('progress-message');
    if (progressMessage) {
      progressMessage.textContent = message;
    }
  }

  private removeEventListeners(): void {
    // Remove tab button listeners
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
      button.removeEventListener('click', this.handleTabClick);
    });

    // Remove connection button listeners
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const forceCloseBtn = document.getElementById('force-close-btn');

    connectBtn?.removeEventListener('click', this.handleConnectClick);
    disconnectBtn?.removeEventListener('click', this.handleDisconnectClick);
    forceCloseBtn?.removeEventListener('click', this.handleForceCloseClick);
  }

  private handleTabClick = (e: Event) => {
    const target = e.target as HTMLButtonElement;
    const tabType = target.dataset.tab as ConnectionType;
    this.switchTab(tabType);
  };

  private handleConnectClick = () => {
    console.log('Connect button clicked');
    this.handleConnect();
  };

  private handleDisconnectClick = () => {
    this.handleDisconnect();
  };

  private handleForceCloseClick = () => {
    this.handleForceClose();
  };

  private isNativeProxyFailed(): boolean {
    return this.nativeProxyStatus === 'error' || this.nativeProxyStatus === 'disconnected';
  }

  private showNativeHostInstallGuide(): void {
    const currentExtensionId = chrome?.runtime?.id || 'YOUR_EXTENSION_ID';
    const isConnected = !this.isNativeProxyFailed();
    const titleText = isConnected ? '🔌 TCP Native 가이드 및 문제해결' : '🔌 TCP Native 기능 설치하기';
    
    const guideHtml = `
      <div id="native-install-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto m-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-dark-text-primary">${titleText}</h3>
            <button class="modal-close text-dark-text-muted hover:text-dark-text-primary" data-modal="native-install-modal">✕</button>
          </div>
          
          ${isConnected ? `
            <!-- 연결됨 상태 -->
            <div class="bg-green-900/20 border border-green-600/30 rounded p-4 mb-4">
              <h4 class="text-sm font-medium text-green-300 mb-2">✅ Native Host가 정상적으로 연결되었습니다!</h4>
              <p class="text-sm text-green-200">
                TCP Native 기능을 사용할 수 있습니다. 아래는 추가 설정 및 문제해결 방법입니다.
              </p>
            </div>
          ` : `
            <!-- 연결 안됨 상태 -->
            <div class="bg-red-900/20 border border-red-600/30 rounded p-4 mb-4">
              <h4 class="text-sm font-medium text-red-300 mb-2">❌ Native Host 설치가 필요합니다</h4>
              <p class="text-sm text-red-200">
                TCP Native 기능을 사용하려면 아래 단계를 따라 설치해주세요.
              </p>
            </div>
          `}
          
          <div class="space-y-4">
            <!-- 왜 설치가 필요한지 설명 -->
            <div class="bg-blue-900/20 border border-blue-600/30 rounded p-4">
              <h4 class="text-sm font-medium text-blue-300 mb-2">🤔 왜 별도 설치가 필요한가요?</h4>
              <div class="text-sm text-blue-200 space-y-2">
                <p><strong>브라우저 보안 제한:</strong> Chromium 기반 브라우저는 보안상 직접 TCP 연결을 할 수 없습니다.</p>
                <p><strong>Web Serial vs TCP:</strong></p>
                <ul class="list-disc list-inside ml-4 space-y-1">
                  <li><span class="text-green-300">RTU (시리얼)</span> → 브라우저 내장 Web Serial API 사용 ✅</li>
                  <li><span class="text-yellow-300">TCP Native</span> → 외부 프로그램(Native Host) 필요 📦</li>
                </ul>
                <p><strong>Native Host 역할:</strong> 확장과 TCP 장치 사이의 브리지 역할을 합니다.</p>
                <p><strong>지원 브라우저:</strong> Chrome, Edge, Brave, Opera, Vivaldi 등 모든 Chromium 기반 브라우저</p>
              </div>
            </div>

            <!-- 설치 단계 -->
            <div class="bg-dark-panel border border-dark-border rounded p-4">
              <h4 class="text-sm font-medium text-dark-text-primary mb-3">📋 간단 설치 (Node.js 불필요)</h4>
              
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                  <div>
                    <p class="text-sm font-medium text-dark-text-primary">OS별 설치 패키지 다운로드</p>
                    <p class="text-xs text-dark-text-muted mb-2">실행파일 + 설치스크립트가 포함된 압축파일</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <button data-download-url="https://github.com/coreanq/release/releases/download/stdio-proxy-v1.0.0/stdio-proxy-macos.zip"
                              class="download-btn bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                        🍎 macOS (.zip)
                      </button>
                      <button data-download-url="https://github.com/coreanq/release/releases/download/stdio-proxy-v1.0.0/stdio-proxy-windows.zip"
                              class="download-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                        🪟 Windows (.zip)
                      </button>
                      <button data-download-url="https://github.com/coreanq/release/releases/download/stdio-proxy-v1.0.0/stdio-proxy-linux.tar.gz"
                              class="download-btn bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                        🐧 Linux (.tar.gz)
                      </button>
                    </div>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                  <div>
                    <p class="text-sm font-medium text-dark-text-primary">압축 해제 후 설치 실행</p>
                    <div class="text-sm text-dark-text-secondary mt-1 space-y-1">
                      <div><strong>macOS/Linux:</strong> 압축 해제 → <code class="bg-dark-bg px-2 py-1 rounded">./install-*.sh</code></div>
                      <div><strong>Windows:</strong> 압축 해제 → <code class="bg-dark-bg px-2 py-1 rounded">install-windows.bat</code> 더블클릭</div>
                    </div>
                    <p class="text-xs text-yellow-300 mt-1">💡 Extension ID 자동 감지, 모든 브라우저 자동 설치</p>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                  <div>
                    <p class="text-sm font-medium text-dark-text-primary">브라우저 재시작</p>
                    <p class="text-sm text-dark-text-secondary">사용 중인 브라우저를 완전히 종료 후 다시 실행하세요</p>
                    <p class="text-xs text-gray-400 mt-1">✨ Chrome, Edge, Brave, Opera, Vivaldi 등 모든 Chromium 기반 브라우저 지원</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Extension ID 정보 -->
            <div class="bg-yellow-900/20 border border-yellow-600/30 rounded p-3">
              <h4 class="text-sm font-medium text-yellow-300 mb-2">🔑 현재 Extension ID</h4>
              <div class="bg-dark-bg p-2 rounded font-mono text-sm text-dark-text-primary break-all">
                ${currentExtensionId}
              </div>
              <p class="text-xs text-yellow-200 mt-2">
                이 ID가 설치 스크립트에 자동으로 설정됩니다.
              </p>
            </div>

            <!-- 설치 후 확인 -->
            <div class="bg-green-900/20 border border-green-600/30 rounded p-3">
              <h4 class="text-sm font-medium text-green-300 mb-2">✅ 설치 완료 확인</h4>
              <p class="text-sm text-green-200">
                설치가 완료되면 위의 "Native Proxy" 상태가 "🟢 Connected"로 변경됩니다.
              </p>
            </div>

            <!-- 트러블슈팅 -->
            <div class="bg-orange-900/20 border border-orange-600/30 rounded p-3">
              <h4 class="text-sm font-medium text-orange-300 mb-2">🔧 문제 해결</h4>
              <div class="text-sm text-orange-200 space-y-1">
                <p>• 실행파일에 실행 권한이 있는지 확인 (macOS/Linux)</p>
                <p>• Windows에서 바이러스 검사기가 차단하지 않는지 확인</p>
                <p>• Extension ID가 정확히 설정되었는지 확인</p>
                <p>• 브라우저를 완전히 재시작 (Chrome, Edge, Brave 등)</p>
                <p>• 다른 Chromium 기반 브라우저에서도 테스트해보기</p>
              </div>
            </div>
          </div>

          <div class="flex justify-center mt-6">
            <button class="modal-close bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm" data-modal="native-install-modal">
              확인
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if any
    document.getElementById('native-install-modal')?.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', guideHtml);
    
    // 모달 생성 후 이벤트 리스너 연결
    this.attachModalEventListeners();
  };

  private attachModalEventListeners(): void {
    // Download buttons
    const downloadBtns = document.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const button = e.target as HTMLElement;
        const url = button.closest('button')?.getAttribute('data-download-url');
        console.log('Download button clicked, URL:', url);
        if (url) {
          try {
            // Chrome 확장에서는 chrome.tabs.create를 사용
            if (chrome && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: url });
              console.log('Chrome tabs.create called successfully');
            } else {
              // 폴백: a 태그를 통한 다운로드
              const link = document.createElement('a');
              link.href = url;
              link.download = '';
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              console.log('Fallback download link clicked');
            }
          } catch (error) {
            console.error('Failed to open download URL:', error);
            // 최종 폴백: 직접 location 변경
            try {
              window.location.href = url;
            } catch (locationError) {
              console.error('All download methods failed:', locationError);
              alert('다운로드 링크를 수동으로 열어주세요: ' + url);
            }
          }
        } else {
          console.error('No download URL found for button:', button);
        }
      });
    });

    // Modal close buttons
    const modalCloseBtns = document.querySelectorAll('.modal-close');
    modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const button = e.target as HTMLElement;
        const modalId = button.closest('button')?.getAttribute('data-modal');
        console.log('Modal close clicked, modalId:', modalId);
        if (modalId) {
          document.getElementById(modalId)?.remove();
        }
      });
    });

    // Open folder buttons
    const openFolderBtns = document.querySelectorAll('.open-folder');
    openFolderBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const button = e.target as HTMLElement;
        const path = button.closest('button')?.getAttribute('data-path');
        console.log('Open folder clicked, path:', path);
        if (path) {
          window.open(path, '_blank');
        }
      });
    });
  }

  private hideConnectionProgress(): void {
    const progressDiv = document.getElementById('connection-progress');
    const connectSpinner = document.getElementById('connect-spinner');
    const connectText = document.getElementById('connect-btn-text');
    
    if (progressDiv) {
      progressDiv.classList.add('hidden');
    }
    if (connectSpinner) {
      connectSpinner.classList.add('hidden');
    }
    if (connectText) {
      connectText.textContent = 'Connect';
    }
  }

  private updateButtonStates(connected: boolean, connecting: boolean = false): void {
    const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

    if (connectBtn && disconnectBtn) {
      // Disable connect button if connected or connecting
      connectBtn.disabled = connected || connecting;
      
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


  // Public method to get TCP Native service for TCP Native command sending
  getTcpNativeService(): TcpNativeService {
    return this.tcpNativeService;
  }













  // TCP Native status methods
  private getNativeProxyStatusClass(): string {
    switch (this.nativeProxyStatus) {
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

  private getNativeProxyIndicatorClass(): string {
    switch (this.nativeProxyStatus) {
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

  private getNativeProxyStatusText(): string {
    switch (this.nativeProxyStatus) {
      case 'connected':
        return 'Native Proxy Connected';
      case 'connecting':
        return 'Connecting to Native Proxy...';
      case 'error':
        return 'Native Proxy Connection Failed';
      default:
        return 'Native Proxy Disconnected';
    }
  }

  private getTcpNativeStatusClass(): string {
    switch (this.tcpNativeStatus) {
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

  private getTcpNativeIndicatorClass(): string {
    switch (this.tcpNativeStatus) {
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

  private getTcpNativeStatusText(): string {
    switch (this.tcpNativeStatus) {
      case 'connected':
        return 'TCP Native Connected';
      case 'connecting':
        return 'Connecting to TCP Device...';
      case 'error':
        return 'TCP Native Connection Failed';
      default:
        return 'TCP Native Disconnected';
    }
  }

  private getTcpNativeStatusDetail(): string {
    if (this.currentNativeConfig) {
      const statusPrefix = this.tcpNativeStatus === 'connected' ? 'Connected to:' :
                          this.tcpNativeStatus === 'connecting' ? 'Connecting to:' :
                          this.tcpNativeStatus === 'error' ? 'Failed to connect to:' :
                          'Last attempted:';
      return `${statusPrefix} ${this.currentNativeConfig.host}:${this.currentNativeConfig.port}`;
    }
    return 'No connection attempted';
  }

  // Get panel background color based on connection status
  getPanelBackgroundClass(): string {
    if (this.activeTab === 'TCP_NATIVE') {
      // TCP Tab: Green only when both Native Proxy and TCP Native are connected
      const isFullyConnected = this.nativeProxyStatus === 'connected' && this.tcpNativeStatus === 'connected';
      return isFullyConnected ? 'bg-green-900/10' : 'bg-red-900/10';
    } else if (this.activeTab === 'RTU') {
      // RTU Tab: Green when Serial is connected
      const isSerialConnected = this.serialService.getConnectionStatus();
      return isSerialConnected ? 'bg-green-900/10' : 'bg-red-900/10';
    }
    return 'bg-gray-900/10'; // Default background
  }

  private updateTcpNativeStatusDisplay(): void {
    if (this.activeTab === 'TCP_NATIVE') {
      // Only update status displays without full re-render to prevent event listener issues
      this.updateStatusIndicators();
    }
  }

  private updateStatusIndicators(): void {
    // Update Native Proxy status
    const nativeProxyContainer = document.querySelector('.tcp-native-proxy-status');
    if (nativeProxyContainer) {
      nativeProxyContainer.className = `p-3 rounded-md ${this.getNativeProxyStatusClass()} tcp-native-proxy-status cursor-pointer hover:bg-opacity-80 transition-colors`;
      const indicator = nativeProxyContainer.querySelector('.status-indicator');
      const text = nativeProxyContainer.querySelector('.status-text');
      if (indicator) indicator.className = `w-2 h-2 rounded-full ${this.getNativeProxyIndicatorClass()} status-indicator`;
      if (text) text.textContent = this.getNativeProxyStatusText();
    }

    // Update TCP Native status  
    const tcpNativeContainer = document.querySelector('.tcp-native-connection-status');
    if (tcpNativeContainer) {
      tcpNativeContainer.className = `p-3 rounded-md ${this.getTcpNativeStatusClass()} tcp-native-connection-status`;
      const indicator = tcpNativeContainer.querySelector('.status-indicator');
      const text = tcpNativeContainer.querySelector('.status-text');
      const detail = tcpNativeContainer.querySelector('.status-detail');
      if (indicator) indicator.className = `w-2 h-2 rounded-full ${this.getTcpNativeIndicatorClass()} status-indicator`;
      if (text) text.textContent = this.getTcpNativeStatusText();
      if (detail) detail.textContent = this.getTcpNativeStatusDetail();
    }

    // Update panel background color
    this.updatePanelBackground();
  }

  private updatePanelBackground(): void {
    // Trigger panel background update in App
    const event = new CustomEvent('panelBackgroundChange');
    document.dispatchEvent(event);
  }


  // Cleanup method to remove event handlers
  public cleanup(): void {
    // Cleanup TCP Native service
    if (this.tcpNativeService.isProxyReady() || this.tcpNativeService.isTcpConnected()) {
      this.tcpNativeService.cleanup();
    }
  }
}