import { LogEntry } from '../../types';
import { LogService } from '../../services/LogService';
import { OptimizedLogService } from '../../services/OptimizedLogService';
import { LogSettingsPanel } from '../LogSettingsPanel';
import { DateTimeFilter, DateTimeRange } from '../../utils/DateTimeFilter';
import { VirtualScrollManager, VirtualScrollConfig } from '../../utils/VirtualScrollManager';

export class LogPanel {
  private logs: LogEntry[] = [];
  private filteredLogs: LogEntry[] = [];
  private isAutoScroll = true;
  private onClearLogs?: () => void;
  private connectionType: 'RTU' | 'TCP_NATIVE' = 'RTU';
  private isRepeatMode = false;
  private logService!: LogService;
  private optimizedLogService!: OptimizedLogService;
  private logSettingsPanel!: LogSettingsPanel;
  private currentDateTimeFilter: DateTimeRange = {};
  private currentSearchTerm: string = '';
  private useOptimizedService = true; // 최적화된 서비스 사용 여부
  private lastRenderedCount = 0; // Track last rendered log count for incremental updates
  private renderedLogIds = new Set<string>(); // Track which logs are already rendered
  private virtualScrollManager?: VirtualScrollManager; // Virtual scrolling manager
  private useVirtualScrolling = false; // Virtual scrolling toggle
  private isRenderingVirtualScroll = false; // Prevent infinite recursion
  private currentTheme: 'light' | 'dark' = 'light'; // Default theme
  
