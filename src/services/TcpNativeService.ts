// src/services/TcpNativeService.ts

import { NativeMessagingService } from './NativeMessagingService';

export interface TcpNativeConnection {
  host: string;
  port: number;
}

export interface TcpNativeMessage {
  type: 'connect' | 'disconnect' | 'send' | 'tcp_connected' | 'tcp_disconnected' | 'tcp_error' | 'data' | 'error' | 'proxy_started';
  host?: string;
  port?: number;
  data?: string;
  message?: string;
}

type ConnectionCallback = (connected: boolean, error?: string) => void;
type DataCallback = (data: string) => void;
type ErrorCallback = (error: string) => void;
type ProxyStatusCallback = (connected: boolean) => void;

/**
 * Service for handling TCP connections through native messaging
 */
export class TcpNativeService {
  private nativeService: NativeMessagingService;
  private isConnected: boolean = false;
  private isProxyConnected: boolean = false;
  private connectionCallbacks: ConnectionCallback[] = [];
  private dataCallbacks: DataCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private proxyStatusCallbacks: ProxyStatusCallback[] = [];

  constructor() {
    this.nativeService = new NativeMessagingService('com.my_company.stdio_proxy');
    this.setupMessageHandlers();
  }

  /**
   * Initialize and connect to the native messaging host
   */
  async init(): Promise<void> {
    try {
      await this.nativeService.connect();
      this.isProxyConnected = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to native proxy: ${errorMessage}`);
    }
  }

  /**
   * Connect to a TCP server
   */
  async connect(connection: TcpNativeConnection): Promise<void> {
    if (!this.isProxyConnected) {
      throw new Error('Native proxy is not connected');
    }

    this.nativeService.sendMessage({
      type: 'connect',
      host: connection.host,
      port: connection.port
    });
  }

  /**
   * Disconnect from the TCP server
   */
  disconnect(force: boolean = false): void {
    console.log('🔴 TcpNativeService.disconnect() called, force:', force);
    
    if (!force) {
      console.warn('⚠️ Automatic disconnect prevented. Use disconnect(true) for manual disconnect.');
      return;
    }
    
    console.log('✅ Manual disconnect proceeding...');
    
    if (this.isProxyConnected) {
      this.nativeService.sendMessage({ type: 'disconnect' });
    }
    this.isConnected = false;
  }

  /**
   * Send data to the TCP server
   */
  sendData(hexData: string): void {
    if (!this.isConnected) {
      throw new Error('TCP connection is not established');
    }

    this.nativeService.sendMessage({
      type: 'send',
      data: hexData
    });
  }

  /**
   * Register a callback for connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Register a callback for incoming data
   */
  onData(callback: DataCallback): void {
    this.dataCallbacks.push(callback);
  }

  /**
   * Register a callback for errors
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register a callback for proxy status changes
   */
  onProxyStatus(callback: ProxyStatusCallback): void {
    this.proxyStatusCallbacks.push(callback);
  }

  /**
   * Check if TCP connection is established
   */
  isTcpConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Check if native proxy is connected
   */
  isProxyReady(): boolean {
    return this.isProxyConnected;
  }

  /**
   * Cleanup and disconnect all connections
   */
  cleanup(): void {
    this.disconnect();
    this.nativeService.disconnect();
    this.isProxyConnected = false;
    this.connectionCallbacks = [];
    this.dataCallbacks = [];
    this.errorCallbacks = [];
    this.proxyStatusCallbacks = [];
  }

  /**
   * Setup message handlers for the native messaging service
   */
  private setupMessageHandlers(): void {
    this.nativeService.onMessage('proxy_started', () => {
      this.isProxyConnected = true;
      this.proxyStatusCallbacks.forEach(cb => cb(true));
    });

    this.nativeService.onMessage('tcp_connected', () => {
      this.isConnected = true;
      this.connectionCallbacks.forEach(cb => cb(true));
    });

    this.nativeService.onMessage('tcp_disconnected', () => {
      this.isConnected = false;
      this.connectionCallbacks.forEach(cb => cb(false));
    });

    this.nativeService.onMessage('tcp_error', (message: TcpNativeMessage) => {
      this.isConnected = false;
      const errorMessage = message.message || 'TCP connection error';
      this.connectionCallbacks.forEach(cb => cb(false, errorMessage));
      this.errorCallbacks.forEach(cb => cb(errorMessage));
    });

    this.nativeService.onMessage('data', (message: TcpNativeMessage) => {
      if (message.data) {
        this.dataCallbacks.forEach(cb => cb(message.data!));
      }
    });

    this.nativeService.onMessage('error', (message: TcpNativeMessage) => {
      const errorMessage = message.message || 'Unknown error';
      this.errorCallbacks.forEach(cb => cb(errorMessage));
    });

    this.nativeService.onMessage('native_disconnected', () => {
      this.isProxyConnected = false;
      this.isConnected = false;
      this.proxyStatusCallbacks.forEach(cb => cb(false));
      this.connectionCallbacks.forEach(cb => cb(false, 'Native proxy disconnected'));
    });
  }
}