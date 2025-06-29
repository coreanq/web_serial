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


  private renderTcpNativeTab(): string {
    return `
      <div class="space-y-4">
        <!-- Native Proxy Status -->
        <div class="p-3 rounded-md ${this.getNativeProxyStatusClass()} tcp-native-proxy-status">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${this.getNativeProxyIndicatorClass()} status-indicator"></div>
            <span class="text-sm font-medium status-text">
              ${this.getNativeProxyStatusText()}
            </span>
          </div>
          <p class="text-xs text-dark-text-muted mt-1">
            Native Host: com.my_company.stdio_proxy
          </p>
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
        this.showNativeProxyGuide(error.message);
      });
    }
  }


  // Show native proxy setup guide
  private showNativeProxyGuide(errorMessage: string): void {
    const guideHtml = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="native-guide-modal">
        <div class="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-dark-text-primary">🔌 Native Proxy 설치 필요</h3>
            <button class="text-dark-text-muted hover:text-dark-text-primary text-xl" onclick="document.getElementById('native-guide-modal').remove()">
              ✕
            </button>
          </div>
          
          <div class="mb-4">
            <div class="bg-red-900/20 border border-red-600/30 rounded p-3 mb-3">
              <p class="text-sm text-red-300 mb-1">⚠️ ${errorMessage}</p>
            </div>
            <p class="text-sm text-dark-text-secondary">TCP Native 연결을 위해서는 Chrome Native Messaging Host 설치가 필요합니다.</p>
            <p class="text-xs text-dark-text-muted mt-1">Native Messaging을 통해 직접 TCP 소켓 연결이 가능합니다.</p>
          </div>
          
          <div class="space-y-3">
            <div class="bg-dark-panel rounded p-3">
              <h4 class="text-sm font-medium text-dark-text-primary mb-2">🛠️ 설치 방법</h4>
              <div class="space-y-2">
                <div class="border border-dark-border rounded p-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-green-400">1단계: Extension ID 확인</span>
                  </div>
                  <p class="text-xs text-dark-text-muted mb-2">Chrome에서 확장 프로그램 ID를 확인하세요</p>
                  <div class="bg-dark-surface rounded p-2 text-xs font-mono">
                    <div>chrome://extensions</div>
                    <div>개발자 모드 활성화 → ID 복사</div>
                  </div>
                </div>
                
                <div class="border border-dark-border rounded p-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-blue-400">2단계: Native Host 설치</span>
                  </div>
                  <p class="text-xs text-dark-text-muted mb-2">stdio-proxy 설치 스크립트 실행</p>
                  <div class="bg-dark-surface rounded p-2 text-xs font-mono">
                    <div>cd stdio-proxy</div>
                    <div># install.sh의 EXTENSION_ID 수정</div>
                    <div>chmod +x install.sh</div>
                    <div>./install.sh</div>
                  </div>
                </div>
                
                <div class="border border-dark-border rounded p-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-purple-400">3단계: 확장 프로그램 재로드</span>
                  </div>
                  <p class="text-xs text-dark-text-muted mb-2">Chrome에서 확장 프로그램을 다시 로드하세요</p>
                </div>
              </div>
            </div>
            
            <div class="bg-dark-panel rounded p-3">
              <h4 class="text-sm font-medium text-dark-text-primary mb-2">📋 확인 사항</h4>
              <div class="space-y-1 text-xs text-dark-text-muted">
                <div>✅ Node.js 설치됨</div>
                <div>✅ Extension ID가 install.sh에 정확히 설정됨</div>
                <div>✅ install.sh 실행 완료</div>
                <div>✅ 확장 프로그램 재로드</div>
                <div>✅ TCP Native 탭 다시 클릭</div>
              </div>
            </div>
            
            <div class="bg-orange-900/20 border border-orange-600/30 rounded p-3">
              <h4 class="text-sm font-medium text-orange-300 mb-2">🔍 문제 해결</h4>
              <p class="text-xs text-orange-200 mb-2">설치 후에도 연결되지 않는다면:</p>
              <div class="space-y-1 text-xs text-orange-200">
                <div>• /tmp/native-host-log.txt 로그 확인</div>
                <div>• Extension ID 재확인</div>
                <div>• Chrome 재시작</div>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2 mt-4">
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm flex-1" onclick="window.open('stdio-proxy/', '_blank')">
              📁 stdio-proxy 폴더
            </button>
            <button class="btn-secondary text-sm px-3 py-2 flex-1" onclick="document.getElementById('native-guide-modal').remove()">
              닫기
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if any
    document.getElementById('native-guide-modal')?.remove();
    
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
      
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force update UI even if disconnect fails
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
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
    } else if (this.activeTab === 'TCP_NATIVE') {
      const host = (document.getElementById('tcp-native-host') as HTMLInputElement)?.value || '127.0.0.1';
      const port = parseInt((document.getElementById('tcp-native-port') as HTMLInputElement)?.value || '5020');

      return {
        type: 'TCP_NATIVE',
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
      nativeProxyContainer.className = `p-3 rounded-md ${this.getNativeProxyStatusClass()} tcp-native-proxy-status`;
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
  }

  // Cleanup method to remove event handlers
  public cleanup(): void {
    // Cleanup TCP Native service
    if (this.tcpNativeService.isProxyReady() || this.tcpNativeService.isTcpConnected()) {
      this.tcpNativeService.cleanup();
    }
  }
}