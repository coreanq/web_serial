export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ModbusTcpConfig {
  host: string;
  port: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageHandlers = new Map<string, (data: any) => void>();
  private lastMessage: {type: string, message: string, timestamp: number} | null = null;
  private messageDebounceMs = 50; // 50ms debounce for duplicate messages
  
  constructor(private serverUrl: string = 'ws://localhost:8080') {}
  
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected to proxy server');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.handleMessage('ws_connected', { connected: true });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Filter duplicate messages
          if (this.isDuplicateMessage(message)) {
            return;
          }
          
          // Only log non-duplicate messages and avoid spam for tcp_disconnected
          if (message.type !== 'tcp_disconnected' || Math.random() < 0.2) {
            console.log('WebSocket message received:', message);
          }
          this.updateLastMessage(message);
          this.handleMessage(message.type, message);
          
          // Handle server's initial 'connected' message as confirmation
          if (message.type === 'connected') {
            this.handleMessage('ws_connected', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.handleMessage('ws_disconnected', { code: event.code, reason: event.reason });
        
        // Auto-reconnect logic
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.handleMessage('ws_error', { error });
      };
      
      // Wait for connection to open
      await this.waitForConnection();
      
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }
  
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };
    });
  }
  
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
      });
    }, delay);
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
  
  async connectToModbusDevice(config: ModbusTcpConfig): Promise<void> {
    this.sendMessage({
      type: 'connect',
      host: config.host,
      port: config.port
    });
  }

  // Auto-reconnect for TCP Modbus connections
  async reconnectToModbusDevice(config: ModbusTcpConfig): Promise<void> {
    console.log(`Attempting to reconnect to Modbus device at ${config.host}:${config.port}`);
    await this.connectToModbusDevice(config);
  }
  
  async disconnectFromModbusDevice(): Promise<void> {
    this.sendMessage({
      type: 'disconnect'
    });
  }
  
  async sendModbusCommand(hexData: string): Promise<void> {
    // Add MBAP header for Modbus TCP
    const mbapData = this.addMbapHeader(hexData);
    console.log(`🔍 WebSocketService: Original PDU: ${hexData}`);
    console.log(`🔍 WebSocketService: With MBAP header: ${mbapData}`);
    this.sendMessage({
      type: 'send',
      data: mbapData
    });
  }

  private addMbapHeader(pduHex: string, unitId: number = 1): string {
    // Remove spaces and validate hex string
    const cleanPdu = pduHex.replace(/\s+/g, '');
    if (!/^[0-9A-Fa-f]*$/.test(cleanPdu)) {
      throw new Error('Invalid hex data for Modbus command');
    }

    // Calculate PDU length in bytes
    const pduLength = cleanPdu.length / 2;
    
    // MBAP Header construction:
    // Transaction ID (2 bytes) - use current timestamp for uniqueness
    const transactionId = (Date.now() % 65536).toString(16).padStart(4, '0').toUpperCase();
    
    // Protocol ID (2 bytes) - always 0000 for Modbus
    const protocolId = '0000';
    
    // Length (2 bytes) - Unit ID (1 byte) + PDU length
    const length = (1 + pduLength).toString(16).padStart(4, '0').toUpperCase();
    
    // Unit ID (1 byte) - default to 1 if not specified
    const unitIdHex = unitId.toString(16).padStart(2, '0').toUpperCase();
    
    // Combine MBAP header + PDU
    const mbapHeader = transactionId + protocolId + length + unitIdHex;
    const fullPacket = mbapHeader + cleanPdu.toUpperCase();
    
    console.log(`MBAP Header added: ${mbapHeader} + PDU: ${cleanPdu} = ${fullPacket}`);
    return fullPacket;
  }
  
  private sendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  private handleMessage(type: string, data: any): void {
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }
    
    // Also trigger generic message handler
    const genericHandler = this.messageHandlers.get('*');
    if (genericHandler) {
      genericHandler({ type, ...data });
    }
  }
  
  // Event subscription methods
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }
  
  onAnyMessage(handler: (data: any) => void): void {
    this.messageHandlers.set('*', handler);
  }
  
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }
  
  // Status getters
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  // Helper methods for duplicate message filtering
  private isDuplicateMessage(message: WebSocketMessage): boolean {
    if (!this.lastMessage) {
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessage.timestamp;
    
    // Check if same type and message within debounce period
    return (
      this.lastMessage.type === message.type &&
      this.lastMessage.message === message.message &&
      timeSinceLastMessage < this.messageDebounceMs
    );
  }
  
  private updateLastMessage(message: WebSocketMessage): void {
    this.lastMessage = {
      type: message.type,
      message: message.message || '',
      timestamp: Date.now()
    };
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
  
  // Ping/pong for keep-alive
  ping(): void {
    this.sendMessage({ type: 'ping' });
  }
  
  // Start keep-alive pings
  startKeepAlive(interval: number = 30000): void {
    setInterval(() => {
      if (this.isConnected()) {
        this.ping();
      }
    }, interval);
  }
}