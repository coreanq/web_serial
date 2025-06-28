// src/services/NativeMessagingService.ts

type MessageCallback = (message: any) => void;

/**
 * Service for handling communication with a Chrome Native Messaging host.
 */
export class NativeMessagingService {
  private port: chrome.runtime.Port | null = null;
  private hostName: string;
  private messageListeners: Map<string, MessageCallback[]> = new Map();

  constructor(hostName: string) {
    this.hostName = hostName;
  }

  /**
   * Connects to the native messaging host.
   * @returns A promise that resolves when the connection is established, or rejects on error.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.port = chrome.runtime.connectNative(this.hostName);

        this.port.onMessage.addListener((message: any) => {
          this.handleIncomingMessage(message);
        });

        this.port.onDisconnect.addListener(() => {
          this.handleDisconnect();
          if (chrome.runtime.lastError) {
            console.error('Native port disconnected with error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('Native port disconnected.');
          }
        });

        // A successful connection doesn't have an explicit success event.
        // We'll resolve immediately and let errors be handled by onDisconnect.
        // A common practice is to wait for a "proxy_started" message.
        this.onMessage('proxy_started', () => {
          console.log('Native Messaging Host connected and ready.');
          resolve();
        });

      } catch (e) {
        console.error('Failed to connect to native host:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        // Provide a more helpful error message for the common case.
        if (errorMessage.includes('native messaging host not found')) {
            reject(new Error('Native messaging host not found. Make sure it is installed correctly.'));
        } else {
            reject(e);
        }
      }
    });
  }

  /**
   * Disconnects from the native messaging host.
   */
  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }

  /**
   * Sends a message to the native host.
   * @param message The message object to send.
   */
  sendMessage(message: any): void {
    if (!this.port) {
      console.error('Cannot send message: Native port is not connected.');
      return;
    }
    this.port.postMessage(message);
  }

  /**
   * Registers a callback for a specific message type.
   * @param type The type of message to listen for.
   * @param callback The function to call when the message is received.
   */
  onMessage(type: string, callback: MessageCallback): void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, []);
    }
    this.messageListeners.get(type)?.push(callback);
  }

  /**
   * Unregisters a callback for a specific message type.
   * @param type The type of message to stop listening for.
   */
  offMessage(type: string): void {
    this.messageListeners.delete(type);
  }

  /**
   * Handles incoming messages from the native port and dispatches them to listeners.
   * @param message The message received from the native host.
   */
  private handleIncomingMessage(message: any): void {
    if (message && message.type) {
      const callbacks = this.messageListeners.get(message.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(message));
      }
    }
  }

  /**
   * Handles the disconnection of the native port.
   */
  private handleDisconnect(): void {
    this.port = null;
    // Notify listeners that the connection is lost
    this.handleIncomingMessage({ type: 'native_disconnected' });
    this.messageListeners.clear();
  }

  /**
   * Checks if the native port is currently connected.
   * @returns True if connected, false otherwise.
   */
  isConnected(): boolean {
    return this.port !== null;
  }
}
