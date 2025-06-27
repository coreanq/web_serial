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
          console.log('WebSocket message received:', message);
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
  
  async disconnectFromModbusDevice(): Promise<void> {
    this.sendMessage({
      type: 'disconnect'
    });
  }
  
  async sendModbusCommand(hexData: string): Promise<void> {
    this.sendMessage({
      type: 'send',
      data: hexData
    });
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