import { i18n } from '../../locales';

export class CommandPanel {
  private onCommandSend: (command: string, isRepeating?: boolean) => void;
  private onRepeatModeChanged?: (isRepeating: boolean) => void;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private connectionType: 'RTU' | 'TCP' | 'TCP_NATIVE' = 'RTU';
  private lastConnectionType: 'RTU' | 'TCP' | 'TCP_NATIVE' | null = null;
  private recentCommands: string[] = [];
  private maxRecentCommands = 10;
  private repeatTimer: NodeJS.Timeout | null = null;
  private isRepeating = false;
  private repeatInterval = 1000; // Default 1 second
  private startTime = 0; // Track start time for precise timing
  private expectedNextTime = 0; // Expected time for next execution
  private checkedCommands: Set<string> = new Set(); // Track checked commands

  constructor(onCommandSend: (command: string, isRepeating?: boolean) => void, onRepeatModeChanged?: (isRepeating: boolean) => void) {
    this.onCommandSend = onCommandSend;
    this.onRepeatModeChanged = onRepeatModeChanged;
  }

  mount(container: HTMLElement): void {
    container.innerHTML = this.render();
    this.attachEventListeners();
    // Apply initial AutoCRC setting based on current connection type
    this.updateAutoCrcForConnectionType(this.connectionType);
  }

  destroy(): void {
    // Clean up repeat timer when component is destroyed
    this.stopRepeatMode();
  }

  private render(): string {
    return `
      <div class="flex flex-col space-y-4">
        <!-- Quick Commands -->
        <div>
          <h3 class="text-sm font-medium text-dark-text-secondary mb-3">Quick Commands & Examples</h3>
          <div class="grid grid-cols-1 gap-2" id="quick-commands">
            ${this.renderQuickCommands()}
          </div>
          <div class="text-xs text-blue-400 mt-2" id="mode-info">
            ${this.renderModeInfo()}
          </div>
        </div>

        <!-- Manual Command Input -->
        <div class="flex flex-col">
          <h3 class="text-sm font-medium text-dark-text-secondary mb-3">${i18n.t('command.manual.title')}</h3>
          
          <div class="flex flex-col space-y-3">
            <!-- Manual HEX Input -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-dark-text-muted">
                  ${i18n.t('command.manual.input')}
                </label>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" id="ascii-mode" class="rounded border-dark-border bg-dark-surface">
                    <span class="text-dark-text-muted">${i18n.t('command.manual.asciiMode')}</span>
                  </label>
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" id="auto-crc" checked class="rounded border-dark-border bg-dark-surface">
                    <span class="text-dark-text-muted">${i18n.t('command.manual.autoCrc')}</span>
                  </label>
                </div>
              </div>
              <textarea 
                id="manual-hex-input"
                class="input-field w-full h-16 font-mono text-sm resize-none"
                placeholder="Enter Modbus PDU data:&#10;• HEX Mode: 01 03 00 00 00 0A&#10;• ASCII Mode: Hello World&#10;Toggle ASCII Mode checkbox for text input"
              ></textarea>
              <div class="text-xs mt-1" id="hex-preview">
                <span class="text-dark-text-muted">Preview:</span> 
                <span class="text-dark-text-secondary font-mono">Enter data above (toggle ASCII Mode for text input)...</span>
              </div>
            </div>

            <!-- Command Builder -->
            <div class="border-t border-dark-border pt-3">
              <h4 class="text-xs font-medium text-dark-text-muted mb-2">${i18n.t('command.generator.title')}</h4>
              
              <!-- Hex Base Mode Checkbox -->
              <div class="mb-3">
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" id="hex-base-mode" checked class="rounded border-dark-border bg-dark-surface">
                  <span class="text-dark-text-secondary">${i18n.t('command.generator.hexBaseMode')}</span>
                  <span class="text-xs text-dark-text-muted">(Input values as hex strings)</span>
                </label>
              </div>

              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">
                    ${i18n.t('command.generator.slaveId')}
                  </label>
                  <input id="slave-id" class="input-field w-full text-sm" value="01" 
                         placeholder="${this.connectionType.startsWith('TCP') ? '01 (Unit ID for MBAP)' : '01 (hex) or 1 (dec)'}">
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">${i18n.t('command.generator.functionCode')}</label>
                  <select id="function-code" class="input-field w-full text-sm">
                    <option value="01">${i18n.t('command.functionCodes.01')}</option>
                    <option value="02">${i18n.t('command.functionCodes.02')}</option>
                    <option value="03" selected>${i18n.t('command.functionCodes.03')}</option>
                    <option value="04">${i18n.t('command.functionCodes.04')}</option>
                    <option value="05">${i18n.t('command.functionCodes.05')}</option>
                    <option value="06">${i18n.t('command.functionCodes.06')}</option>
                    <option value="0F">${i18n.t('command.functionCodes.0F')}</option>
                    <option value="10">${i18n.t('command.functionCodes.10')}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">${i18n.t('command.generator.startAddress')}</label>
                  <input id="start-address" class="input-field w-full text-sm" value="0000" placeholder="0000 (hex) or 0 (dec)">
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">${i18n.t('command.generator.quantity')}</label>
                  <input id="quantity" class="input-field w-full text-sm" value="000A" placeholder="000A (hex) or 10 (dec)">
                </div>
              </div>
              
              <!-- Data Values for Function Code 0F/10 -->
              <div id="data-values-section" class="mt-3 hidden">
                <label class="block text-xs text-dark-text-muted mb-2" id="data-values-label">${i18n.t('command.dataValues.title')}</label>
                <div class="space-y-2" id="data-values-container">
                  <!-- Data value inputs will be dynamically added here -->
                </div>
                <button type="button" class="btn-secondary text-xs mt-2" id="add-data-value">
                  + ${i18n.t('command.dataValues.add')}
                </button>
              </div>
              
              <button class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200 font-medium w-full mt-2 text-sm" id="build-command">
                ${i18n.t('command.generator.generateCommand')}
              </button>
            </div>

            <!-- Send Controls -->
            <div class="flex gap-2 pt-3 border-t border-dark-border mt-auto">
              <button class="btn-primary flex-1" id="send-command">
                ${i18n.t('common.send')}
              </button>
              <button class="btn-secondary" id="clear-command">
                ${i18n.t('common.clear')}
              </button>
            </div>
          </div>
        </div>

        <!-- Command History -->
        <div class="border-t border-dark-border pt-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-dark-text-secondary">${i18n.t('command.history.title')} & ${i18n.t('command.repeat.title')} (Max 10)</h3>
            <div class="flex items-center gap-2">
              <input 
                type="number" 
                id="repeat-interval" 
                class="input-field text-xs w-20" 
                value="1000" 
                min="10" 
                max="999999"
                step="1"
                pattern="[0-9]*"
                placeholder="1000"
                title="${i18n.t('command.repeat.interval')} (${i18n.t('command.repeat.minInterval')}, integers only)">
              <span class="text-xs text-dark-text-muted">ms</span>
              <button class="btn-secondary text-xs py-1 px-2" id="toggle-repeat">
                ${i18n.t('common.start')}
              </button>
            </div>
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto scrollbar-thin" id="command-history">
            ${this.renderCommandHistory()}
          </div>
        </div>
      </div>
    `;
  }

  private renderCommandHistory(): string {
    if (this.recentCommands.length === 0) {
      return `<p class="text-xs text-dark-text-muted text-center py-2">${i18n.t('command.history.empty')}</p>`;
    }

    return this.recentCommands.map((cmd, index) => `
      <div class="flex items-center gap-2 p-1 bg-dark-surface rounded border border-dark-border hover:bg-dark-panel transition-colors">
        <input 
          type="checkbox" 
          id="repeat-${index}" 
          class="rounded border-dark-border bg-dark-surface flex-shrink-0"
          data-repeat-command="${cmd}"
          title="${i18n.t('command.repeat.selectCommands')}"
          ${this.checkedCommands.has(cmd) ? 'checked' : ''}
        >
        <button 
          class="flex-1 text-left text-xs font-mono text-dark-text-primary hover:text-blue-400 transition-colors min-w-0 truncate select-none"
          data-history-command="${cmd}"
          title="Click: Send directly"
          style="user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;"
        >
          ${cmd}
        </button>
        <button 
          class="text-xs text-red-400 hover:text-red-300 px-1 flex-shrink-0"
          data-remove-history="${index}"
          title="${i18n.t('command.history.remove')}"
        >
          ✕
        </button>
      </div>
    `).join('');
  }