  // Event handlers for event delegation
  private handleTooltipMouseOver!: (e: Event) => void;
  private handleTooltipMouseOut!: (e: Event) => void;
  private handleLogContainerMouseOver!: (e: Event) => void;
  private handleLogContainerMouseOut!: (e: Event) => void;

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
        panelBg: 'bg-dark-panel',
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
    // Re-render the panel with new theme
    const container = document.querySelector('#log-content');
    if (container) {
      container.innerHTML = this.render();
      this.attachEventListeners();
      this.addCustomStyles();
      this.setupScrollContainer();
      this.setupTooltipPositioning();
      this.updateAutoScrollCheckbox();
      this.initializeVirtualScrolling();
      this.applyFilters();
      // Re-render logs with current data
      this.renderLogs();
    }
  }

  mount(container: HTMLElement): void {
    this.logService = new LogService();
    this.optimizedLogService = new OptimizedLogService();
    this.logSettingsPanel = new LogSettingsPanel(this.optimizedLogService);
    
    // Set clear callback if already available
    if (this.onClearLogs) {
      this.logSettingsPanel.setClearCallback(this.onClearLogs);
    } else {
    }
    
    container.innerHTML = this.render();
    this.attachEventListeners();
    this.addCustomStyles();
    this.setupScrollContainer(); // Setup scroll container
    this.setupTooltipPositioning();
    this.updateAutoScrollCheckbox();
    
    // Initialize virtual scrolling
    this.initializeVirtualScrolling();
    
    // Initialize filtered logs with current time filter
    this.applyFilters();
    
    // Log count display has been removed
  }

  setClearLogsCallback(callback: () => void): void {
    this.onClearLogs = callback;
    // Also set the callback for LogSettingsPanel
    if (this.logSettingsPanel) {
      this.logSettingsPanel.setClearCallback(callback);
    } else {
    }
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

    // Use event delegation for better performance with many log entries
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      // Remove existing listeners from log container
      logContainer.removeEventListener('mouseover', this.handleLogContainerMouseOver);
      logContainer.removeEventListener('mouseout', this.handleLogContainerMouseOut);
      
      // Add event delegation listeners to log container
      this.handleLogContainerMouseOver = (e: Event) => {
        const target = e.target as HTMLElement;
        
        // Check if tooltip should be shown (not during repeat mode or scrolling)
        if (target.classList.contains('modbus-packet') && 
            target.dataset.tooltip && 
            !this.isRepeatMode &&
            !logContainer.classList.contains('scrolling')) {
          currentTooltip = this.showTooltip(target, target.dataset.tooltip);
        }
      };

      this.handleLogContainerMouseOut = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('modbus-packet') && currentTooltip) {
          this.hideTooltip(currentTooltip);
          currentTooltip = null;
        }
      };
      
      logContainer.addEventListener('mouseover', this.handleLogContainerMouseOver);
      logContainer.addEventListener('mouseout', this.handleLogContainerMouseOut);
    }
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

  private render(): string {
    return `
      <div class="h-full flex flex-col" style="height: 100%; min-height: 400px;">
        <!-- Log Controls -->
        <div class="flex items-center justify-between p-4 border-b ${this.getThemeClasses().border} ${this.getThemeClasses().panelBg} flex-shrink-0">
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" id="auto-scroll" ${this.isAutoScroll ? 'checked' : ''} 
                class="rounded ${this.getThemeClasses().border} ${this.getThemeClasses().inputBg}">
              <span class="${this.getThemeClasses().textSecondary}">Auto Scroll</span>
            </label>
            
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Search logs..." 
                id="log-search"
                class="input-field text-sm w-48"
              />
              <button class="btn-secondary text-sm py-1 px-3" id="time-filter-btn">
                Time Filter
              </button>
            </div>
          </div>

          <div class="flex items-center justify-start gap-2 text-sm ${this.getThemeClasses().textSecondary}">
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
      
      <!-- Time Filter Modal -->
      ${this.renderTimeFilterModal()}
    `;
  }

  private renderTimeFilterModal(): string {
    return `
      <div id="time-filter-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-dark-panel border border-dark-border rounded-lg shadow-lg w-full max-w-md mx-4">
          <div class="flex items-center justify-between p-4 border-b border-dark-border">
            <h3 class="text-lg font-medium text-dark-text-primary">Time Range Filter</h3>
            <button id="close-time-filter" class="text-dark-text-muted hover:text-dark-text-primary">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="p-4 space-y-4">
            <!-- Quick Presets -->
            <div>
              <label class="block text-sm font-medium text-dark-text-primary mb-2">Quick Filters</label>
              <div class="grid grid-cols-2 gap-2">
                <button class="btn-secondary text-sm py-2 px-3 time-preset" data-preset="last-hour">Last Hour</button>
                <button class="btn-secondary text-sm py-2 px-3 time-preset" data-preset="last-4-hours">Last 4 Hours</button>
                <button class="btn-secondary text-sm py-2 px-3 time-preset" data-preset="today">Today</button>
                <button class="btn-secondary text-sm py-2 px-3 time-preset" data-preset="yesterday">Yesterday</button>
                <button class="btn-secondary text-sm py-2 px-3 time-preset" data-preset="last-7-days">Last 7 Days</button>
                <button class="btn-secondary text-sm py-2 px-3" id="clear-filter">Clear Filter</button>
              </div>
            </div>
            
            <!-- Custom Range -->
            <div class="border-t border-dark-border pt-4">
              <label class="block text-sm font-medium text-dark-text-primary mb-2">Custom Range</label>
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-dark-text-secondary mb-1">Start Date</label>
                    <input type="date" id="start-date" class="input-field text-sm w-full">
                  </div>
                  <div>
                    <label class="block text-xs text-dark-text-secondary mb-1">End Date</label>
                    <input type="date" id="end-date" class="input-field text-sm w-full">
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-dark-text-secondary mb-1">Start Time</label>
                    <input type="time" id="start-time" class="input-field text-sm w-full">
                  </div>
                  <div>
                    <label class="block text-xs text-dark-text-secondary mb-1">End Time</label>
                    <input type="time" id="end-time" class="input-field text-sm w-full">
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flex items-center justify-end gap-2 p-4 border-t border-dark-border">
            <button id="cancel-time-filter" class="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button id="apply-time-filter" class="btn-primary text-sm py-2 px-4">Apply Filter</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderLogs(): string {
    if (this.filteredLogs.length === 0) {
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
      } else {
        return `
          <div class="flex items-center justify-center h-full text-dark-text-muted">
            <div class="text-center">
              <div class="text-4xl mb-4">🔍</div>
              <p>No logs match the current filter</p>
              <p class="text-sm">Try adjusting your search terms or time range</p>
            </div>
          </div>
        `;
      }
    }

    return this.filteredLogs.map(log => this.renderLogEntry(log)).join('');
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
        ${log.responseTime ? `<div class="text-xs ${this.getThemeClasses().textMuted}">${log.responseTime}ms</div>` : ''}
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

    // Note: Clear, Export, and Settings buttons are handled by App.ts
    // since these buttons are rendered in App.ts renderMainContent() method

    // Time filter button
    const timeFilterButton = document.getElementById('time-filter-btn');
    timeFilterButton?.addEventListener('click', () => {
      this.showTimeFilterModal();
    });

    // Time filter modal events
    this.setupTimeFilterModal();
  }


  private refreshLogDisplay(): void {
    // Re-render logs based on current mode
    if (this.useVirtualScrolling) {
      this.renderVirtualScrollLogs();
    } else {
      this.renderRegularScrollLogs();
    }
  }

  private updateLogCount(): void {
    // Log count display has been removed from UI
    // This method is kept for backward compatibility but does nothing
  }

  private scrollToBottom(): void {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      // Use requestAnimationFrame to ensure scroll happens after DOM update
      requestAnimationFrame(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      });
    }
  }

  private setupScrollContainer(): void {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    // Set up regular scroll container for dynamic height support
    logContainer.style.overflowY = 'auto';
    logContainer.style.height = '100%'; // Use full available height
    logContainer.style.position = 'relative';

    // Track scrolling state for hover management
    let scrollTimeout: NodeJS.Timeout;
    let isScrolling = false;

    // Handle scroll events
    logContainer.addEventListener('scroll', (e) => {

      // Disable hover during scroll
      if (!isScrolling) {
        isScrolling = true;
        logContainer.classList.add('scrolling');
      }

      // Clear previous timeout
      clearTimeout(scrollTimeout);

      // Re-enable hover after scroll stops
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        logContainer.classList.remove('scrolling');
      }, 300); // 300ms delay after scroll stops
    });

    // Initial empty render
    this.renderRegularScrollLogs();
  }

  private renderRegularScrollLogs(): void {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    // Full render for initial load or when filteredLogs is completely different
    logContainer.innerHTML = this.filteredLogs.map(log => this.renderLogEntry(log)).join('');
    
    // Track all rendered logs
    this.renderedLogIds.clear();
    for (const log of this.filteredLogs) {
      this.renderedLogIds.add(log.id);
    }
  }

  private renderNewLogsIncremental(newLogs: LogEntry[]): void {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    // Filter new logs based on current time filter
    const filteredNewLogs = this.filterLogsByTimeRange(newLogs);
    
    // Collect new logs that haven't been rendered yet
    const logsToRender: LogEntry[] = [];
    for (const log of filteredNewLogs) {
      if (!this.renderedLogIds.has(log.id)) {
        logsToRender.push(log);
        this.renderedLogIds.add(log.id);
      }
    }
    
    // Batch DOM operations using DocumentFragment for better performance
    if (logsToRender.length > 0) {
      const fragment = document.createDocumentFragment();
      for (const log of logsToRender) {
        const logElement = this.createLogElement(log);
        fragment.appendChild(logElement);
      }
      logContainer.appendChild(fragment);
    }
  }

  private filterLogsByTimeRange(logs: LogEntry[]): LogEntry[] {
    if (Object.keys(this.currentDateTimeFilter).length === 0) {
      // No filter applied, return all logs
      return logs;
    } else {
      // Apply date/time filter using existing DateTimeFilter
      return DateTimeFilter.filterLogs(logs, this.currentDateTimeFilter);
    }
  }

  private createLogElement(log: LogEntry): HTMLElement {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.setAttribute('data-log-id', log.id);
    
    // Directly create DOM elements instead of using innerHTML for better performance
    const timestamp = this.formatTimestamp(log.timestamp);
    const directionClass = log.direction === 'send' ? 'send' : 'recv';
    const directionText = log.direction === 'send' ? 'SEND' : 'RECV';
    
    // Disable tooltip analysis during repeat mode for better performance
    const modbusInfo = this.isRepeatMode ? null : this.analyzeModbusPacket(log.data);
    
    div.innerHTML = `
      <div class="log-timestamp">${timestamp}</div>
      <div class="log-direction ${directionClass}">${directionText}</div>
      <div class="log-data ${modbusInfo && !this.isRepeatMode ? 'cursor-help modbus-packet' : ''}" 
           ${modbusInfo && !this.isRepeatMode ? `data-tooltip="${modbusInfo.replace(/"/g, '&quot;')}"` : ''}>
        ${this.formatLogData(log.data)}
      </div>
      ${log.responseTime ? `<div class="text-xs text-dark-text-muted">${log.responseTime}ms</div>` : ''}
      ${log.error ? `<div class="text-xs text-status-error">${log.error}</div>` : ''}
    `;
    
    return div;
  }

  private initializeVirtualScrolling(): void {
    const config: VirtualScrollConfig = {
      itemHeight: 32, // Approximate height of each log entry
      containerHeight: 400, // Default container height
      overscan: 5 // Render 5 extra items above and below viewport
    };

    this.virtualScrollManager = new VirtualScrollManager(config);
    
    // Setup state change callback to re-render when virtual scroll state changes
    this.virtualScrollManager.onStateUpdate((state) => {
      if (this.useVirtualScrolling && !this.isRenderingVirtualScroll) {
        this.renderVirtualScrollLogs();
      }
    });
    
    // Setup virtual scroll event listener - use later in mount
    this.setupVirtualScrollListener();
  }

  private shouldUseVirtualScrolling(): boolean {
    // Enable virtual scrolling when log count exceeds threshold
    const VIRTUAL_SCROLL_THRESHOLD = 30; // Optimized for high-frequency 10ms operations
    const shouldUse = this.filteredLogs.length > VIRTUAL_SCROLL_THRESHOLD;
    
    if (shouldUse && !this.useVirtualScrolling) {
    } else if (!shouldUse && this.useVirtualScrolling) {
    }
    
    return shouldUse;
  }

  private updateVirtualScrollingMode(): void {
    const shouldUse = this.shouldUseVirtualScrolling();
    
    if (shouldUse !== this.useVirtualScrolling) {
      this.useVirtualScrolling = shouldUse;
      
      if (this.useVirtualScrolling && this.virtualScrollManager) {
        // Switch to virtual scrolling
        this.updateVirtualScrollContainerHeight(); // Update height only when switching modes
        this.virtualScrollManager.setData(this.filteredLogs);
        this.renderVirtualScrollLogs();
      } else {
        // Switch back to regular scrolling
        this.renderRegularScrollLogs();
      }
    }
  }

  private renderVirtualScrollLogs(): void {
    if (!this.virtualScrollManager || this.isRenderingVirtualScroll) return;
    
    // Prevent infinite recursion
    this.isRenderingVirtualScroll = true;
    
    try {
      const logContainer = document.getElementById('log-container');
      if (!logContainer) return;

      const state = this.virtualScrollManager.getState();
      const config = this.virtualScrollManager.getConfig();
      
      // Check if virtual scroll structure already exists
      let scrollWrapper = logContainer.querySelector('.virtual-scroll-wrapper') as HTMLElement;
      let virtualContent = logContainer.querySelector('#virtual-content') as HTMLElement;
      
      if (!scrollWrapper || !virtualContent) {
        // Create virtual scroll structure for the first time
        logContainer.innerHTML = `
          <div class="virtual-scroll-wrapper" style="height: ${state.totalHeight}px; position: relative; overflow: hidden;">
            <div id="virtual-content" style="position: absolute; top: ${state.startIndex * config.itemHeight}px;">
            </div>
          </div>
        `;
        
        scrollWrapper = logContainer.querySelector('.virtual-scroll-wrapper') as HTMLElement;
        virtualContent = logContainer.querySelector('#virtual-content') as HTMLElement;
        
        // Setup scroll listener only on first render
        this.setupVirtualScrollListener();
      } else {
        // Update existing structure
        scrollWrapper.style.height = `${state.totalHeight}px`;
        virtualContent.style.top = `${state.startIndex * config.itemHeight}px`;
        virtualContent.innerHTML = ''; // Clear existing content
      }

      if (virtualContent) {
        // Render only visible items
        for (const log of state.visibleItems) {
          const logElement = this.createLogElement(log);
          virtualContent.appendChild(logElement);
        }
      }
    } finally {
      // Always reset the flag
      this.isRenderingVirtualScroll = false;
    }
  }

  private updateVirtualScrollContainerHeight(): void {
    const logContainer = document.getElementById('log-container');
    if (!logContainer || !this.virtualScrollManager) return;
    
    // Update virtual scroll manager's container height based on actual container
    const containerRect = logContainer.getBoundingClientRect();
    if (containerRect.height > 0) {
      this.virtualScrollManager.updateConfig({
        containerHeight: containerRect.height
      });
    }
  }

  private scrollListener?: (e: Event) => void;

  private setupVirtualScrollListener(): void {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;
    
    // Remove existing listener if it exists
    if (this.scrollListener) {
      logContainer.removeEventListener('scroll', this.scrollListener);
    }
    
    // Create new scroll listener
    this.scrollListener = (e) => {
      if (this.useVirtualScrolling && this.virtualScrollManager) {
        const target = e.target as HTMLElement;
        this.virtualScrollManager.setScrollTop(target.scrollTop);
      }
    };
    
    // Add new scroll listener
    logContainer.addEventListener('scroll', this.scrollListener, { passive: true });
  }


  private filterLogs(searchTerm: string): void {
    const term = searchTerm.toLowerCase().trim();
    
    // Store current search term
    this.currentSearchTerm = term;
    
    // Apply both search and time filters
    this.applyFilters();
    
    // Re-render the logs with filtered data
    if (this.useVirtualScrolling) {
      this.renderVirtualScrollLogs();
    } else {
      this.renderRegularScrollLogs();
    }
  }

  private applyFilters(): void {
    // Start with all logs
    let filteredLogs = this.logs;
    
    // Apply time filter first
    if (Object.keys(this.currentDateTimeFilter).length > 0) {
      filteredLogs = DateTimeFilter.filterLogs(filteredLogs, this.currentDateTimeFilter);
    }
    
    // Apply search filter
    if (this.currentSearchTerm) {
      filteredLogs = filteredLogs.filter(log => {
        const searchableText = [
          log.data.toLowerCase(),
          log.direction.toLowerCase(),
          this.formatTimestamp(log.timestamp).toLowerCase(),
          log.error ? log.error.toLowerCase() : ''
        ].join(' ');
        
        return searchableText.includes(this.currentSearchTerm);
      });
    }
    
    // Update filtered logs
    this.filteredLogs = filteredLogs;
    
    // Update virtual scrolling data if enabled
    if (this.virtualScrollManager) {
      this.virtualScrollManager.setData(this.filteredLogs);
    }
  }

  public clearLogs(): void {
    
    // Reset all tracking variables for incremental rendering
    this.lastRenderedCount = 0;
    this.renderedLogIds.clear();
    
    // Reset Virtual Scrolling state
    if (this.virtualScrollManager) {
      this.virtualScrollManager.setData([]);
      this.virtualScrollManager.setScrollTop(0); // Reset scroll position
    }
    this.useVirtualScrolling = false;
    
    // Clear local log arrays
    this.logs = [];
    this.filteredLogs = [];
    
    // Clear search term
    this.currentSearchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('log-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Reset scroll position to top immediately and after DOM update
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = 0;
      
      // Use multiple frames to ensure scroll position is maintained during DOM updates
      requestAnimationFrame(() => {
        logContainer.scrollTop = 0;
        requestAnimationFrame(() => {
          logContainer.scrollTop = 0;
        });
      });
    }
    
    // Force complete DOM refresh immediately
    this.forceRefreshDisplay();
    // Log count display has been removed
    
    // Additional scroll reset after DOM refresh
    setTimeout(() => {
      const logContainer = document.getElementById('log-container');
      if (logContainer) {
        logContainer.scrollTop = 0;
      }
    }, 50);
    
    // Ensure auto scroll is enabled after clearing
    this.isAutoScroll = true;
    this.updateAutoScrollCheckbox();
    
  }

  private forceRefreshDisplay(): void {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      // Clear all content
      logContainer.innerHTML = '';
      
      // Re-render based on current state
      if (this.logs.length === 0) {
        // Show empty state without taking full height
        logContainer.innerHTML = `
          <div class="flex items-center justify-center py-8 text-dark-text-muted">
            <div class="text-center">
              <div class="text-4xl mb-4">📡</div>
              <p>No communication logs yet</p>
              <p class="text-sm">Connect to a Modbus device to start monitoring</p>
            </div>
          </div>
        `;
      } else {
        // Re-render logs normally
        this.applyFilters();
        this.renderRegularScrollLogs();
      }
    }
  }


  // Development helper method for generating sample logs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateSampleLogs(): void {
    // Generate initial sample logs
    const sampleLogs: LogEntry[] = [];
    
    for (let i = 0; i < 5; i++) {
      const baseTime = Date.now() - (5 - i) * 1000;
      
      const sendData = `01 03 00 ${i.toString(16).padStart(2, '0')} 00 0A C5 CD`;
      const recvData = `01 03 14 ${Array.from({length: 6}, (_, j) => (i + j).toString(16).padStart(2, '0')).join(' ')} FA 6C`;
      
      // Send log
      sampleLogs.push({
        id: `initial-${i * 2 + 1}`,
        timestamp: new Date(baseTime),
        direction: 'send',
        data: sendData
      });
      
      // Receive log
      sampleLogs.push({
        id: `initial-${i * 2 + 2}`,
        timestamp: new Date(baseTime + 100),
        direction: 'recv',
        data: recvData,
        responseTime: 80 + Math.floor(Math.random() * 40)
      });
    }

    this.updateLogs(sampleLogs);
    
    // Start adding logs gradually to test real-time updates
    this.startGradualLogGeneration();
  }

  private startGradualLogGeneration(): void {
    let counter = 0;
    const interval = setInterval(async () => {
      if (counter >= 20) {
        clearInterval(interval);
        return;
      }

      const baseTime = Date.now();
      const sendData = `01 03 00 ${counter.toString(16).padStart(2, '0')} 00 0A C5 CD`;
      const recvData = `01 03 14 ${Array.from({length: 6}, (_, j) => (counter + j).toString(16).padStart(2, '0')).join(' ')} FA 6C`;


      // Add send log
      await this.addLog({
        id: `gradual-send-${counter}`,
        timestamp: new Date(baseTime),
        direction: 'send',
        data: sendData
      });

      // Add receive log after 200ms
      setTimeout(async () => {
        await this.addLog({
          id: `gradual-recv-${counter}`,
          timestamp: new Date(baseTime + 200),
          direction: 'recv',
          data: recvData,
          responseTime: 80 + Math.floor(Math.random() * 40)
        });
      }, 200);

      counter++;
    }, 3000); // Add new logs every 3 seconds
  }




  // Override addLog to use LogService
  async addLog(log: LogEntry): Promise<void> {
    if (this.useOptimizedService) {
      // Use optimized service with circular buffer
      await this.optimizedLogService.addLog(log);
      
      // Get recent logs for display (limit to prevent UI lag)
      this.logs = this.optimizedLogService.getRecentLogs(1000);
    } else {
      // Fallback to original service
      this.logService.addLog(log);
      this.logs = this.logService.getAllLogs();
    }
    
    // Apply current filters
    this.applyFilters();
    
    // Render updated logs
    this.renderRegularScrollLogs();
    
    // Log count display has been removed
    
    // Handle auto scroll
    this.handleAutoScroll();
  }


  // Override updateLogs to handle LogService integration and regular scrolling
  updateLogs(logs: LogEntry[]): void {
    // Incremental update instead of full rebuild
    const newLogs = logs.slice(this.lastRenderedCount);
    
    // Only add new logs to service instead of rebuilding
    if (this.useOptimizedService) {
      for (const log of newLogs) {
        this.optimizedLogService.addLog(log);
      }
    } else {
      if (this.logService.addLogs) {
        this.logService.addLogs(newLogs);
      }
    }
    
    // Update logs array
    this.logs = logs;
    
    // Apply current filters (time and search)
    this.applyFilters();
    
    // Check if we should switch virtual scrolling mode
    this.updateVirtualScrollingMode();
    
    // Render logs based on current mode
    if (this.useVirtualScrolling) {
      if (this.virtualScrollManager) {
        this.virtualScrollManager.setData(this.filteredLogs);
        this.renderVirtualScrollLogs();
      }
    } else {
      // Render only new logs incrementally
      this.renderNewLogsIncremental(newLogs);
    }
    
    // Update tracking variables
    this.lastRenderedCount = logs.length;
    
    // Log count display has been removed
    
    // Re-setup tooltip positioning for new log entries
    this.setupTooltipPositioning();
    
    // Handle auto scroll
    this.handleAutoScroll();
  }


  private handleAutoScroll(): void {
    // Double-check auto scroll state from actual DOM element to prevent race conditions
    const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;
    const isAutoScrollEnabled = autoScrollCheckbox?.checked ?? this.isAutoScroll;
    
    if (isAutoScrollEnabled) {
      // Only auto scroll if we have enough logs to justify scrolling
      // This prevents scrolling to bottom when there are only a few logs after clear
      const logContainer = document.getElementById('log-container');
      if (logContainer && this.filteredLogs.length > 0) {
        // Check if content height exceeds container height
        const contentHeight = logContainer.scrollHeight;
        const containerHeight = logContainer.clientHeight;
        
        // Only scroll if content actually overflows the container
        if (contentHeight > containerHeight) {
          // Use setTimeout to ensure it happens after virtual scroll updates
          setTimeout(() => {
            // Triple check before scrolling to prevent unwanted scrolling
            const currentAutoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;
            if (currentAutoScrollCheckbox?.checked) {
              this.scrollToBottom();
            }
          }, 10);
        } else {
          // If content doesn't overflow, ensure we're at the top for clear visibility
          // This happens right after clear when we have few logs
          logContainer.scrollTop = 0;
        }
      }
    }
  }


  // Time filter modal methods
  private showTimeFilterModal(): void {
    const modal = document.getElementById('time-filter-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  private hideTimeFilterModal(): void {
    const modal = document.getElementById('time-filter-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  private setupTimeFilterModal(): void {
    // Close modal buttons
    const closeButton = document.getElementById('close-time-filter');
    const cancelButton = document.getElementById('cancel-time-filter');
    
    closeButton?.addEventListener('click', () => {
      this.hideTimeFilterModal();
    });
    
    cancelButton?.addEventListener('click', () => {
      this.hideTimeFilterModal();
    });

    // Preset filter buttons
    const presetButtons = document.querySelectorAll('.time-preset');
    presetButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const presetId = (e.target as HTMLElement).dataset.preset;
        if (presetId) {
          this.applyPresetFilter(presetId);
        }
      });
    });

    // Clear filter button
    const clearFilterButton = document.getElementById('clear-filter');
    clearFilterButton?.addEventListener('click', () => {
      this.clearTimeFilter();
    });

    // Apply custom filter button
    const applyButton = document.getElementById('apply-time-filter');
    applyButton?.addEventListener('click', () => {
      this.applyCustomTimeFilter();
    });

    // Close modal when clicking outside
    const modal = document.getElementById('time-filter-modal');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideTimeFilterModal();
      }
    });
  }

  private applyPresetFilter(presetId: string): void {
    const presets = DateTimeFilter.getPresets();
    const preset = presets.find(p => p.id === presetId);
    
    if (preset) {
      this.currentDateTimeFilter = preset.range;
      this.applyTimeFilter();
      this.hideTimeFilterModal();
    }
  }

  private applyCustomTimeFilter(): void {
    const startDateInput = document.getElementById('start-date') as HTMLInputElement;
    const endDateInput = document.getElementById('end-date') as HTMLInputElement;
    const startTimeInput = document.getElementById('start-time') as HTMLInputElement;
    const endTimeInput = document.getElementById('end-time') as HTMLInputElement;

    const startDate = startDateInput?.value ? new Date(startDateInput.value) : undefined;
    const endDate = endDateInput?.value ? new Date(endDateInput.value) : undefined;
    const startTime = startTimeInput?.value || undefined;
    const endTime = endTimeInput?.value || undefined;

    // Create custom range
    const customRange = DateTimeFilter.createCustomRange(startDate, endDate, startTime, endTime);
    
    // Validate range
    const validation = DateTimeFilter.validateRange(customRange);
    if (!validation.valid) {
      alert(`Invalid time range: ${validation.error}`);
      return;
    }

    this.currentDateTimeFilter = customRange;
    this.applyTimeFilter();
    this.hideTimeFilterModal();
  }

  private clearTimeFilter(): void {
    this.currentDateTimeFilter = {};
    this.applyTimeFilter();
    this.hideTimeFilterModal();
  }

  private applyTimeFilter(): void {
    // Apply time filter to logs using the existing method
    this.applyFilters();
    
    // Update display
    this.refreshLogDisplay();
    // Log count display has been removed
    
    // Update time filter button text to show active filter
    const timeFilterButton = document.getElementById('time-filter-btn');
    if (timeFilterButton) {
      if (Object.keys(this.currentDateTimeFilter).length === 0) {
        timeFilterButton.textContent = 'Time Filter';
        timeFilterButton.classList.remove('bg-blue-600', 'text-white');
        timeFilterButton.classList.add('btn-secondary');
      } else {
        timeFilterButton.textContent = 'Time Filter ✓';
        timeFilterButton.classList.remove('btn-secondary');
        timeFilterButton.classList.add('bg-blue-600', 'text-white');
      }
    }
  }

  // Public method to access optimized log service
  public getOptimizedLogService(): OptimizedLogService {
    return this.optimizedLogService;
  }

  // Clean up all resources and event listeners
  public destroy(): void {
    try {
      // Remove virtual scroll listener
      const logContainer = document.getElementById('log-container');
      if (logContainer && this.scrollListener) {
        logContainer.removeEventListener('scroll', this.scrollListener);
        this.scrollListener = undefined;
      }

      // Remove tooltip event listeners (note: these are dynamically added in setupTooltipPositioning)

      // Remove any active tooltips
      const existingTooltip = document.querySelector('.tooltip-custom');
      if (existingTooltip) {
        existingTooltip.remove();
      }

      // Remove custom styles
      const customStyle = document.querySelector('style[data-logpanel-tooltip]');
      if (customStyle) {
        customStyle.remove();
      }

      // Clear virtual scroll manager
      if (this.virtualScrollManager) {
        this.virtualScrollManager = undefined;
      }

      // Clear arrays and references
      this.logs = [];
      this.filteredLogs = [];
      this.renderedLogIds.clear();
      this.onClearLogs = undefined;

      // Reset tracking variables
      this.lastRenderedCount = 0;
      this.isRenderingVirtualScroll = false;
      this.useVirtualScrolling = false;
      this.isRepeatMode = false;

    } catch (error) {
      console.error('[LogPanel] Error during destroy:', error);
    }
  }


}