export class CommandPanel {
  private onCommandSend: (command: string) => void;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private connectionType: 'RTU' | 'TCP' = 'RTU';
  private lastConnectionType: 'RTU' | 'TCP' | null = null;
  private recentCommands: string[] = [];
  private maxRecentCommands = 10;

  constructor(onCommandSend: (command: string) => void) {
    this.onCommandSend = onCommandSend;
  }

  mount(container: HTMLElement): void {
    container.innerHTML = this.render();
    this.attachEventListeners();
    // Apply initial AutoCRC setting based on current connection type
    this.updateAutoCrcForConnectionType(this.connectionType);
  }

  private render(): string {
    return `
      <div class="h-full flex flex-col space-y-4">
        <!-- Quick Commands -->
        <div>
          <h3 class="text-sm font-medium text-dark-text-secondary mb-3">Quick Commands & Examples</h3>
          <div class="grid grid-cols-1 gap-2" id="quick-commands">
            ${this.renderQuickCommands()}
          </div>
          <div class="text-xs text-dark-text-muted mt-2" id="mode-info">
            ${this.renderModeInfo()}
          </div>
        </div>

        <!-- Manual Command Input -->
        <div class="flex-1 flex flex-col">
          <h3 class="text-sm font-medium text-dark-text-secondary mb-3">Manual Command</h3>
          
          <div class="flex-1 flex flex-col space-y-3">
            <!-- Manual HEX Input -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-dark-text-muted">
                  Manual Input
                </label>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" id="ascii-mode" class="rounded border-dark-border bg-dark-surface">
                    <span class="text-dark-text-muted">ASCII Mode</span>
                  </label>
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" id="auto-crc" checked class="rounded border-dark-border bg-dark-surface">
                    <span class="text-dark-text-muted">Auto CRC (RTU)</span>
                  </label>
                </div>
              </div>
              <textarea 
                id="manual-hex-input"
                class="input-field w-full h-20 font-mono text-sm resize-none"
                placeholder="Enter Modbus PDU data:&#10;• HEX Mode: 01 03 00 00 00 0A (MBAP header auto-added for TCP)&#10;• ASCII Mode: Hello World&#10;Toggle ASCII Mode checkbox for text input"
              ></textarea>
              <div class="text-xs text-blue-400 mt-1">
                💡 TCP Mode: MBAP header (Transaction ID + Protocol ID + Length + Unit ID) automatically added
              </div>
              <div class="text-xs mt-1" id="hex-preview">
                <span class="text-dark-text-muted">Preview:</span> 
                <span class="text-dark-text-secondary font-mono">Enter data above (toggle ASCII Mode for text input)...</span>
              </div>
            </div>

            <!-- Command Builder -->
            <div class="border-t border-dark-border pt-3">
              <h4 class="text-xs font-medium text-dark-text-muted mb-2">Command Builder</h4>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">Slave ID</label>
                  <input type="number" id="slave-id" class="input-field w-full text-sm" value="1" min="1" max="247">
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">Function Code</label>
                  <select id="function-code" class="input-field w-full text-sm">
                    <option value="01">01 - Read Coils</option>
                    <option value="02">02 - Read Discrete Inputs</option>
                    <option value="03" selected>03 - Read Holding Registers</option>
                    <option value="04">04 - Read Input Registers</option>
                    <option value="05">05 - Write Single Coil</option>
                    <option value="06">06 - Write Single Register</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">Start Address</label>
                  <input type="number" id="start-address" class="input-field w-full text-sm" value="0" min="0" max="65535">
                </div>
                <div>
                  <label class="block text-xs text-dark-text-muted mb-1">Quantity/Value</label>
                  <input type="number" id="quantity" class="input-field w-full text-sm" value="1" min="1" max="65535">
                </div>
              </div>
              <button class="btn-secondary w-full mt-2 text-sm" id="build-command">
                Build Command
              </button>
            </div>

            <!-- Send Controls -->
            <div class="flex gap-2 pt-3 border-t border-dark-border mt-auto">
              <button class="btn-primary flex-1" id="send-command">
                Send Command
              </button>
              <button class="btn-secondary" id="clear-command">
                Clear
              </button>
            </div>
          </div>
        </div>

        <!-- Command History -->
        <div class="border-t border-dark-border pt-3">
          <h3 class="text-sm font-medium text-dark-text-secondary mb-2">Recent Commands (Max 10)</h3>
          <div class="space-y-1 max-h-32 overflow-y-auto scrollbar-thin" id="command-history">
            ${this.renderCommandHistory()}
          </div>
        </div>
      </div>
    `;
  }

