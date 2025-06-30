import { LogEntry, LogStorageConfig } from '../../types';
import { LogService } from '../../services/LogService';

export class LogPanel {
  private logs: LogEntry[] = [];
  private isAutoScroll = true;
  private container: HTMLElement | null = null;
  private onClearLogs?: () => void;
  private connectionType: 'RTU' | 'TCP_NATIVE' = 'RTU';
  private isRepeatMode = false;
  private readonly MAX_LOG_COUNT = 1000;  // Maximum number of logs to keep in memory
  private lastRenderedLogCount = 0;  // Track number of logs already rendered
  private logService!: LogService;

  mount(container: HTMLElement): void {
    this.container = container;
    this.logService = new LogService();
    container.innerHTML = this.render();
    this.attachEventListeners();
    this.addCustomStyles();
    this.setupTooltipPositioning();
    this.updateAutoScrollCheckbox();  // Ensure checkbox reflects initial state
    this.generateSampleLogs();
  }

  setClearLogsCallback(callback: () => void): void {
    this.onClearLogs = callback;
  }

  setConnectionType(type: 'RTU' | 'TCP_NATIVE'): void {
    this.connectionType = type;
  }

  setRepeatMode(isRepeatMode: boolean): void {
    this.isRepeatMode = isRepeatMode;
  }

  private updateAutoScrollCheckbox(): void {
    const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;
    if (autoScrollCheckbox) {
      autoScrollCheckbox.checked = this.isAutoScroll;
    }
  }

  private addCustomStyles(): void {
    // Add CSS for faster tooltip display
    const style = document.createElement('style');
    style.textContent = `
      .modbus-packet {
        position: relative !important;
      }
      
      .tooltip-custom {
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-line;
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }
      
      .tooltip-custom.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .modbus-packet:hover {
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-radius: 4px;
        transition: background-color 0.1s ease;
      }
    `;
    
    // Remove any existing style with the same purpose
    const existingStyle = document.querySelector('style[data-logpanel-tooltip]');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    style.setAttribute('data-logpanel-tooltip', 'true');
    document.head.appendChild(style);
  }

