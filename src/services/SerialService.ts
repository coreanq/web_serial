import { SerialPort, SerialOptions } from '../types';

export class SerialService {
  private currentPort: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isDisconnecting = false;

  // Check if Web Serial API is supported
  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  // Request user to select a serial port
  async requestPort(filters?: Array<{ usbVendorId?: number; usbProductId?: number }>): Promise<SerialPort> {
    if (!SerialService.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    try {
      const port = await navigator.serial.requestPort({
        filters: filters || []
      });
      return port;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        throw new Error('No serial port was selected');
      }
      throw new Error(`Failed to request serial port: ${error}`);
    }
  }

  // Get previously granted serial ports
  async getGrantedPorts(): Promise<SerialPort[]> {
    if (!SerialService.isSupported()) {
      return [];
    }

    try {
      return await navigator.serial.getPorts();
    } catch (error) {
      console.error('Failed to get granted ports:', error);
      return [];
    }
  }

  // Connect to a serial port
  async connect(port: SerialPort, options: SerialOptions): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      throw new Error('Connection already in progress. Please wait for the current connection attempt to complete.');
    }

    // If we're already connected to the same port, just return
    if (this.isConnected && this.currentPort === port) {
      return;
    }

    // If we're connected to a different port, disconnect first
    if (this.isConnected && this.currentPort !== port) {
      await this.disconnect();
    }

    this.isConnecting = true;

    try {
      // Check if the port is already open
      const isPortOpen = port.readable !== null || port.writable !== null;
      
      if (!isPortOpen) {
        await port.open(options);
      }
      
      this.currentPort = port;
      this.isConnected = true;

      // Set up readers and writers
      if (port.readable && !this.reader) {
        this.reader = port.readable.getReader();
      }
      if (port.writable && !this.writer) {
        this.writer = port.writable.getWriter();
      }

    } catch (error) {
      this.currentPort = null;
      this.isConnected = false;
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          if (error.message.includes('already open')) {
            throw new Error('Port is already open. Please close it first or refresh the page.');
          } else if (error.message.includes('already in progress')) {
            throw new Error('Connection already in progress. Please wait a moment and try again.');
          }
        } else if (error.name === 'NetworkError') {
          throw new Error('Failed to open port. The device may be disconnected or in use by another application.');
        }
        throw new Error(`Failed to connect to serial port: ${error.message}`);
      }
      throw new Error(`Failed to connect to serial port: ${error}`);
    } finally {
      this.isConnecting = false;
    }
  }

  // Disconnect from the current serial port
  async disconnect(): Promise<void> {
    // Prevent multiple simultaneous disconnect attempts
    if (this.isDisconnecting) {
      return;
    }

    // Set disconnecting state immediately
    this.isDisconnecting = true;
    this.isConnecting = false;

    if (!this.currentPort) {
      this.isConnected = false;
      this.isDisconnecting = false;
      return;
    }

    try {
      // Step 1: Cancel and release reader first
      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch (e) {
          // Reader might already be cancelled, ignore
        }
        
        try {
          this.reader.releaseLock();
        } catch (e) {
          // Lock might already be released, ignore
        }
        
        this.reader = null;
      }

      // Step 2: Close writer if it exists and is not already closed
      if (this.writer) {
        let writerClosed = false;
        
        try {
          // Check if writer is already closed by trying to get ready state
          await this.writer.ready;
          // If we get here, writer is still active, so close it
          await this.writer.close();
          writerClosed = true;
        } catch (e) {
          if (!writerClosed) {
            try {
              // If close failed, try to abort
              await this.writer.abort();
            } catch (abortError) {
              // Both close and abort failed, writer might already be closed
            }
          }
        }
        
        this.writer = null;
      }

      // Step 3: Wait a bit to ensure streams are properly released
      await new Promise(resolve => setTimeout(resolve, 10));

      // Step 4: Close the port only if no streams are locked
      if (this.currentPort) {
        try {
          // Final check - only close if streams are null (properly released)
          if (this.currentPort.readable === null && this.currentPort.writable === null) {
            // Port is already closed, no need to close again
          } else {
            // Try to close the port
            await this.currentPort.close();
          }
        } catch (e) {
          // Port might already be closed or locked, that's okay
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.warn('Port close warning (this is usually harmless):', errorMessage);
        }
      }

    } catch (error) {
      console.error('Error during disconnect:', error);
    } finally {
      // Always cleanup state
      this.currentPort = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.isDisconnecting = false;
      this.reader = null;
      this.writer = null;
    }
  }

  // Send data to the serial port
  async sendData(data: Uint8Array): Promise<void> {
    if (!this.isConnected || !this.writer) {
      throw new Error('Not connected to any serial port');
    }

    try {
      await this.writer.write(data);
    } catch (error) {
      throw new Error(`Failed to send data: ${error}`);
    }
  }

  // Send hex string to the serial port
  async sendHexString(hexString: string): Promise<void> {
    const cleanHex = hexString.replace(/\s+/g, '');
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Invalid hex string: must have even number of characters');
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }

    await this.sendData(bytes);
  }

  // Start reading data from the serial port
  async startReading(onDataReceived: (data: Uint8Array) => void, onError?: (error: Error) => void): Promise<void> {
    if (!this.isConnected || !this.reader) {
      throw new Error('Not connected to any serial port');
    }

    try {
      while (this.isConnected && this.reader) {
        try {
          const { value, done } = await this.reader.read();
          
          if (done) {
            break;
          }

          if (value && value.length > 0) {
            onDataReceived(value);
          }
        } catch (readError) {
          // If reader is cancelled or disconnected, break the loop
          if (readError instanceof Error && 
              (readError.name === 'AbortError' || readError.message.includes('cancelled'))) {
            break;
          }
          throw readError;
        }
      }
    } catch (error) {
      if (onError && this.isConnected) {
        onError(new Error(`Error reading from serial port: ${error}`));
      }
    }
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Get connection progress status
  getConnectionProgress(): boolean {
    return this.isConnecting;
  }

  // Get current port info
  getCurrentPortInfo(): string {
    if (!this.currentPort) {
      return 'No port connected';
    }

    const info = this.currentPort.getInfo();
    if (info.usbVendorId && info.usbProductId) {
      return `USB Device (VID: ${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}, PID: ${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()})`;
    }

    return 'Serial Port';
  }

  // Convert Uint8Array to hex string
  static uint8ArrayToHex(data: Uint8Array): string {
    return Array.from(data)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  // Convert hex string to Uint8Array
  static hexToUint8Array(hexString: string): Uint8Array {
    const cleanHex = hexString.replace(/\s+/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    
    return bytes;
  }
}