  private renderCommandHistory(): string {
    if (this.recentCommands.length === 0) {
      return '<p class="text-xs text-dark-text-muted text-center py-2">No recent commands yet</p>';
    }

    return this.recentCommands.map((cmd, index) => `
      <div class="flex items-center gap-2 p-1 bg-dark-surface rounded border border-dark-border hover:bg-dark-panel transition-colors">
        <input 
          type="checkbox" 
          id="repeat-${index}" 
          class="rounded border-dark-border bg-dark-surface flex-shrink-0"
          data-repeat-command="${cmd}"
          title="Enable for periodic repeat sending"
        >
        <button 
          class="flex-1 text-left text-xs font-mono text-dark-text-primary hover:text-blue-400 transition-colors min-w-0 truncate"
          data-history-command="${cmd}"
          title="Single click: Load to input field | Double click: Send directly"
        >
          ${cmd}
        </button>
        <button 
          class="text-xs text-red-400 hover:text-red-300 px-1 flex-shrink-0"
          data-remove-history="${index}"
          title="Remove from recent commands"
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
    // Single click to use history command (set in input field)
    document.querySelectorAll('[data-history-command]').forEach(button => {
      button.addEventListener('click', (e) => {
        const command = (e.target as HTMLElement).dataset.historyCommand;
        if (command) {
          this.setManualHexInput(command);
        }
      });

      // Double click to send history command directly
      button.addEventListener('dblclick', (e) => {
        const rawInput = (e.target as HTMLElement).dataset.historyCommand;
        if (rawInput) {
          // Send command directly without setting input field
          this.sendCommandDirectly(rawInput);
        }
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

    // Handle repeat checkboxes (for future periodic sending feature)
    document.querySelectorAll('[data-repeat-command]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const command = (e.target as HTMLInputElement).dataset.repeatCommand;
        const isChecked = (e.target as HTMLInputElement).checked;
        console.log(`Repeat command ${isChecked ? 'enabled' : 'disabled'} for: ${command}`);
        // TODO: Implement periodic sending logic here
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

    // Add CRC automatically for RTU mode if enabled
    const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
    if (autoCrcCheckbox?.checked && this.connectionType === 'RTU') {
      command = this.addCrcToCommand(command);
    }

    // Add to recent commands (store the original input for reuse)
    this.addToRecentCommands(rawInput);
    
    // Send command
    this.onCommandSend(command);
  }

  private buildCommand(): void {
    const slaveId = parseInt((document.getElementById('slave-id') as HTMLInputElement).value);
    const functionCode = parseInt((document.getElementById('function-code') as HTMLSelectElement).value);
    const startAddress = parseInt((document.getElementById('start-address') as HTMLInputElement).value);
    const quantity = parseInt((document.getElementById('quantity') as HTMLInputElement).value);

    // Build basic Modbus RTU frame (without CRC for manual input)
    const frame = [
      slaveId,
      functionCode,
      (startAddress >> 8) & 0xFF, // High byte
      startAddress & 0xFF,        // Low byte
      (quantity >> 8) & 0xFF,     // High byte
      quantity & 0xFF             // Low byte
    ];

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
    const typeInfo = isAsciiMode ? ` <span class="text-blue-400">[ASCII→HEX]</span>` : ` <span class="text-green-400">[HEX]</span>`;
    
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
    
    previewElement.innerHTML = `
      <div class="flex flex-col gap-1">
        <div>
          <span class="text-dark-text-muted">Preview:</span> 
          <span class="text-dark-text-secondary font-mono">${finalCommand}</span>${protocolInfo}
        </div>
        <div class="text-xs">
          <span class="text-dark-text-muted">Mode:</span>${typeInfo}
          <span class="text-dark-text-muted ml-2">PDU Size:</span> 
          <span class="text-dark-text-secondary">${byteCount} bytes</span>
          ${this.connectionType === 'TCP' ? `<span class="text-dark-text-muted ml-2">Protocol:</span> <span class="text-cyan-400">Modbus TCP</span>` : ''}
        </div>
      </div>
    `;
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
  updateConnectionStatus(type: 'RTU' | 'TCP', connected: boolean): void {
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
  private updateQuickCommandsForConnectionType(type: 'RTU' | 'TCP'): void {
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
    if (this.connectionType === 'TCP') {
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
    if (this.connectionType === 'TCP') {
      return `
        💡 <strong>TCP Mode:</strong> MBAP header (includes Unit ID) automatically added<br>
        💡 Examples show PDU only (Device ID handled by MBAP header)<br>
        💡 Try pasting: "Hello", "03000000A", or any clipboard text
      `;
    } else {
      return `
        💡 <strong>RTU Mode:</strong> Device ID + Function Code + Data<br>
        💡 CRC automatically added when Auto CRC is enabled<br>
        💡 Try pasting: "Hello", "01030000000A", or any clipboard text
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
      this.recentCommands.splice(index, 1);
      this.updateHistoryDisplay();
    }
  }



  // Auto-configure CRC setting based on connection type
  private updateAutoCrcForConnectionType(type: 'RTU' | 'TCP'): void {
    const autoCrcCheckbox = document.getElementById('auto-crc') as HTMLInputElement;
    if (autoCrcCheckbox) {
      if (type === 'RTU') {
        // RTU mode: Enable Auto CRC (Modbus RTU requires CRC)
        autoCrcCheckbox.checked = true;
        console.log('Auto CRC enabled for Modbus RTU mode');
      } else if (type === 'TCP') {
        // TCP mode: Disable Auto CRC (Modbus TCP uses MBAP header, no CRC needed)
        autoCrcCheckbox.checked = false;
        console.log('Auto CRC disabled for Modbus TCP mode (MBAP header used instead)');
      }
      
      // Trigger change event to update preview
      autoCrcCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}