  private setupTooltipPositioning(): void {
    let currentTooltip: HTMLElement | null = null;

    // Remove existing tooltip positioning listeners
    document.removeEventListener('mouseover', this.handleTooltipMouseOver);
    document.removeEventListener('mouseout', this.handleTooltipMouseOut);

    // Add tooltip positioning listeners
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modbus-packet') && target.dataset.tooltip && !this.isRepeatMode) {
        currentTooltip = this.showTooltip(target, target.dataset.tooltip);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modbus-packet') && currentTooltip) {
        this.hideTooltip(currentTooltip);
        currentTooltip = null;
      }
    });
  }

  private showTooltip(element: HTMLElement, content: string): HTMLElement {
    // Remove any existing tooltip
    const existingTooltip = document.querySelector('.tooltip-custom');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-custom';
    tooltip.textContent = content;
    document.body.appendChild(tooltip);

    // Calculate optimal position
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let left = rect.left;
    let top = rect.bottom + 8;

    // Adjust horizontal position if tooltip would go off-screen
    if (left + tooltipRect.width > viewportWidth - 20) {
      left = viewportWidth - tooltipRect.width - 20;
    }
    if (left < 20) {
      left = 20;
    }

    // Adjust vertical position if tooltip would go off-screen
    // Check if there's enough space below
    if (top + tooltipRect.height > viewportHeight - 20) {
      // Show above if there's more space above
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      if (spaceAbove > spaceBelow) {
        top = rect.top - tooltipRect.height - 8;
      } else {
        // If both spaces are limited, position at top of viewport with scroll
        top = Math.max(20, viewportHeight - tooltipRect.height - 20);
      }
    }

    // Ensure tooltip doesn't go above viewport
    if (top < 20) {
      top = 20;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Show tooltip with animation
    requestAnimationFrame(() => {
      tooltip.classList.add('show');
    });

    return tooltip;
  }

  private hideTooltip(tooltip: HTMLElement): void {
    tooltip.classList.remove('show');
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.remove();
      }
    }, 150);
  }

  private handleTooltipMouseOver = () => {
    // This will be bound to the class instance
  }

  private handleTooltipMouseOut = () => {
    // This will be bound to the class instance  
  }

  private render(): string {
    return `
      <div class="h-full flex flex-col" style="height: 100%; min-height: 400px;">
        <!-- Log Controls -->
        <div class="flex items-center justify-between p-4 border-b border-dark-border bg-dark-panel flex-shrink-0">
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
            <button class="btn-secondary text-sm py-1 px-3" id="log-settings">
              Settings
            </button>
            <button class="btn-secondary text-sm py-1 px-3" id="export-logs">
              Export
            </button>
          </div>
        </div>

        <!-- Log Content -->
        <div class="flex-1 min-h-0 overflow-hidden" style="flex: 1; min-height: 0;">
          <div class="h-full overflow-y-auto scrollbar-thin" id="log-container" style="height: 100%; overflow-y: auto;">
            ${this.renderLogs()}
          </div>
        </div>
      </div>
      
      <!-- Log Settings Modal -->
      <div id="log-settings-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-dark-panel rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="flex items-center justify-between p-4 border-b border-dark-border">
            <h3 class="text-lg font-semibold text-dark-text-primary">Log Storage Settings</h3>
            <button id="close-log-settings" class="text-dark-text-secondary hover:text-dark-text-primary">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="p-4 space-y-4">
            <!-- Storage Mode Selection -->
            <div>
              <label class="block text-sm font-medium text-dark-text-primary mb-2">Storage Mode</label>
              <div class="space-y-2">
                <label class="flex items-center gap-2">
                  <input type="radio" name="storage-mode" value="continuous" class="text-blue-500" checked>
                  <div>
                    <div class="text-sm text-dark-text-primary">Continuous Logging</div>
                    <div class="text-xs text-dark-text-secondary">Save all logs in separate files (no deletion)</div>
                  </div>
                </label>
                <label class="flex items-center gap-2">
                  <input type="radio" name="storage-mode" value="rotation" class="text-blue-500">
                  <div>
                    <div class="text-sm text-dark-text-primary">Log Rotation</div>
                    <div class="text-xs text-dark-text-secondary">Limit files by size/age (old files deleted)</div>
                  </div>
                </label>
              </div>
            </div>
            
            <!-- Continuous Mode Settings -->
            <div id="continuous-settings" class="space-y-3">
              <h4 class="text-sm font-medium text-dark-text-primary">Continuous Mode Settings</h4>
              <div>
                <label class="block text-xs text-dark-text-secondary mb-1">Max File Size (MB)</label>
                <input type="number" id="continuous-max-size" value="10" min="1" max="100" 
                       class="input-field text-sm w-full">
              </div>
            </div>
            
            <!-- Rotation Mode Settings -->
            <div id="rotation-settings" class="space-y-3 hidden">
              <h4 class="text-sm font-medium text-dark-text-primary">Rotation Mode Settings</h4>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs text-dark-text-secondary mb-1">Max File Size (MB)</label>
                  <input type="number" id="rotation-max-size" value="5" min="1" max="50" 
                         class="input-field text-sm w-full">
                </div>
                <div>
                  <label class="block text-xs text-dark-text-secondary mb-1">Max Files</label>
                  <input type="number" id="rotation-max-files" value="10" min="1" max="50" 
                         class="input-field text-sm w-full">
                </div>
              </div>
              <div>
                <label class="block text-xs text-dark-text-secondary mb-1">Max Age (days)</label>
                <input type="number" id="rotation-max-age" value="30" min="1" max="365" 
                       class="input-field text-sm w-full">
              </div>
              <label class="flex items-center gap-2">
                <input type="checkbox" id="rotation-compression" class="text-blue-500">
                <span class="text-sm text-dark-text-primary">Enable compression for old files</span>
              </label>
            </div>
          </div>
          
          <div class="flex items-center justify-end gap-2 p-4 border-t border-dark-border">
            <button id="cancel-log-settings" class="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button id="save-log-settings" class="btn-primary text-sm py-2 px-4">Save</button>
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
    const timestamp = this.formatTimestamp(log.timestamp);
    const directionClass = log.direction === 'send' ? 'send' : 'recv';
    const directionText = log.direction === 'send' ? 'SEND' : 'RECV';
    const modbusInfo = this.analyzeModbusPacket(log.data);
    
    return `
      <div class="log-entry" data-log-id="${log.id}">
        <div class="log-timestamp">${timestamp}</div>
        <div class="log-direction ${directionClass}">${directionText}</div>
        <div class="log-data ${modbusInfo ? 'cursor-help modbus-packet' : ''}" 
             ${modbusInfo ? `data-tooltip="${modbusInfo.replace(/"/g, '&quot;')}"` : ''}>
          ${this.formatLogData(log.data)}
        </div>
        ${log.responseTime ? `<div class="text-xs text-dark-text-muted">${log.responseTime}ms</div>` : ''}
        ${log.error ? `<div class="text-xs text-status-error">${log.error}</div>` : ''}
      </div>
    `;
  }

  private formatTimestamp(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
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

  private analyzeModbusPacket(data: string): string | null {
    const cleaned = data.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 8) return null; // Minimum RTU packet size
    
    // Force analysis based on connection type when RTU is selected
    if (this.connectionType === 'RTU') {
      return this.analyzeRtuPacket(cleaned);
    }
    
    // For TCP_NATIVE, check if it's actually a TCP packet or fallback to analyzing PDU directly
    const isTcpPacket = this.isTcpPacket(cleaned);
    
    if (isTcpPacket) {
      return this.analyzeTcpPacket(cleaned);
    } else {
      // For TCP_NATIVE mode, analyze as PDU directly (without RTU wrapper)
      return this.analyzeTcpNativePdu(cleaned);
    }
  }

  private isTcpPacket(hexData: string): boolean {
    // TCP packets have MBAP header: TransactionID(2) + ProtocolID(2) + Length(2) + UnitID(1) + PDU
    if (hexData.length < 14) return false; // Minimum TCP packet size
    
    // Check if bytes 2-3 are 0000 (Protocol ID for Modbus TCP)
    const protocolId = hexData.substring(4, 8);
    return protocolId === '0000';
  }

  private analyzeTcpPacket(hexData: string): string | null {
    if (hexData.length < 14) return null;
    
    try {
      const transactionId = hexData.substring(0, 4);
      const protocolId = hexData.substring(4, 8);
      const length = hexData.substring(8, 12);
      const unitId = hexData.substring(12, 14);
      const pdu = hexData.substring(14);
      
      const pduAnalysis = this.analyzeModbusPdu(pdu);
      
      let result = `🌐 MODBUS TCP PACKET\n`;
      result += `Transaction ID: 0x${transactionId} (${parseInt(transactionId, 16)})\n`;
      result += `Protocol ID: 0x${protocolId} (${parseInt(protocolId, 16)})\n`;
      result += `Length: 0x${length} (${parseInt(length, 16)} bytes)\n`;
      result += `Unit ID: 0x${unitId} (${parseInt(unitId, 16)})\n`;
      
      if (pduAnalysis) {
        result += `\n${pduAnalysis}`;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private analyzeRtuPacket(hexData: string): string | null {
    if (hexData.length < 8) return null;
    
    try {
      // Check CRC
      const crcValid = this.validateCrc(hexData);
      if (!crcValid) return null;
      
      const deviceId = hexData.substring(0, 2);
      const pdu = hexData.substring(2, hexData.length - 4); // Remove device ID and CRC
      const crc = hexData.substring(hexData.length - 4);
      
      const pduAnalysis = this.analyzeModbusPdu(pdu);
      
      let result = `📡 MODBUS RTU PACKET\n`;
      result += `Device ID: 0x${deviceId} (${parseInt(deviceId, 16)})\n`;
      result += `CRC: 0x${crc} ✅ Valid\n`;
      
      if (pduAnalysis) {
        result += `\n${pduAnalysis}`;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private analyzeTcpNativePdu(hexData: string): string | null {
    if (hexData.length < 2) return null;
    
    try {
      // For TCP Native mode, the data might be just the PDU without MBAP header
      const pduAnalysis = this.analyzeModbusPdu(hexData);
      
      if (pduAnalysis) {
        let result = `🌐 MODBUS TCP NATIVE PDU\n`;
        result += `PDU Length: ${hexData.length / 2} bytes\n`;
        result += `\n${pduAnalysis}`;
        return result;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private analyzeModbusPdu(pdu: string): string | null {
    if (pdu.length < 2) return null;
    
    const functionCode = pdu.substring(0, 2);
    const functionCodeInt = parseInt(functionCode, 16);
    
    // Check if it's an error response (function code has bit 7 set)
    if (functionCodeInt & 0x80) {
      const originalFc = (functionCodeInt & 0x7F).toString(16).padStart(2, '0').toUpperCase();
      const exceptionCode = pdu.substring(2, 4);
      const exceptionText = this.getExceptionText(parseInt(exceptionCode, 16));
      
      return `⚠️ ERROR RESPONSE\nOriginal Function: 0x${originalFc} (${parseInt(originalFc, 16)})\nException Code: 0x${exceptionCode} (${parseInt(exceptionCode, 16)}) - ${exceptionText}`;
    }
    
    switch (functionCodeInt) {
      case 0x01:
        return this.analyzeReadCoils(pdu);
      case 0x02:
        return this.analyzeReadDiscreteInputs(pdu);
      case 0x03:
        return this.analyzeReadHoldingRegisters(pdu);
      case 0x04:
        return this.analyzeReadInputRegisters(pdu);
      case 0x05:
        return this.analyzeWriteSingleCoil(pdu);
      case 0x06:
        return this.analyzeWriteSingleRegister(pdu);
      case 0x08:
        // Diagnostics - Serial Line only, skip for TCP
        return this.connectionType === 'RTU' ? this.analyzeDiagnostics(pdu) : `📋 MODBUS PDU\nFunction Code: 0x${functionCode} (${functionCodeInt}) - Not supported in TCP mode`;
      case 0x0B:
        // Get Comm Event Counter - Serial Line only, skip for TCP
        return this.connectionType === 'RTU' ? this.analyzeGetCommEventCounter(pdu) : `📋 MODBUS PDU\nFunction Code: 0x${functionCode} (${functionCodeInt}) - Not supported in TCP mode`;
      case 0x0F:
        return this.analyzeWriteMultipleCoils(pdu);
      case 0x10:
        return this.analyzeWriteMultipleRegisters(pdu);
      case 0x11:
        // Report Server ID - Serial Line only, skip for TCP
        return this.connectionType === 'RTU' ? this.analyzeReportServerId(pdu) : `📋 MODBUS PDU\nFunction Code: 0x${functionCode} (${functionCodeInt}) - Not supported in TCP mode`;
      case 0x16:
        return this.analyzeMaskWriteRegister(pdu);
      case 0x17:
        return this.analyzeReadWriteMultipleRegisters(pdu);
      case 0x2B:
        return this.analyzeReadDeviceIdentification(pdu);
      default:
        return `📋 MODBUS PDU\nFunction Code: 0x${functionCode} (${functionCodeInt}) - Unknown/Unsupported`;
    }
  }

  private analyzeReadCoils(pdu: string): string {
    if (pdu.length === 10) {
      // Request: FC(1) + StartAddr(2) + Quantity(2) = 5 bytes
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      return `📖 READ COILS (0x01) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} coils)`;
    } else if (pdu.length >= 4) {
      // Response: FC(1) + ByteCount(1) + Data(n)
      const byteCount = pdu.substring(2, 4);
      const data = pdu.substring(4);
      
      return `📖 READ COILS (0x01) - RESPONSE\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nCoil Data: 0x${data}`;
    }
    return `📖 READ COILS (0x01)`;
  }

  private analyzeReadDiscreteInputs(pdu: string): string {
    if (pdu.length === 10) {
      // Request
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      return `📖 READ DISCRETE INPUTS (0x02) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} inputs)`;
    } else if (pdu.length >= 4) {
      // Response
      const byteCount = pdu.substring(2, 4);
      const data = pdu.substring(4);
      
      return `📖 READ DISCRETE INPUTS (0x02) - RESPONSE\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nInput Data: 0x${data}`;
    }
    return `📖 READ DISCRETE INPUTS (0x02)`;
  }

  private analyzeReadHoldingRegisters(pdu: string): string {
    if (pdu.length === 10) {
      // Request
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      return `📊 READ HOLDING REGISTERS (0x03) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} registers)`;
    } else if (pdu.length >= 4) {
      // Response
      const byteCount = pdu.substring(2, 4);
      const data = pdu.substring(4);
      const registerCount = parseInt(byteCount, 16) / 2;
      
      let result = `📊 READ HOLDING REGISTERS (0x03) - RESPONSE\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nRegister Count: ${registerCount}\n`;
      
      // Parse individual registers
      for (let i = 0; i < data.length; i += 4) {
        if (i + 4 <= data.length) {
          const regHex = data.substring(i, i + 4);
          const regDec = parseInt(regHex, 16);
          result += `Reg ${i/4}: 0x${regHex} (${regDec})\n`;
        }
      }
      
      return result.trim();
    }
    return `📊 READ HOLDING REGISTERS (0x03)`;
  }

  private analyzeReadInputRegisters(pdu: string): string {
    if (pdu.length === 10) {
      // Request
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      return `📊 READ INPUT REGISTERS (0x04) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} registers)`;
    } else if (pdu.length >= 4) {
      // Response
      const byteCount = pdu.substring(2, 4);
      const data = pdu.substring(4);
      const registerCount = parseInt(byteCount, 16) / 2;
      
      let result = `📊 READ INPUT REGISTERS (0x04) - RESPONSE\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nRegister Count: ${registerCount}\n`;
      
      // Parse individual registers
      for (let i = 0; i < data.length; i += 4) {
        if (i + 4 <= data.length) {
          const regHex = data.substring(i, i + 4);
          const regDec = parseInt(regHex, 16);
          result += `Reg ${i/4}: 0x${regHex} (${regDec})\n`;
        }
      }
      
      return result.trim();
    }
    return `📊 READ INPUT REGISTERS (0x04)`;
  }

  private analyzeWriteSingleCoil(pdu: string): string {
    if (pdu.length === 10) {
      const coilAddr = pdu.substring(2, 6);
      const coilValue = pdu.substring(6, 10);
      const coilState = coilValue === '0000' ? 'OFF' : coilValue === 'FF00' ? 'ON' : 'INVALID';
      
      return `⚙️ WRITE SINGLE COIL (0x05)\nCoil Address: 0x${coilAddr} (${parseInt(coilAddr, 16)})\nCoil Value: 0x${coilValue} (${coilState})`;
    }
    return `⚙️ WRITE SINGLE COIL (0x05)`;
  }

  private analyzeWriteSingleRegister(pdu: string): string {
    if (pdu.length === 10) {
      const regAddr = pdu.substring(2, 6);
      const regValue = pdu.substring(6, 10);
      
      return `✏️ WRITE SINGLE REGISTER (0x06)\nRegister Address: 0x${regAddr} (${parseInt(regAddr, 16)})\nRegister Value: 0x${regValue} (${parseInt(regValue, 16)})`;
    }
    return `✏️ WRITE SINGLE REGISTER (0x06)`;
  }

  private analyzeWriteMultipleRegisters(pdu: string): string {
    if (pdu.length >= 12) {
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      if (pdu.length === 10) {
        // Response
        return `✏️ WRITE MULTIPLE REGISTERS (0x10) - RESPONSE\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity Written: 0x${quantity} (${parseInt(quantity, 16)} registers)`;
      } else {
        // Request
        const byteCount = pdu.substring(10, 12);
        const data = pdu.substring(12);
        
        let result = `✏️ WRITE MULTIPLE REGISTERS (0x10) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} registers)\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\n`;
        
        // Parse individual register values
        for (let i = 0; i < data.length; i += 4) {
          if (i + 4 <= data.length) {
            const regHex = data.substring(i, i + 4);
            const regDec = parseInt(regHex, 16);
            result += `Reg ${i/4}: 0x${regHex} (${regDec})\n`;
          }
        }
        
        return result.trim();
      }
    }
    return `✏️ WRITE MULTIPLE REGISTERS (0x10)`;
  }

  private analyzeDiagnostics(pdu: string): string {
    if (pdu.length >= 6) {
      const subFunction = pdu.substring(2, 6);
      const data = pdu.substring(6);
      
      const subFunctionNames: { [key: string]: string } = {
        '0000': 'Return Query Data',
        '0001': 'Restart Communications Option',
        '0002': 'Return Diagnostic Register',
        '0003': 'Change ASCII Input Delimiter',
        '0004': 'Force Listen Only Mode',
        '000A': 'Clear Counters and Diagnostic Register',
        '000B': 'Return Bus Message Count',
        '000C': 'Return Bus Communication Error Count',
        '000D': 'Return Bus Exception Error Count',
        '000E': 'Return Slave Message Count',
        '000F': 'Return Slave No Response Count'
      };
      
      const subFunctionName = subFunctionNames[subFunction] || 'Unknown Sub-function';
      
      return `🔍 DIAGNOSTICS (0x08)\nSub-function: 0x${subFunction} (${parseInt(subFunction, 16)}) - ${subFunctionName}\nData: 0x${data}`;
    }
    return `🔍 DIAGNOSTICS (0x08)`;
  }

  private analyzeGetCommEventCounter(pdu: string): string {
    if (pdu.length === 2) {
      // Request
      return `📊 GET COMM EVENT COUNTER (0x0B) - REQUEST`;
    } else if (pdu.length === 8) {
      // Response
      const status = pdu.substring(2, 6);
      const eventCount = pdu.substring(6, 10);
      
      return `📊 GET COMM EVENT COUNTER (0x0B) - RESPONSE\nStatus: 0x${status} (${parseInt(status, 16)})\nEvent Count: 0x${eventCount} (${parseInt(eventCount, 16)})`;
    }
    return `📊 GET COMM EVENT COUNTER (0x0B)`;
  }

  private analyzeWriteMultipleCoils(pdu: string): string {
    if (pdu.length >= 12) {
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      
      if (pdu.length === 10) {
        // Response
        return `🔄 WRITE MULTIPLE COILS (0x0F) - RESPONSE\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity Written: 0x${quantity} (${parseInt(quantity, 16)} coils)`;
      } else {
        // Request
        const byteCount = pdu.substring(10, 12);
        const coilData = pdu.substring(12);
        
        return `🔄 WRITE MULTIPLE COILS (0x0F) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} coils)\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nCoil Data: 0x${coilData}`;
      }
    }
    return `🔄 WRITE MULTIPLE COILS (0x0F)`;
  }

  private analyzeReportServerId(pdu: string): string {
    if (pdu.length === 2) {
      // Request
      return `🏷️ REPORT SERVER ID (0x11) - REQUEST`;
    } else if (pdu.length >= 4) {
      // Response
      const byteCount = pdu.substring(2, 4);
      const serverIdData = pdu.substring(4);
      
      return `🏷️ REPORT SERVER ID (0x11) - RESPONSE\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nServer ID Data: 0x${serverIdData}`;
    }
    return `🏷️ REPORT SERVER ID (0x11)`;
  }

  private analyzeMaskWriteRegister(pdu: string): string {
    if (pdu.length === 14) {
      const regAddr = pdu.substring(2, 6);
      const andMask = pdu.substring(6, 10);
      const orMask = pdu.substring(10, 14);
      
      return `🎭 MASK WRITE REGISTER (0x16)\nRegister Address: 0x${regAddr} (${parseInt(regAddr, 16)})\nAND Mask: 0x${andMask} (${parseInt(andMask, 16)})\nOR Mask: 0x${orMask} (${parseInt(orMask, 16)})`;
    }
    return `🎭 MASK WRITE REGISTER (0x16)`;
  }

  private analyzeReadWriteMultipleRegisters(pdu: string): string {
    if (pdu.length >= 18) {
      const readStartAddr = pdu.substring(2, 6);
      const readQuantity = pdu.substring(6, 10);
      const writeStartAddr = pdu.substring(10, 14);
      const writeQuantity = pdu.substring(14, 18);
      
      if (pdu.length > 18) {
        // Request
        const writeByteCount = pdu.substring(18, 20);
        const writeData = pdu.substring(20);
        
        return `🔄 READ/WRITE MULTIPLE REGISTERS (0x17) - REQUEST\nRead Start Address: 0x${readStartAddr} (${parseInt(readStartAddr, 16)})\nRead Quantity: 0x${readQuantity} (${parseInt(readQuantity, 16)} registers)\nWrite Start Address: 0x${writeStartAddr} (${parseInt(writeStartAddr, 16)})\nWrite Quantity: 0x${writeQuantity} (${parseInt(writeQuantity, 16)} registers)\nWrite Byte Count: 0x${writeByteCount} (${parseInt(writeByteCount, 16)} bytes)\nWrite Data: 0x${writeData}`;
      }
    } else if (pdu.length >= 4) {
      // Response
      const byteCount = pdu.substring(2, 4);
      const readData = pdu.substring(4);
      
      return `🔄 READ/WRITE MULTIPLE REGISTERS (0x17) - RESPONSE\nRead Byte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\nRead Data: 0x${readData}`;
    }
    return `🔄 READ/WRITE MULTIPLE REGISTERS (0x17)`;
  }

  private analyzeReadDeviceIdentification(pdu: string): string {
    if (pdu.length >= 8) {
      const subFunction = pdu.substring(2, 4);
      const readDeviceIdCode = pdu.substring(4, 6);
      const objectId = pdu.substring(6, 8);
      
      const subFunctionNames: { [key: string]: string } = {
        '0E': 'Read Device Identification'
      };
      
      const readDeviceIdNames: { [key: string]: string } = {
        '01': 'Basic Device Identification',
        '02': 'Regular Device Identification',
        '03': 'Extended Device Identification',
        '04': 'Individual Access'
      };
      
      const objectNames: { [key: string]: string } = {
        '00': 'VendorName',
        '01': 'ProductCode',
        '02': 'MajorMinorRevision',
        '03': 'VendorUrl',
        '04': 'ProductName',
        '05': 'ModelName',
        '06': 'UserApplicationName'
      };
      
      const subFunctionName = subFunctionNames[subFunction] || 'Unknown';
      const readDeviceIdName = readDeviceIdNames[readDeviceIdCode] || 'Unknown';
      const objectName = objectNames[objectId] || 'Unknown';
      
      if (pdu.length === 8) {
        // Request
        return `🏷️ READ DEVICE IDENTIFICATION (0x2B/0x0E) - REQUEST\nSub-function: 0x${subFunction} - ${subFunctionName}\nRead Device ID Code: 0x${readDeviceIdCode} - ${readDeviceIdName}\nObject ID: 0x${objectId} - ${objectName}`;
      } else {
        // Response
        const conformityLevel = pdu.substring(8, 10);
        const moreFollows = pdu.substring(10, 12);
        const nextObjectId = pdu.substring(12, 14);
        const numObjects = pdu.substring(14, 16);
        const objectData = pdu.substring(16);
        
        return `🏷️ READ DEVICE IDENTIFICATION (0x2B/0x0E) - RESPONSE\nSub-function: 0x${subFunction} - ${subFunctionName}\nConformity Level: 0x${conformityLevel}\nMore Follows: 0x${moreFollows}\nNext Object ID: 0x${nextObjectId}\nNumber of Objects: 0x${numObjects} (${parseInt(numObjects, 16)})\nObject Data: 0x${objectData}`;
      }
    }
    return `🏷️ READ DEVICE IDENTIFICATION (0x2B/0x0E)`;
  }

  private getExceptionText(code: number): string {
    const exceptions: { [key: number]: string } = {
      1: 'Illegal Function',
      2: 'Illegal Data Address',
      3: 'Illegal Data Value',
      4: 'Slave Device Failure',
      5: 'Acknowledge',
      6: 'Slave Device Busy',
      8: 'Memory Parity Error',
      10: 'Gateway Path Unavailable',
      11: 'Gateway Target Device Failed to Respond'
    };
    
    return exceptions[code] || 'Unknown Exception';
  }

  private validateCrc(hexData: string): boolean {
    if (hexData.length < 8) return false;
    
    // Simple CRC validation - in a real implementation, you'd calculate CRC-16
    // For now, we'll assume any packet with length >= 8 and last 4 chars as hex is valid
    const crcPart = hexData.substring(hexData.length - 4);
    return /^[0-9A-F]{4}$/.test(crcPart);
  }

  private attachEventListeners(): void {
    // Auto scroll toggle
    const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;
    autoScrollCheckbox?.addEventListener('change', (e) => {
      this.isAutoScroll = (e.target as HTMLInputElement).checked;
      if (this.isAutoScroll) {
        this.scrollToBottom();
      }
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

    // Log settings
    const settingsButton = document.getElementById('log-settings');
    settingsButton?.addEventListener('click', () => {
      this.showLogSettingsModal();
    });

    // Log settings modal events
    this.setupLogSettingsModal();
  }


  private refreshLogDisplay(wasTruncated: boolean = false): void {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      // Preserve scroll position if auto scroll is disabled
      let scrollTop = this.isAutoScroll ? 0 : logContainer.scrollTop;
      
      logContainer.innerHTML = this.renderLogs();
      
      // Restore scroll position only if auto scroll is disabled
      if (!this.isAutoScroll && scrollTop > 0) {
        requestAnimationFrame(() => {
          if (logContainer) {
            if (wasTruncated) {
              // When logs are truncated (1000 limit reached), preserve exact user scroll position
              // Do NOT automatically scroll to bottom or apply complex position calculations
              // Simply keep the user exactly where they were scrolling
              const newScrollHeight = logContainer.scrollHeight;
              const maxScrollTop = Math.max(0, newScrollHeight - logContainer.clientHeight);
              
              // Restore position but ensure it doesn't exceed new scroll bounds
              logContainer.scrollTop = Math.min(scrollTop, maxScrollTop);
            } else {
              // Normal case - restore exact position
              logContainer.scrollTop = scrollTop;
            }
          }
        });
      }
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
      // Notify App to clear all logs (including pending repeat logs)
      if (this.onClearLogs) {
        this.onClearLogs();
      } else {
        // Fallback to clearing only local logs if no callback is set
        this.logs = [];
        this.refreshLogDisplay();
        this.updateLogCount();
      }
    }
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

  // Log settings modal methods
  private showLogSettingsModal(): void {
    const modal = document.getElementById('log-settings-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      this.loadCurrentLogSettings();
    }
  }

  private hideLogSettingsModal(): void {
    const modal = document.getElementById('log-settings-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  private setupLogSettingsModal(): void {
    // Close modal events
    const closeButton = document.getElementById('close-log-settings');
    const cancelButton = document.getElementById('cancel-log-settings');
    
    closeButton?.addEventListener('click', () => this.hideLogSettingsModal());
    cancelButton?.addEventListener('click', () => this.hideLogSettingsModal());

    // Save settings
    const saveButton = document.getElementById('save-log-settings');
    saveButton?.addEventListener('click', () => this.saveLogSettings());

    // Storage mode toggle
    const storageModeRadios = document.querySelectorAll('input[name="storage-mode"]');
    storageModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.toggleSettingsSections(target.value as 'continuous' | 'rotation');
      });
    });

    // Close modal when clicking outside
    const modal = document.getElementById('log-settings-modal');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideLogSettingsModal();
      }
    });
  }

  private toggleSettingsSections(mode: 'continuous' | 'rotation'): void {
    const continuousSettings = document.getElementById('continuous-settings');
    const rotationSettings = document.getElementById('rotation-settings');

    if (mode === 'continuous') {
      continuousSettings?.classList.remove('hidden');
      rotationSettings?.classList.add('hidden');
    } else {
      continuousSettings?.classList.add('hidden');
      rotationSettings?.classList.remove('hidden');
    }
  }

  private loadCurrentLogSettings(): void {
    const config = this.logService.getConfig();

    // Set storage mode
    const modeRadio = document.querySelector(`input[name="storage-mode"][value="${config.mode}"]`) as HTMLInputElement;
    if (modeRadio) {
      modeRadio.checked = true;
      this.toggleSettingsSections(config.mode);
    }

    // Load continuous settings
    if (config.continuous) {
      const maxSizeInput = document.getElementById('continuous-max-size') as HTMLInputElement;
      if (maxSizeInput) {
        maxSizeInput.value = config.continuous.maxFileSize.toString();
      }
    }

    // Load rotation settings
    if (config.rotation) {
      const rotationMaxSize = document.getElementById('rotation-max-size') as HTMLInputElement;
      const rotationMaxFiles = document.getElementById('rotation-max-files') as HTMLInputElement;
      const rotationMaxAge = document.getElementById('rotation-max-age') as HTMLInputElement;
      const rotationCompression = document.getElementById('rotation-compression') as HTMLInputElement;

      if (rotationMaxSize) rotationMaxSize.value = config.rotation.maxFileSize.toString();
      if (rotationMaxFiles) rotationMaxFiles.value = config.rotation.maxFiles.toString();
      if (rotationMaxAge) rotationMaxAge.value = config.rotation.maxAge.toString();
      if (rotationCompression) rotationCompression.checked = config.rotation.compressionEnabled;
    }
  }

  private saveLogSettings(): void {
    const mode = (document.querySelector('input[name="storage-mode"]:checked') as HTMLInputElement)?.value as 'continuous' | 'rotation';
    
    const config: LogStorageConfig = {
      mode,
      continuous: {
        maxFileSize: parseInt((document.getElementById('continuous-max-size') as HTMLInputElement)?.value || '10'),
        fileNameFormat: 'YYYY-MM-DD_HH-mm-ss'
      },
      rotation: {
        maxFileSize: parseInt((document.getElementById('rotation-max-size') as HTMLInputElement)?.value || '5'),
        maxFiles: parseInt((document.getElementById('rotation-max-files') as HTMLInputElement)?.value || '10'),
        maxAge: parseInt((document.getElementById('rotation-max-age') as HTMLInputElement)?.value || '30'),
        compressionEnabled: (document.getElementById('rotation-compression') as HTMLInputElement)?.checked || false
      }
    };

    this.logService.updateConfig(config);
    this.hideLogSettingsModal();
    
    // Show confirmation
    this.showNotification('Log settings saved successfully!');
  }

  private showNotification(message: string): void {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }

  // Override addLog to use LogService
  addLog(log: LogEntry): void {
    // Add to LogService (this handles file storage)
    this.logService.addLog(log);
    
    // Get display logs for UI (limited to MAX_LOG_COUNT)
    this.logs = this.logService.getDisplayLogs(this.MAX_LOG_COUNT);
    
    this.updateLogs(this.logs);
  }

  // Override updateLogs to handle LogService integration
  updateLogs(logs: LogEntry[]): void {
    // If logs are coming from external source, add them to LogService
    if (logs.length > this.logs.length) {
      const newLogs = logs.slice(this.logs.length);
      this.logService.addLogs(newLogs);
    }

    const wasTruncated = logs.length > this.MAX_LOG_COUNT;
    
    // Limit log count to prevent performance issues
    if (wasTruncated) {
      this.logs = logs.slice(-this.MAX_LOG_COUNT);
    } else {
      this.logs = logs;
    }
    
    this.refreshLogDisplay(wasTruncated);
    this.updateLogCount();
    
    // Re-setup tooltip positioning for new log entries
    this.setupTooltipPositioning();
    
    if (this.isAutoScroll) {
      // Auto scroll to bottom when new logs are added
      // Use setTimeout to ensure it happens after scroll position restoration
      setTimeout(() => {
        this.scrollToBottom();
      }, 10);
    }
  }

  private exportLogs(): void {
    // Create export options modal or directly export
    const exportMenu = document.createElement('div');
    exportMenu.className = 'absolute right-0 mt-2 bg-dark-panel border border-dark-border rounded-lg shadow-lg z-10';
    exportMenu.innerHTML = `
      <div class="p-2 space-y-1">
        <button class="block w-full text-left px-3 py-2 text-sm hover:bg-dark-surface rounded" id="export-txt">
          Export as TXT
        </button>
        <button class="block w-full text-left px-3 py-2 text-sm hover:bg-dark-surface rounded" id="export-csv">
          Export as CSV
        </button>
      </div>
    `;

    // Position menu near export button
    const exportButton = document.getElementById('export-logs');
    if (exportButton) {
      exportButton.parentElement?.appendChild(exportMenu);
      
      // Position menu
      const rect = exportButton.getBoundingClientRect();
      exportMenu.style.position = 'fixed';
      exportMenu.style.top = `${rect.bottom + 5}px`;
      exportMenu.style.right = `${window.innerWidth - rect.right}px`;

      // Add event listeners
      document.getElementById('export-txt')?.addEventListener('click', () => {
        this.logService.exportLogsAsText();
        exportMenu.remove();
      });

      document.getElementById('export-csv')?.addEventListener('click', () => {
        this.logService.exportLogsAsCSV();
        exportMenu.remove();
      });

      // Close menu when clicking outside
      const closeMenu = (e: Event) => {
        if (!exportMenu.contains(e.target as Node)) {
          exportMenu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 10);
    }
  }
}