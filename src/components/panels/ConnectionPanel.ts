import { ConnectionType, ConnectionStatus, SerialPort } from '../../types';
import { SerialService } from '../../services/SerialService';

export class ConnectionPanel {
  private activeTab: ConnectionType = 'RTU';
  private onConnectionChange: (status: ConnectionStatus, config?: any) => void;
  private onDataReceived?: (data: string) => void;
  private serialService: SerialService;
  private selectedPort: SerialPort | null = null;
  private grantedPorts: SerialPort[] = [];
  private isCompactMode: boolean = false;

  constructor(
    onConnectionChange: (status: ConnectionStatus, config?: any) => void, 
    onDataReceived?: (data: string) => void
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onDataReceived = onDataReceived;
    this.serialService = new SerialService();
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
          <button class="btn-secondary" id="test-btn">
            Test Connection
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
                        ? `USB Device (VID: ${info.usbVendorId.toString(16)}, PID: ${info.usbProductId.toString(16)})`
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

          ${this.isCompactMode ? `
            <!-- Compact Layout: Baud Rate and Parity in 2 columns -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-dark-text-secondary mb-1">
                  Baud Rate
                </label>
                <select class="input-field w-full text-sm" id="baud-rate">
                  <option value="1200">1200</option>
                  <option value="2400">2400</option>
                  <option value="4800">4800</option>
                  <option value="9600" selected>9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-dark-text-secondary mb-1">
                  Parity
                </label>
                <select class="input-field w-full text-sm" id="parity">
                  <option value="none" selected>None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </div>
            </div>
          ` : `
            <div>
              <label class="block text-sm font-medium text-dark-text-secondary mb-2">
                Baud Rate
              </label>
              <select class="input-field w-full" id="baud-rate">
                <option value="1200">1200</option>
                <option value="2400">2400</option>
                <option value="4800">4800</option>
                <option value="9600" selected>9600</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="57600">57600</option>
                <option value="115200">115200</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-dark-text-secondary mb-2">
                Parity
              </label>
              <select class="input-field w-full" id="parity">
                <option value="none" selected>None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
              </select>
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderTcpTab(): string {
    return `
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
            value="502"
            min="1"
            max="65535"
          />
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
    const testBtn = document.getElementById('test-btn');
    const forceCloseBtn = document.getElementById('force-close-btn');

    connectBtn?.addEventListener('click', () => this.handleConnect());
    disconnectBtn?.addEventListener('click', () => this.handleDisconnect());
    testBtn?.addEventListener('click', () => this.handleTest());
    forceCloseBtn?.addEventListener('click', () => this.handleForceClose());

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
    this.activeTab = tabType;
    const container = document.querySelector('.tab-content');
    if (container) {
      container.innerHTML = tabType === 'RTU' ? this.renderRtuTab() : this.renderTcpTab();
      // Reattach event listeners after content change
      this.attachEventListeners();
    }

    // Update tab button states
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');
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
      return `USB Device (VID: ${info.usbVendorId.toString(16)}, PID: ${info.usbProductId.toString(16)})`;
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
    this.onConnectionChange('connecting');
    
    // TCP connection simulation (WebSocket implementation would go here)
    setTimeout(() => {
      this.onConnectionChange('connected', this.getCurrentConfig());
      this.updateButtonStates(true);
    }, 1500);
  }

  private async handleDisconnect(): Promise<void> {
    try {
      if (this.activeTab === 'RTU' && this.serialService.getConnectionStatus()) {
        await this.serialService.disconnect();
      }
      
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
      this.updateSelectedPortInfo();
      
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force update UI even if disconnect fails
      this.onConnectionChange('disconnected');
      this.updateButtonStates(false, false);
    }
  }

  private async handleTest(): Promise<void> {
    if (this.activeTab === 'RTU') {
      await this.handleRtuTest();
    } else {
      await this.handleTcpTest();
    }
  }

  private async handleRtuTest(): Promise<void> {
    if (!SerialService.isSupported()) {
      alert('Web Serial API is not supported in this browser');
      return;
    }

    if (!this.selectedPort) {
      alert('Please select a serial port first');
      return;
    }

    this.onConnectionChange('connecting');

    try {
      const config = this.getCurrentConfig();
      const serialOptions = {
        baudRate: config.serial.baudRate,
        dataBits: config.serial.dataBits,
        stopBits: config.serial.stopBits,
        parity: config.serial.parity
      };

      // Test connection
      await this.serialService.connect(this.selectedPort, serialOptions);
      await this.serialService.disconnect();
      
      this.onConnectionChange('disconnected');
      alert('✅ Serial port test successful! The port is accessible and can be opened.');
      
    } catch (error) {
      this.onConnectionChange('error');
      setTimeout(() => this.onConnectionChange('disconnected'), 2000);
      
      if (error instanceof Error) {
        alert(`❌ Serial port test failed: ${error.message}`);
      }
    }
  }

  private async handleTcpTest(): Promise<void> {
    this.onConnectionChange('connecting');
    
    // TCP test simulation
    setTimeout(() => {
      this.onConnectionChange('disconnected');
      alert('TCP connection test completed. Check the log for details.');
    }, 2000);
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
      const baudRate = parseInt((document.getElementById('baud-rate') as HTMLSelectElement)?.value || '9600');
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
      const port = parseInt((document.getElementById('tcp-port') as HTMLInputElement)?.value || '502');

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
}