  private attachEventListeners(): void {
    this.attachQuickCommandListeners();

    // Send command
    const sendButton = document.getElementById('send-command');
    sendButton?.addEventListener('click', () => this.handleSendCommand());

    // Clear command
    const clearButton = document.getElementById('clear-command');
    clearButton?.addEventListener('click', () => this.clearCommand());

    // Build command
    const buildButton = document.getElementById('build-command');
    buildButton?.addEventListener('click', () => this.buildCommand());

    // Hex base mode checkbox
    const hexBaseModeCheckbox = document.getElementById('hex-base-mode') as HTMLInputElement;
    hexBaseModeCheckbox?.addEventListener('change', () => {
      this.updateInputFieldsForHexBase();
    });

    // Function code selection change
    const functionCodeSelect = document.getElementById('function-code') as HTMLSelectElement;
    functionCodeSelect?.addEventListener('change', () => {
      this.handleFunctionCodeChange();
    });

    // Quantity input change (for FC 0F/10 data count)
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;
    quantityInput?.addEventListener('input', () => {
      this.updateDataValuesSection();
    });

    // Add data value button
    const addDataButton = document.getElementById('add-data-value');
    addDataButton?.addEventListener('click', () => {
      this.addDataValueInput();
    });

    // Initialize input fields for hex base mode (default checked)
    this.updateInputFieldsForHexBase();
    
    // Initialize function code UI
    this.handleFunctionCodeChange();

    // Repeat interval input
    const repeatIntervalInput = document.getElementById('repeat-interval') as HTMLInputElement;
    if (repeatIntervalInput) {
      // Ensure HTML value matches JavaScript initial value after DOM is ready
      setTimeout(() => {
        if (repeatIntervalInput) {
          repeatIntervalInput.value = this.repeatInterval.toString();
        }
      }, 0);
      
      repeatIntervalInput.addEventListener('change', () => {
        const value = parseInt(repeatIntervalInput.value, 10);
        if (value >= 10 && Number.isInteger(value)) {
          this.repeatInterval = value;
        } else {
          repeatIntervalInput.value = '10';
          this.repeatInterval = 10;
          alert('Minimum interval is 10ms (integers only)');
        }
      });
      
      // Also handle input event for real-time validation
      repeatIntervalInput.addEventListener('input', () => {
        const value = parseInt(repeatIntervalInput.value, 10);
        if (isNaN(value) || value < 10) {
          repeatIntervalInput.setCustomValidity('Minimum interval is 10ms');
        } else {
          repeatIntervalInput.setCustomValidity('');
        }
      });
    }

    // Toggle repeat button
    const toggleRepeatButton = document.getElementById('toggle-repeat');
    toggleRepeatButton?.addEventListener('click', () => {
      this.toggleRepeatMode();
    });

    // Manual HEX input keyboard shortcuts and formatting
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    manualHexInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSendCommand();
      } else if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });

    // Format input on typing and update preview
    manualHexInput?.addEventListener('input', (e) => {
      const input = e.target as HTMLTextAreaElement;
      const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
      const isAsciiMode = asciiModeCheckbox?.checked || false;
      
      // Only format HEX input in real-time, leave ASCII as-is
      if (!isAsciiMode) {
        const originalValue = input.value;
        const originalCursor = input.selectionStart;
        const converted = this.formatHexInput(originalValue);
        
        if (converted !== originalValue) {
          input.value = converted;
          // Adjust cursor position for automatic spacing
          const newCursor = this.adjustCursorForSpacing(originalValue, originalCursor, converted);
          input.setSelectionRange(newCursor, newCursor);
        }
      }
      
      this.updateHexPreview();
    });

    // Handle paste events
    manualHexInput?.addEventListener('paste', (e) => {
      const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
      const isAsciiMode = asciiModeCheckbox?.checked || false;
      
      // In ASCII mode, allow normal paste behavior
      if (isAsciiMode) {
        // Let the default paste behavior work
        setTimeout(() => this.updateHexPreview(), 0);
        return;
      }
      
      // In HEX mode, format the pasted data with automatic spacing
      e.preventDefault();
      const pastedData = e.clipboardData?.getData('text') || '';
      const input = e.target as HTMLTextAreaElement;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const currentValue = input.value;
      
      // Insert pasted data and format the entire input
      const newValue = currentValue.substring(0, start) + pastedData + currentValue.substring(end);
      const formatted = this.formatHexInput(newValue);
      input.value = formatted;
      
      // Update cursor position
      const newCursorPos = start + this.formatHexInput(pastedData).length;
      input.setSelectionRange(newCursorPos, newCursorPos);
      
      this.updateHexPreview();
    });

    // ASCII Mode checkbox
    const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
    asciiModeCheckbox?.addEventListener('change', () => {
      this.updateHexPreview();
    });

    // Auto CRC checkbox
    const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
    autoCrcCheckbox?.addEventListener('change', () => {
      this.updateHexPreview();
    });

    // Command history clicks
    this.attachHistoryListeners();
  }

  private attachHistoryListeners(): void {
    // Handle single click to send history command directly (faster than double-click)
    document.querySelectorAll('[data-history-command]').forEach(button => {
      let clickTimeout: NodeJS.Timeout | null = null;
      
      button.addEventListener('click', (e) => {
        // Prevent default behavior and event propagation
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any existing timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }
        
        // Add small delay to prevent accidental rapid clicks
        clickTimeout = setTimeout(() => {
          const rawInput = (e.target as HTMLElement).dataset.historyCommand;
          if (rawInput) {
            this.sendCommandDirectly(rawInput);
          }
        }, 100); // 100ms delay to prevent rapid accidental clicks
      });
    });

    // Click to remove history command
    document.querySelectorAll('[data-remove-history]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the use command click
        const index = parseInt((e.target as HTMLElement).dataset.removeHistory || '');
        if (!isNaN(index)) {
          this.removeFromRecentCommands(index);
        }
      });
    });

    // Handle repeat checkboxes
    document.querySelectorAll('[data-repeat-command]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const command = (e.target as HTMLInputElement).dataset.repeatCommand;
        const isChecked = (e.target as HTMLInputElement).checked;
        
        // Update checked commands set
        if (command) {
          if (isChecked) {
            this.checkedCommands.add(command);
          } else {
            this.checkedCommands.delete(command);
          }
        }
        
        console.log(`Repeat command ${isChecked ? 'enabled' : 'disabled'} for: ${command}`);
        
        // If we're currently repeating and no commands are checked, stop the repeat
        if (this.isRepeating && !this.hasCheckedCommands()) {
          this.stopRepeatMode();
        }
      });
    });
  }

  private handleSendCommand(): void {
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
    const isAsciiMode = asciiModeCheckbox?.checked || false;
    const rawInput = manualHexInput?.value.trim();

    if (!rawInput) {
      alert('Please enter a command');
      return;
    }

    // Send the command
    this.sendCommandDirectly(rawInput, isAsciiMode);
    
    // Clear input
    manualHexInput.value = '';
    this.updateHexPreview();
  }

  private sendCommandDirectly(rawInput: string, isAsciiMode?: boolean): void {
    if (!rawInput) {
      return;
    }

    // Determine ASCII mode from checkbox if not provided
    if (isAsciiMode === undefined) {
      const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
      isAsciiMode = asciiModeCheckbox?.checked || false;
    }

    // Convert to HEX format based on input mode
    let command: string;
    if (isAsciiMode) {
      command = this.asciiToHex(rawInput);
    } else {
      command = this.formatHexInput(rawInput);
      if (!this.isValidHexInput(command)) {
        alert('Invalid HEX format. Please use hex characters (0-9, A-F) only.');
        return;
      }
    }

    // For RTU, add CRC if enabled. For TCP, the command is sent as is (PDU + Unit ID).
    if (this.connectionType === 'RTU') {
      const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
      if (autoCrcCheckbox?.checked) {
        command = this.addCrcToCommand(command);
      }
    }

    // Add to recent commands (store the original input for reuse)
    this.addToRecentCommands(rawInput);
    
    // Send command
    this.onCommandSend(command);
  }

  private sendCommandDirectlyWithoutHistory(rawInput: string, isAsciiMode?: boolean): void {
    if (!rawInput) {
      return;
    }

    // Determine ASCII mode from checkbox if not provided
    if (isAsciiMode === undefined) {
      const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
      isAsciiMode = asciiModeCheckbox?.checked || false;
    }

    // Convert to HEX format based on input mode
    let command: string;
    if (isAsciiMode) {
      command = this.asciiToHex(rawInput);
    } else {
      command = this.formatHexInput(rawInput);
      if (!this.isValidHexInput(command)) {
        console.error('Invalid HEX format during repeat mode:', rawInput);
        return;
      }
    }

    // For RTU, add CRC if enabled. For TCP, the command is sent as is (PDU + Unit ID).
    if (this.connectionType === 'RTU') {
      const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
      if (autoCrcCheckbox?.checked) {
        command = this.addCrcToCommand(command);
      }
    }

    // Send command without adding to recent commands
    this.onCommandSend(command, false);
  }

  private buildCommand(): void {
    const hexBaseMode = (document.getElementById('hex-base-mode') as HTMLInputElement).checked;
    const slaveIdValue = (document.getElementById('slave-id') as HTMLInputElement).value;
    const functionCodeValue = (document.getElementById('function-code') as HTMLSelectElement).value;
    const startAddressValue = (document.getElementById('start-address') as HTMLInputElement).value;
    const quantityValue = (document.getElementById('quantity') as HTMLInputElement).value;

    let slaveId: number;
    let startAddress: number;
    let quantity: number;

    // Function code is always hex in the select options
    const functionCode = parseInt(functionCodeValue, 16);
    
    if (hexBaseMode) {
      // Parse values as hex strings
      slaveId = parseInt(slaveIdValue, 16);
      startAddress = parseInt(startAddressValue, 16);
      quantity = parseInt(quantityValue, 16);
    } else {
      // Parse values as decimal numbers
      slaveId = parseInt(slaveIdValue, 10);
      startAddress = parseInt(startAddressValue, 10);
      quantity = parseInt(quantityValue, 10);
    }

    // Validate parsed values
    if (isNaN(slaveId) || isNaN(functionCode) || isNaN(startAddress) || isNaN(quantity)) {
      alert('Invalid input values. Please check your entries.');
      return;
    }

    // Build Modbus frame based on connection type and function code
    let frame: number[];
    
    if (this.connectionType.startsWith('TCP')) {
      // TCP mode: Generate PDU only (no Device ID - it goes in MBAP header)
      if (functionCode === 0x0F) { // Write Multiple Coils
        const coilData = this.getCoilValuesFromInputs();
        if (!coilData) {
          alert('Please enter valid coil values for Function Code 0F');
          return;
        }
        
        const coilCount = coilData.coilCount;
        const byteCount = coilData.bytes.length;

        frame = [
          functionCode,
          (startAddress >> 8) & 0xFF,  // Start Address High
          startAddress & 0xFF,         // Start Address Low
          (coilCount >> 8) & 0xFF,     // Quantity High
          coilCount & 0xFF,            // Quantity Low
          byteCount,                   // Byte Count
          ...coilData.bytes            // Coil data bytes
        ];
      } else if (functionCode === 0x10) { // Write Multiple Registers
        const registerData = this.getRegisterValuesFromInputs(hexBaseMode);
        if (!registerData) {
          alert('Please enter valid register values for Function Code 10');
          return;
        }
        
        const registerCount = registerData.length / 2; // Each register is 2 bytes
        const byteCount = registerData.length;

        frame = [
          functionCode,
          (startAddress >> 8) & 0xFF,  // Start Address High
          startAddress & 0xFF,         // Start Address Low
          (registerCount >> 8) & 0xFF, // Quantity High
          registerCount & 0xFF,        // Quantity Low
          byteCount,                   // Byte Count
          ...registerData              // User-entered register values
        ];
      } else {
        // Standard read/write commands for TCP
        frame = [
          functionCode,
          (startAddress >> 8) & 0xFF, // High byte
          startAddress & 0xFF,        // Low byte
          (quantity >> 8) & 0xFF,     // High byte
          quantity & 0xFF             // Low byte
        ];
      }
    } else {
      // RTU mode: Include Device ID in frame
      if (functionCode === 0x0F) { // Write Multiple Coils
        const coilData = this.getCoilValuesFromInputs();
        if (!coilData) {
          alert('Please enter valid coil values for Function Code 0F');
          return;
        }
        
        const coilCount = coilData.coilCount;
        const byteCount = coilData.bytes.length;

        frame = [
          slaveId,
          functionCode,
          (startAddress >> 8) & 0xFF,  // Start Address High
          startAddress & 0xFF,         // Start Address Low
          (coilCount >> 8) & 0xFF,     // Quantity High
          coilCount & 0xFF,            // Quantity Low
          byteCount,                   // Byte Count
          ...coilData.bytes            // Coil data bytes
        ];
      } else if (functionCode === 0x10) { // Write Multiple Registers
        const registerData = this.getRegisterValuesFromInputs(hexBaseMode);
        if (!registerData) {
          alert('Please enter valid register values for Function Code 10');
          return;
        }
        
        const registerCount = registerData.length / 2; // Each register is 2 bytes
        const byteCount = registerData.length;

        frame = [
          slaveId,
          functionCode,
          (startAddress >> 8) & 0xFF,  // Start Address High
          startAddress & 0xFF,         // Start Address Low
          (registerCount >> 8) & 0xFF, // Quantity High
          registerCount & 0xFF,        // Quantity Low
          byteCount,                   // Byte Count
          ...registerData              // User-entered register values
        ];
      } else {
        // Standard read/write commands for RTU
        frame = [
          slaveId,
          functionCode,
          (startAddress >> 8) & 0xFF, // High byte
          startAddress & 0xFF,        // Low byte
          (quantity >> 8) & 0xFF,     // High byte
          quantity & 0xFF             // Low byte
        ];
      }
    }

    // Format as HEX string (CRC will be added automatically when sending)
    const hexCommand = frame.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    
    this.setManualHexInput(hexCommand);
  }

  private calculateCRC16(data: number[]): number {
    let crc = 0xFFFF;
    
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    
    return crc;
  }

  private clearCommand(): void {
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    if (manualHexInput) {
      manualHexInput.value = '';
      manualHexInput.focus();
      this.updateHexPreview();
    }
  }

  private setManualHexInput(command: string): void {
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    if (manualHexInput) {
      manualHexInput.value = command;
      manualHexInput.focus();
      this.updateHexPreview();
    }
  }

  private updateInputFieldsForHexBase(): void {
    const hexBaseModeElement = document.getElementById('hex-base-mode') as HTMLInputElement;
    if (!hexBaseModeElement) return; // Exit early if element not found
    
    const hexBaseMode = hexBaseModeElement.checked;
    const slaveIdInput = document.getElementById('slave-id') as HTMLInputElement;
    const startAddressInput = document.getElementById('start-address') as HTMLInputElement;
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;
    
    // Check if required inputs exist
    if (!slaveIdInput || !startAddressInput || !quantityInput) return;

    if (hexBaseMode) {
      // Hex mode - update placeholders and values
      slaveIdInput.placeholder = '01 (hex)';
      startAddressInput.placeholder = '0000 (hex)';
      quantityInput.placeholder = '000A (hex)';
      
      // Convert current decimal values to hex if needed
      this.convertInputValuesToHex();
    } else {
      // Decimal mode - update placeholders and values
      slaveIdInput.placeholder = '1 (decimal)';
      startAddressInput.placeholder = '0 (decimal)';
      quantityInput.placeholder = '10 (decimal)';
      
      // Convert current hex values to decimal if needed
      this.convertInputValuesToDecimal();
    }
    
    // Update data values section (register/coil inputs) to reflect hex base mode change
    this.updateDataValuesSection();
  }

  private convertInputValuesToHex(): void {
    const slaveIdInput = document.getElementById('slave-id') as HTMLInputElement;
    const startAddressInput = document.getElementById('start-address') as HTMLInputElement;
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;

    // Check if inputs exist
    if (!slaveIdInput || !startAddressInput || !quantityInput) return;

    // Convert only if values look like decimal numbers
    if (slaveIdInput.value && /^\d+$/.test(slaveIdInput.value)) {
      const decValue = parseInt(slaveIdInput.value, 10);
      if (!isNaN(decValue)) {
        slaveIdInput.value = decValue.toString(16).padStart(2, '0').toUpperCase();
      }
    }

    if (startAddressInput.value && /^\d+$/.test(startAddressInput.value)) {
      const decValue = parseInt(startAddressInput.value, 10);
      if (!isNaN(decValue)) {
        startAddressInput.value = decValue.toString(16).padStart(4, '0').toUpperCase();
      }
    }

    if (quantityInput.value && /^\d+$/.test(quantityInput.value)) {
      const decValue = parseInt(quantityInput.value, 10);
      if (!isNaN(decValue)) {
        quantityInput.value = decValue.toString(16).padStart(4, '0').toUpperCase();
      }
    }
  }

  private convertInputValuesToDecimal(): void {
    const slaveIdInput = document.getElementById('slave-id') as HTMLInputElement;
    const startAddressInput = document.getElementById('start-address') as HTMLInputElement;
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;

    // Check if inputs exist
    if (!slaveIdInput || !startAddressInput || !quantityInput) return;

    // Convert only if values look like hex strings
    if (slaveIdInput.value && /^[0-9A-Fa-f]+$/.test(slaveIdInput.value)) {
      const hexValue = parseInt(slaveIdInput.value, 16);
      if (!isNaN(hexValue)) {
        slaveIdInput.value = hexValue.toString(10);
      }
    }

    if (startAddressInput.value && /^[0-9A-Fa-f]+$/.test(startAddressInput.value)) {
      const hexValue = parseInt(startAddressInput.value, 16);
      if (!isNaN(hexValue)) {
        startAddressInput.value = hexValue.toString(10);
      }
    }

    if (quantityInput.value && /^[0-9A-Fa-f]+$/.test(quantityInput.value)) {
      const hexValue = parseInt(quantityInput.value, 16);
      if (!isNaN(hexValue)) {
        quantityInput.value = hexValue.toString(10);
      }
    }
  }


  // Detect the type of input data
  private detectInputType(input: string): 'hex' | 'ascii' | 'mixed' {
    const cleanInput = input.replace(/\s+/g, '');
    
    // Check if it's pure HEX (only 0-9, A-F, a-f)
    if (/^[0-9a-fA-F]+$/.test(cleanInput) && cleanInput.length > 0) {
      return 'hex';
    }
    
    // Check if it looks like spaced HEX (HEX bytes separated by spaces)
    const spacedHexPattern = /^([0-9a-fA-F]{1,2}\s*)+$/;
    if (spacedHexPattern.test(input.trim())) {
      return 'hex';
    }
    
    // Check if it contains mostly printable ASCII characters
    const printableChars = input.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126; // Printable ASCII range
    });
    
    if (printableChars.length / input.length > 0.7) {
      return 'ascii';
    }
    
    return 'mixed';
  }

  // Format HEX input with automatic spacing every 2 characters
  private formatHexInput(input: string): string {
    // Remove non-hex characters and all whitespace
    let cleaned = input.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    
    // Ensure even length by padding with leading zero if necessary
    if (cleaned.length % 2 !== 0) {
      cleaned = '0' + cleaned;
    }
    
    // Add space every 2 characters (1 byte)
    const formatted = cleaned.replace(/(.{2})/g, '$1 ').trim();
    
    return formatted;
  }

  // Convert ASCII text to HEX
  private asciiToHex(input: string): string {
    const bytes: string[] = [];
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      bytes.push(charCode.toString(16).padStart(2, '0').toUpperCase());
    }
    return bytes.join(' ');
  }

  // Convert mixed input (try to extract HEX and convert ASCII)
  private mixedToHex(input: string): string {
    const bytes: string[] = [];
    let i = 0;
    
    while (i < input.length) {
      // Skip whitespace
      if (/\s/.test(input[i])) {
        i++;
        continue;
      }
      
      // Try to parse as HEX byte (2 hex digits)
      if (i + 1 < input.length && 
          /[0-9a-fA-F]/.test(input[i]) && 
          /[0-9a-fA-F]/.test(input[i + 1])) {
        const hexByte = input.substring(i, i + 2);
        // Verify it's a valid hex byte
        if (/^[0-9a-fA-F]{2}$/i.test(hexByte)) {
          bytes.push(hexByte.toUpperCase());
          i += 2;
          continue;
        }
      }
      
      // Convert as ASCII character
      const charCode = input.charCodeAt(i);
      bytes.push(charCode.toString(16).padStart(2, '0').toUpperCase());
      i++;
    }
    
    return bytes.join(' ');
  }

  // Validate hex input (with padding support)
  private isValidHexInput(input: string): boolean {
    const cleanInput = input.replace(/\s+/g, '').trim();
    if (cleanInput.length === 0) return false;
    
    const hexPattern = /^[0-9a-fA-F]+$/;
    return hexPattern.test(cleanInput);
  }

  // Adjust cursor position after automatic spacing
  private adjustCursorForSpacing(originalValue: string, originalCursor: number, newValue: string): number {
    // Count hex characters before cursor position in original value
    const beforeCursor = originalValue.substring(0, originalCursor);
    const hexCharsBeforeCursor = beforeCursor.replace(/[^0-9a-fA-F]/g, '').length;
    
    // Calculate new position: hex chars + spaces added
    const spacesAdded = Math.floor(hexCharsBeforeCursor / 2);
    const newPosition = hexCharsBeforeCursor + spacesAdded;
    
    return Math.min(newPosition, newValue.length);
  }


  // Add CRC to command for RTU mode
  private addCrcToCommand(command: string): string {
    const cleanHex = command.replace(/\s+/g, '');
    const bytes: number[] = [];
    
    // Convert hex string to bytes array
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
    }
    
    // Calculate CRC16
    const crc = this.calculateCRC16(bytes);
    bytes.push(crc & 0xFF, (crc >> 8) & 0xFF);
    
    // Convert back to hex string
    return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }

  // Update hex preview with CRC calculation and input mode info
  private updateHexPreview(): void {
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
    const asciiModeCheckbox = document.getElementById('ascii-mode') as HTMLInputElement;
    const previewElement = document.getElementById('hex-preview');
    
    if (!manualHexInput || !previewElement) return;
    
    const rawInput = manualHexInput.value;
    const input = rawInput.trim();
    const isAsciiMode = asciiModeCheckbox?.checked || false;
    
    if (!input) {
      previewElement.innerHTML = `
        <span class="text-dark-text-muted">Preview:</span> 
        <span class="text-dark-text-secondary font-mono">Enter ${isAsciiMode ? 'text' : 'HEX data'} above...</span>
      `;
      return;
    }
    
    // Convert to HEX for preview
    let convertedHex: string;
    if (isAsciiMode) {
      convertedHex = this.asciiToHex(rawInput);
    } else {
      convertedHex = this.formatHexInput(rawInput);
      if (!this.isValidHexInput(convertedHex)) {
        previewElement.innerHTML = `
          <span class="text-dark-text-muted">Preview:</span> 
          <span class="text-red-400 font-mono">Invalid HEX format</span>
        `;
        return;
      }
    }
    
    let finalCommand = convertedHex;
    let protocolInfo = '';
    const typeInfo = '';
    
    if (this.connectionType === 'TCP') {
      // TCP mode: Show MBAP header will be added
      const pduBytes = convertedHex.replace(/\s+/g, '').length / 2;
      const totalBytes = 7 + pduBytes; // 7 bytes MBAP header + PDU
      protocolInfo = ` <span class="text-cyan-400">(+MBAP: ${totalBytes} bytes total)</span>`;
    } else if (autoCrcCheckbox?.checked && this.connectionType === 'RTU') {
      // RTU mode: Show CRC will be added
      finalCommand = this.addCrcToCommand(convertedHex);
      const inputBytes = convertedHex.replace(/\s+/g, '').length / 2;
      protocolInfo = ` <span class="text-green-400">(+CRC: ${inputBytes + 2} bytes total)</span>`;
    }
    
    const byteCount = finalCommand.replace(/\s+/g, '').length / 2;
    
    // Add packet analysis like in LogPanel
    const packetAnalysis = this.analyzePacketForPreview(finalCommand, this.connectionType);
    
    previewElement.innerHTML = `
      <div class="flex flex-col gap-1">
        <div>
          <span class="text-dark-text-muted">Preview:</span> 
          <span class="text-dark-text-secondary font-mono">${finalCommand}</span>${protocolInfo}
        </div>
        <div class="text-xs">
          ${this.connectionType === 'TCP' ? `<span class="text-dark-text-muted">Protocol:</span> <span class="text-cyan-400">Modbus TCP</span>` : ''}
        </div>
        ${packetAnalysis ? `
        <div class="text-xs border-t border-dark-border pt-1 mt-1">
          <span class="text-dark-text-muted">Analysis:</span>
          <div class="mt-1 p-2 bg-dark-surface rounded text-xs text-dark-text-secondary whitespace-pre-line font-mono">${packetAnalysis}</div>
        </div>
        ` : ''}
      </div>
    `;
  }

  private handleFunctionCodeChange(): void {
    const functionCodeSelect = document.getElementById('function-code') as HTMLSelectElement;
    const dataValuesSection = document.getElementById('data-values-section');
    const dataValuesLabel = document.getElementById('data-values-label');
    const addDataButton = document.getElementById('add-data-value');
    
    if (!functionCodeSelect || !dataValuesSection || !dataValuesLabel || !addDataButton) return;
    
    const selectedFC = parseInt(functionCodeSelect.value, 16);
    
    if (selectedFC === 0x0F || selectedFC === 0x10) { // Write Multiple Coils or Registers
      dataValuesSection.classList.remove('hidden');
      
      if (selectedFC === 0x0F) {
        dataValuesLabel.textContent = 'Coil Values (for FC 0F)';
        addDataButton.textContent = '+ Add Coil';
      } else {
        dataValuesLabel.textContent = 'Register Values (for FC 10)';
        addDataButton.textContent = '+ Add Register';
      }
      
      this.updateDataValuesSection();
    } else {
      dataValuesSection.classList.add('hidden');
    }
  }

  private updateDataValuesSection(): void {
    const functionCodeSelect = document.getElementById('function-code') as HTMLSelectElement;
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;
    const container = document.getElementById('data-values-container');
    
    if (!functionCodeSelect || !quantityInput || !container) return;
    
    const selectedFC = parseInt(functionCodeSelect.value, 16);
    if (selectedFC !== 0x0F && selectedFC !== 0x10) return;
    
    const hexBaseMode = (document.getElementById('hex-base-mode') as HTMLInputElement)?.checked || false;
    let quantity: number;
    
    if (hexBaseMode) {
      quantity = parseInt(quantityInput.value, 16);
    } else {
      quantity = parseInt(quantityInput.value, 10);
    }
    
    if (isNaN(quantity) || quantity <= 0) {
      container.innerHTML = '<p class="text-xs text-dark-text-muted">Enter valid quantity first</p>';
      return;
    }
    
    // Limit to reasonable number
    quantity = Math.min(quantity, selectedFC === 0x0F ? 32 : 20); // More coils allowed
    
    const isCoils = selectedFC === 0x0F;
    const labelPrefix = isCoils ? 'Coil' : 'Reg';
    const cssClass = isCoils ? 'coil-value-input' : 'register-value-input';
    
    // Preserve existing values if available
    const existingInputs = container.querySelectorAll(`.${cssClass}`) as NodeListOf<HTMLInputElement>;
    const existingValues: string[] = [];
    for (let i = 0; i < existingInputs.length; i++) {
      existingValues[i] = existingInputs[i].value;
    }
    
    // Generate data value inputs
    let html = '';
    for (let i = 0; i < quantity; i++) {
      let currentValue: string;
      let placeholder: string;
      
      if (isCoils) {
        // Coils are boolean (0 or 1) - preserve existing or use default
        currentValue = existingValues[i] || (i % 2 === 0 ? '1' : '0');
        placeholder = '1 (ON) or 0 (OFF)';
      } else {
        // Registers are 16-bit values - preserve existing or convert/default
        if (existingValues[i]) {
          // Convert existing value based on current hex base mode
          currentValue = this.convertRegisterValue(existingValues[i], !hexBaseMode, hexBaseMode);
        } else {
          // Use default value
          currentValue = hexBaseMode ? (i + 1).toString(16).padStart(4, '0').toUpperCase() : (i + 1).toString();
        }
        placeholder = hexBaseMode ? '0001 (hex)' : '1 (decimal)';
      }
      
      html += `
        <div class="flex items-center gap-2">
          <label class="text-xs text-dark-text-muted min-w-max">${labelPrefix} ${i}:</label>
          <input type="text" 
                 class="input-field flex-1 text-xs ${cssClass}" 
                 data-value-index="${i}"
                 value="${currentValue}" 
                 placeholder="${placeholder}">
          <button type="button" 
                  class="text-red-400 hover:text-red-300 text-xs px-1 remove-value-btn"
                  data-value-index="${i}">×</button>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-value-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = (e.target as HTMLElement).dataset.valueIndex;
        this.removeDataValueInput(parseInt(index || '0'));
      });
    });
  }

  private addDataValueInput(): void {
    const functionCodeSelect = document.getElementById('function-code') as HTMLSelectElement;
    const container = document.getElementById('data-values-container');
    if (!container || !functionCodeSelect) return;
    
    const selectedFC = parseInt(functionCodeSelect.value, 16);
    const isCoils = selectedFC === 0x0F;
    const maxItems = isCoils ? 32 : 20;
    const currentInputs = container.querySelectorAll(isCoils ? '.coil-value-input' : '.register-value-input');
    const nextIndex = currentInputs.length;
    
    if (nextIndex >= maxItems) {
      alert(`Maximum ${maxItems} ${isCoils ? 'coils' : 'registers'} allowed`);
      return;
    }
    
    const hexBaseMode = (document.getElementById('hex-base-mode') as HTMLInputElement)?.checked || false;
    const labelPrefix = isCoils ? 'Coil' : 'Reg';
    const cssClass = isCoils ? 'coil-value-input' : 'register-value-input';
    
    let defaultValue: string;
    let placeholder: string;
    
    if (isCoils) {
      defaultValue = nextIndex % 2 === 0 ? '1' : '0';
      placeholder = '1 (ON) or 0 (OFF)';
    } else {
      defaultValue = hexBaseMode ? (nextIndex + 1).toString(16).padStart(4, '0').toUpperCase() : (nextIndex + 1).toString();
      placeholder = hexBaseMode ? '0001 (hex)' : '1 (decimal)';
    }
    
    const newInput = document.createElement('div');
    newInput.className = 'flex items-center gap-2';
    newInput.innerHTML = `
      <label class="text-xs text-dark-text-muted min-w-max">${labelPrefix} ${nextIndex}:</label>
      <input type="text" 
             class="input-field flex-1 text-xs ${cssClass}" 
             data-value-index="${nextIndex}"
             value="${defaultValue}" 
             placeholder="${placeholder}">
      <button type="button" 
              class="text-red-400 hover:text-red-300 text-xs px-1 remove-value-btn"
              data-value-index="${nextIndex}">×</button>
    `;
    
    container.appendChild(newInput);
    
    // Add event listener for remove button
    const removeBtn = newInput.querySelector('.remove-value-btn');
    removeBtn?.addEventListener('click', (e) => {
      const index = (e.target as HTMLElement).dataset.valueIndex;
      this.removeDataValueInput(parseInt(index || '0'));
    });
    
    // Update quantity to match data count
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;
    if (quantityInput) {
      const hexBaseMode = (document.getElementById('hex-base-mode') as HTMLInputElement)?.checked || false;
      const newQuantity = nextIndex + 1;
      quantityInput.value = hexBaseMode ? newQuantity.toString(16).padStart(4, '0').toUpperCase() : newQuantity.toString();
    }
  }

  private removeDataValueInput(indexToRemove: number): void {
    const functionCodeSelect = document.getElementById('function-code') as HTMLSelectElement;
    const container = document.getElementById('data-values-container');
    if (!container || !functionCodeSelect) return;
    
    const selectedFC = parseInt(functionCodeSelect.value, 16);
    const isCoils = selectedFC === 0x0F;
    const cssClass = isCoils ? '.coil-value-input' : '.register-value-input';
    const labelPrefix = isCoils ? 'Coil' : 'Reg';
    const fcName = isCoils ? 'FC 0F' : 'FC 10';
    
    const inputs = container.querySelectorAll(cssClass);
    if (inputs.length <= 1) {
      alert(`At least one ${isCoils ? 'coil' : 'register'} is required for ${fcName}`);
      return;
    }
    
    // Remove the specific input
    const inputToRemove = container.querySelector(`[data-value-index="${indexToRemove}"]`)?.parentElement;
    if (inputToRemove) {
      inputToRemove.remove();
    }
    
    // Re-index remaining inputs
    const remainingInputs = container.querySelectorAll(cssClass);
    remainingInputs.forEach((input, index) => {
      const inputElement = input as HTMLInputElement;
      const parentDiv = inputElement.parentElement;
      
      inputElement.dataset.valueIndex = index.toString();
      
      const label = parentDiv?.querySelector('label');
      if (label) {
        label.textContent = `${labelPrefix} ${index}:`;
      }
      
      const removeBtn = parentDiv?.querySelector('.remove-value-btn') as HTMLElement;
      if (removeBtn) {
        removeBtn.dataset.valueIndex = index.toString();
      }
    });
    
    // Update quantity to match data count
    const quantityInput = document.getElementById('quantity') as HTMLInputElement;
    if (quantityInput) {
      const hexBaseMode = (document.getElementById('hex-base-mode') as HTMLInputElement)?.checked || false;
      const newQuantity = remainingInputs.length;
      quantityInput.value = hexBaseMode ? newQuantity.toString(16).padStart(4, '0').toUpperCase() : newQuantity.toString();
    }
  }

  private convertRegisterValue(value: string, fromHex: boolean, toHex: boolean): string {
    if (fromHex === toHex) {
      return value; // No conversion needed
    }
    
    try {
      let numValue: number;
      
      if (fromHex) {
        // Converting from hex to decimal
        numValue = parseInt(value, 16);
        if (isNaN(numValue)) return value; // Return original if invalid
        return numValue.toString(10);
      } else {
        // Converting from decimal to hex
        numValue = parseInt(value, 10);
        if (isNaN(numValue)) return value; // Return original if invalid
        return numValue.toString(16).padStart(4, '0').toUpperCase();
      }
    } catch (error) {
      return value; // Return original value if conversion fails
    }
  }

  private getCoilValuesFromInputs(): { coilCount: number; bytes: number[] } | null {
    const coilInputs = document.querySelectorAll('.coil-value-input') as NodeListOf<HTMLInputElement>;
    
    if (coilInputs.length === 0) {
      return null;
    }
    
    const coilValues: boolean[] = [];
    
    for (const input of coilInputs) {
      const value = input.value.trim();
      if (!value) {
        return null; // Empty value
      }
      
      const coilValue = parseInt(value, 10);
      if (isNaN(coilValue) || (coilValue !== 0 && coilValue !== 1)) {
        return null; // Invalid coil value (must be 0 or 1)
      }
      
      coilValues.push(coilValue === 1);
    }
    
    // Pack coils into bytes (8 coils per byte, LSB first)
    const bytes: number[] = [];
    for (let i = 0; i < coilValues.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && (i + j) < coilValues.length; j++) {
        if (coilValues[i + j]) {
          byte |= (1 << j); // Set bit j if coil is ON
        }
      }
      bytes.push(byte);
    }
    
    return {
      coilCount: coilValues.length,
      bytes: bytes
    };
  }

  private getRegisterValuesFromInputs(hexBaseMode: boolean): number[] | null {
    const registerInputs = document.querySelectorAll('.register-value-input') as NodeListOf<HTMLInputElement>;
    
    if (registerInputs.length === 0) {
      return null;
    }
    
    const registerData: number[] = [];
    
    for (const input of registerInputs) {
      const value = input.value.trim();
      if (!value) {
        return null; // Empty value
      }
      
      let regValue: number;
      
      if (hexBaseMode) {
        regValue = parseInt(value, 16);
      } else {
        regValue = parseInt(value, 10);
      }
      
      if (isNaN(regValue) || regValue < 0 || regValue > 0xFFFF) {
        return null; // Invalid value
      }
      
      // Convert to 2 bytes (high byte, low byte)
      registerData.push((regValue >> 8) & 0xFF, regValue & 0xFF);
    }
    
    return registerData;
  }

  private toggleRepeatMode(): void {
    if (this.isRepeating) {
      this.stopRepeatMode();
    } else {
      this.startRepeatMode();
    }
  }


  private startRepeatMode(): void {
    const checkedCommands = this.getCheckedCommands();
    if (checkedCommands.length === 0) {
      alert('Please check at least one command for periodic sending');
      return;
    }

    this.isRepeating = true;
    this.updateToggleButton();
    this.updateIntervalInputState(); // Disable interval input during repeat mode
    
    // Initialize precise timing
    this.startTime = performance.now();
    this.expectedNextTime = this.startTime + this.repeatInterval;
    
    // Notify App that repeat mode started
    if (this.onRepeatModeChanged) {
      this.onRepeatModeChanged(true);
    }
    
    let currentIndex = 0;
    
    const sendNextCommand = () => {
      if (!this.isRepeating) return;
      
      const checkedCommands = this.getCheckedCommands();
      if (checkedCommands.length === 0) {
        this.stopRepeatMode();
        return;
      }
      
      const now = performance.now();
      
      // Send current command
      const command = checkedCommands[currentIndex];
      this.sendCommandDirectlyWithoutHistory(command);
      
      // Move to next command
      currentIndex = (currentIndex + 1) % checkedCommands.length;
      
      // Calculate drift compensation
      const drift = now - this.expectedNextTime;
      const nextDelay = Math.max(0, this.repeatInterval - drift);
      
      // Update expected next time
      this.expectedNextTime = now + nextDelay;
      
      // Schedule next send with drift compensation
      this.repeatTimer = setTimeout(sendNextCommand, nextDelay);
    };
    
    // Start immediately
    sendNextCommand();
  }

  private stopRepeatMode(): void {
    this.isRepeating = false;
    if (this.repeatTimer) {
      clearTimeout(this.repeatTimer);
      this.repeatTimer = null;
    }
    
    // Reset timing variables
    this.startTime = 0;
    this.expectedNextTime = 0;
    
    this.updateToggleButton();
    this.updateIntervalInputState(); // Enable interval input when stopped
    
    // Notify App that repeat mode stopped (to flush pending logs)
    if (this.onRepeatModeChanged) {
      this.onRepeatModeChanged(false);
    }
  }

  private updateToggleButton(): void {
    const toggleButton = document.getElementById('toggle-repeat') as HTMLButtonElement;
    if (toggleButton) {
      toggleButton.textContent = this.isRepeating ? 'Stop' : 'Start';
      toggleButton.className = this.isRepeating ? 
        'btn-secondary text-xs py-1 px-2 bg-red-600 hover:bg-red-700 text-white' : 
        'btn-secondary text-xs py-1 px-2';
    }
  }

  private updateIntervalInputState(): void {
    const repeatIntervalInput = document.getElementById('repeat-interval') as HTMLInputElement;
    if (repeatIntervalInput) {
      // Disable input during repeat mode, enable when stopped
      repeatIntervalInput.disabled = this.isRepeating;
      
      // Visual feedback: reduce opacity when disabled
      if (this.isRepeating) {
        repeatIntervalInput.style.opacity = '0.5';
        repeatIntervalInput.style.cursor = 'not-allowed';
      } else {
        repeatIntervalInput.style.opacity = '1';
        repeatIntervalInput.style.cursor = '';
      }
    }
  }

  private getCheckedCommands(): string[] {
    // Filter checkedCommands to only include commands that are still in recentCommands
    const validCheckedCommands = Array.from(this.checkedCommands).filter(cmd => 
      this.recentCommands.includes(cmd)
    );
    
    // Update checkedCommands set to remove invalid commands
    this.checkedCommands = new Set(validCheckedCommands);
    
    return validCheckedCommands;
  }

  private hasCheckedCommands(): boolean {
    return this.getCheckedCommands().length > 0;
  }

  private analyzePacketForPreview(hexData: string, connectionType: 'RTU' | 'TCP' | 'TCP_NATIVE'): string | null {
    const cleaned = hexData.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 2) return null;
    
    if (connectionType.startsWith('TCP')) {
      // For TCP preview, we're analyzing the PDU only (before MBAP header is added)
      return this.analyzePduForPreview(cleaned, 'TCP');
    } else {
      return this.analyzeRtuPacketForPreview(cleaned);
    }
  }

  private analyzePduForPreview(hexData: string, protocol: 'TCP' | 'RTU'): string | null {
    if (hexData.length < 2) return null;
    
    const pduAnalysis = this.analyzeModbusPduForPreview(hexData);
    
    if (protocol === 'TCP') {
      let result = `🌐 MODBUS TCP PDU (will be wrapped in MBAP header)\n`;
      if (pduAnalysis) {
        result += `\n${pduAnalysis}`;
      }
      return result;
    } else {
      return pduAnalysis;
    }
  }

  private analyzeTcpPacketForPreview(hexData: string): string | null {
    if (hexData.length < 14) return null;
    
    try {
      const transactionId = hexData.substring(0, 4);
      const protocolId = hexData.substring(4, 8);
      const length = hexData.substring(8, 12);
      const unitId = hexData.substring(12, 14);
      const pdu = hexData.substring(14);
      
      const pduAnalysis = this.analyzeModbusPduForPreview(pdu);
      
      let result = `🌐 MODBUS TCP PACKET\n`;
      result += `Transaction ID: 0x${transactionId} (${parseInt(transactionId, 16)})\n`;
      result += `Protocol ID: 0x${protocolId} (${parseInt(protocolId, 16)})\n`;
      result += `Length: 0x${length} (${parseInt(length, 16)} bytes)\n`;
      result += `Unit ID: 0x${unitId} (${parseInt(unitId, 16)})`;
      
      if (pduAnalysis) {
        result += `\n\n${pduAnalysis}`;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private analyzeRtuPacketForPreview(hexData: string): string | null {
    if (hexData.length < 8) return null;
    
    try {
      const deviceId = hexData.substring(0, 2);
      const pdu = hexData.substring(2, hexData.length - 4);
      const crc = hexData.substring(hexData.length - 4);
      
      const pduAnalysis = this.analyzeModbusPduForPreview(pdu);
      
      let result = `📡 MODBUS RTU PACKET\n`;
      result += `Device ID: 0x${deviceId} (${parseInt(deviceId, 16)})\n`;
      result += `CRC: 0x${crc}`;
      
      if (pduAnalysis) {
        result += `\n\n${pduAnalysis}`;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  private analyzeModbusPduForPreview(pdu: string): string | null {
    if (pdu.length < 2) return null;
    
    const functionCode = pdu.substring(0, 2);
    const functionCodeInt = parseInt(functionCode, 16);
    
    switch (functionCodeInt) {
      case 0x01:
        return this.analyzeReadCoilsForPreview(pdu);
      case 0x02:
        return this.analyzeReadDiscreteInputsForPreview(pdu);
      case 0x03:
        return this.analyzeReadHoldingRegistersForPreview(pdu);
      case 0x04:
        return this.analyzeReadInputRegistersForPreview(pdu);
      case 0x06:
        return this.analyzeWriteSingleRegisterForPreview(pdu);
      case 0x0F:
        return this.analyzeWriteMultipleCoilsForPreview(pdu);
      case 0x10:
        return this.analyzeWriteMultipleRegistersForPreview(pdu);
      default:
        return `📋 MODBUS PDU\nFunction Code: 0x${functionCode} (${functionCodeInt}) - Unknown/Unsupported`;
    }
  }

  private analyzeReadCoilsForPreview(pdu: string): string {
    const startAddr = pdu.substring(2, 6);
    const quantity = pdu.substring(6, 10);
    
    return `📖 READ COILS (0x01) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} coils)`;
  }

  private analyzeReadDiscreteInputsForPreview(pdu: string): string {
    const startAddr = pdu.substring(2, 6);
    const quantity = pdu.substring(6, 10);
    
    return `📖 READ DISCRETE INPUTS (0x02) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} inputs)`;
  }

  private analyzeReadHoldingRegistersForPreview(pdu: string): string {
    const startAddr = pdu.substring(2, 6);
    const quantity = pdu.substring(6, 10);
    
    return `📊 READ HOLDING REGISTERS (0x03) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} registers)`;
  }

  private analyzeReadInputRegistersForPreview(pdu: string): string {
    const startAddr = pdu.substring(2, 6);
    const quantity = pdu.substring(6, 10);
    
    return `📊 READ INPUT REGISTERS (0x04) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} registers)`;
  }

  private analyzeWriteSingleRegisterForPreview(pdu: string): string {
    const regAddr = pdu.substring(2, 6);
    const regValue = pdu.substring(6, 10);
    
    return `✏️ WRITE SINGLE REGISTER (0x06)\nRegister Address: 0x${regAddr} (${parseInt(regAddr, 16)})\nRegister Value: 0x${regValue} (${parseInt(regValue, 16)})`;
  }

  private analyzeWriteMultipleCoilsForPreview(pdu: string): string {
    if (pdu.length >= 12) {
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
      const byteCount = pdu.substring(10, 12);
      const data = pdu.substring(12);
      
      let result = `🔘 WRITE MULTIPLE COILS (0x0F) - REQUEST\nStart Address: 0x${startAddr} (${parseInt(startAddr, 16)})\nQuantity: 0x${quantity} (${parseInt(quantity, 16)} coils)\nByte Count: 0x${byteCount} (${parseInt(byteCount, 16)} bytes)\n`;
      
      // Parse coil data bytes
      const quantityInt = parseInt(quantity, 16);
      let coilIndex = 0;
      for (let i = 0; i < data.length; i += 2) {
        if (i + 2 <= data.length && coilIndex < quantityInt) {
          const byteHex = data.substring(i, i + 2);
          const byteValue = parseInt(byteHex, 16);
          
          // Decode each bit in the byte
          for (let bit = 0; bit < 8 && coilIndex < quantityInt; bit++) {
            const coilState = (byteValue & (1 << bit)) !== 0 ? 'ON' : 'OFF';
            result += `Coil ${coilIndex}: ${coilState}\n`;
            coilIndex++;
          }
        }
      }
      
      return result.trim();
    }
    return `🔘 WRITE MULTIPLE COILS (0x0F)`;
  }

  private analyzeWriteMultipleRegistersForPreview(pdu: string): string {
    if (pdu.length >= 12) {
      const startAddr = pdu.substring(2, 6);
      const quantity = pdu.substring(6, 10);
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
    return `✏️ WRITE MULTIPLE REGISTERS (0x10)`;
  }

  private addToHistory(command: string): void {
    // Remove duplicates and add to front
    this.commandHistory = this.commandHistory.filter(cmd => cmd !== command);
    this.commandHistory.push(command);
    
    // Keep only last 10 commands
    if (this.commandHistory.length > 10) {
      this.commandHistory = this.commandHistory.slice(-10);
    }
    
    this.historyIndex = -1;
    this.updateHistoryDisplay();
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;
    
    this.historyIndex += direction;
    
    if (this.historyIndex < -1) {
      this.historyIndex = -1;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length - 1;
    }
    
    const manualHexInput = document.getElementById('manual-hex-input') as HTMLTextAreaElement;
    if (manualHexInput) {
      if (this.historyIndex === -1) {
        manualHexInput.value = '';
      } else {
        // Remove CRC when loading from history for editing
        let historyCommand = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        
        // If auto CRC is enabled and this looks like a command with CRC, remove the last 2 bytes
        const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
        if (autoCrcCheckbox?.checked && this.connectionType === 'RTU') {
          const bytes = historyCommand.replace(/\s+/g, '');
          if (bytes.length >= 8) { // At least 4 bytes (2 for data + 2 for CRC)
            historyCommand = bytes.substring(0, bytes.length - 4).replace(/(.{2})/g, '$1 ').trim();
          }
        }
        
        manualHexInput.value = historyCommand;
      }
      this.updateHexPreview();
    }
  }

  private updateHistoryDisplay(): void {
    const historyContainer = document.getElementById('command-history');
    if (historyContainer) {
      historyContainer.innerHTML = this.renderCommandHistory();
      this.attachHistoryListeners();
    }
  }

  // Public method to update connection status
  updateConnectionStatus(type: 'RTU' | 'TCP' | 'TCP_NATIVE', connected: boolean): void {
    // Stop repeat mode if connection is lost
    if (!connected && this.isRepeating) {
      console.log('Connection lost - stopping repeat mode');
      this.stopRepeatMode();
    }
    
    // Prevent duplicate execution - only update if connection type actually changed
    if (this.lastConnectionType === type) {
      return;
    }
    
    this.lastConnectionType = type;
    this.connectionType = type;
    this.updateAutoCrcForConnectionType(type);
    this.updateQuickCommandsForConnectionType(type);
    this.updateHexPreview(); // Refresh preview with new connection type
  }

  // Update quick commands and mode info based on connection type
  updateQuickCommandsForConnectionType(type: 'RTU' | 'TCP' | 'TCP_NATIVE'): void {
    const quickCommandsContainer = document.getElementById('quick-commands');
    const modeInfoContainer = document.getElementById('mode-info');
    
    if (quickCommandsContainer) {
      quickCommandsContainer.innerHTML = this.renderQuickCommands();
      // Reattach event listeners for new buttons
      this.attachQuickCommandListeners();
    }
    
    if (modeInfoContainer) {
      modeInfoContainer.innerHTML = this.renderModeInfo();
    }
    
    // Also update history display to ensure listeners are attached
    this.updateHistoryDisplay();
    
    console.log(`Quick commands updated for ${type} mode`);
  }

  // Attach event listeners to quick command buttons
  private attachQuickCommandListeners(): void {
    document.querySelectorAll('[data-command]').forEach(button => {
      button.addEventListener('click', (e) => {
        const command = (e.target as HTMLElement).dataset.command;
        if (command) {
          // Quick command examples don't include CRC, so set them directly
          // The CRC will be added automatically when sending if Auto CRC is enabled
          this.setManualHexInput(command);
        }
      });
    });
  }


  // Render quick command buttons based on connection type
  private renderQuickCommands(): string {
    if (this.connectionType.startsWith('TCP')) {
      // TCP mode: No Device ID (Unit ID goes in MBAP header)
      return `
        <button class="btn-secondary text-sm text-left" data-command="03 00 00 00 0A">
          📖 Read Holding Registers (0-9)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="04 00 00 00 05">
          📊 Read Input Registers (0-4)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="01 00 00 00 08">
          🔌 Read Coils (0-7)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="Hello World">
          📝 ASCII Text Example
        </button>
      `;
    } else {
      // RTU mode: Include Device ID
      return `
        <button class="btn-secondary text-sm text-left" data-command="01 03 00 00 00 0A">
          📖 Read Holding Registers (0-9)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="01 04 00 00 00 05">
          📊 Read Input Registers (0-4)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="01 01 00 00 00 08">
          🔌 Read Coils (0-7)
        </button>
        <button class="btn-secondary text-sm text-left" data-command="Hello World">
          📝 ASCII Text Example
        </button>
      `;
    }
  }

  // Render mode-specific information
  private renderModeInfo(): string {
    if (this.connectionType.startsWith('TCP')) {
      return `
        💡 <strong>TCP Mode:</strong> MBAP header (includes Unit ID) automatically added<br>
        💡 Preview show PDU only (Device ID handled by MBAP header)<br>
      `;
    } else {
      return `
        💡 <strong>RTU Mode:</strong> Device ID + Function Code + Data<br>
        💡 CRC automatically added when Auto CRC is enabled<br>
      `;
    }
  }

  // Add command to recent commands list
  private addToRecentCommands(command: string): void {
    // Remove if already exists
    const existingIndex = this.recentCommands.indexOf(command);
    if (existingIndex !== -1) {
      this.recentCommands.splice(existingIndex, 1);
    }
    
    // Add to beginning
    this.recentCommands.unshift(command);
    
    // Keep only last 10 commands
    if (this.recentCommands.length > this.maxRecentCommands) {
      this.recentCommands = this.recentCommands.slice(0, this.maxRecentCommands);
    }
    
    // Update UI
    this.updateHistoryDisplay();
  }

  // Remove command from recent commands
  private removeFromRecentCommands(index: number): void {
    if (index >= 0 && index < this.recentCommands.length) {
      const commandToRemove = this.recentCommands[index];
      this.recentCommands.splice(index, 1);
      
      // Also remove from checked commands if it was checked
      this.checkedCommands.delete(commandToRemove);
      
      this.updateHistoryDisplay();
    }
  }



  // Auto-configure CRC setting based on connection type
  private updateAutoCrcForConnectionType(type: 'RTU' | 'TCP' | 'TCP_NATIVE'): void {
    const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
    if (autoCrcCheckbox) {
      if (type === 'RTU') {
        // RTU mode: Enable Auto CRC (Modbus RTU requires CRC)
        autoCrcCheckbox.checked = true;
        autoCrcCheckbox.disabled = false;
        console.log('Auto CRC enabled for Modbus RTU mode');
      } else if (type.startsWith('TCP')) {
        // TCP mode: Disable Auto CRC (Modbus TCP uses MBAP header, no CRC needed)
        autoCrcCheckbox.checked = false;
        autoCrcCheckbox.disabled = true;
        console.log('Auto CRC disabled for Modbus TCP mode (MBAP header used instead)');
      }
      
      // Trigger change event to update preview
      autoCrcCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Handle language change - re-render the panel
   */
  onLanguageChange(): void {
    const container = document.querySelector('[id*="command-content"]') as HTMLElement;
    if (!container) return;

    // Re-render the panel content
    container.innerHTML = this.render();
    
    // Re-attach event listeners
    this.attachEventListeners();
    
    // Restore current state
    this.updateConnectionStatus(this.connectionType, this.connectionType !== 'RTU');
  }
}