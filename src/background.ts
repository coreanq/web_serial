// Chrome Extension Background Service Worker
// Handles Native Messaging for TCP connections

// Service Worker context check
if (typeof (self as any).importScripts === 'function') {
  console.log('Running in service worker context');
} else {
  console.log('Not in service worker context');
}

class ChromeExtensionBackground {
  private nativePort: any | null = null;
  private isNativeConnected = false;
  private messageHandlers = new Map<number, (response: any) => void>();
  private messageId = 0;

  constructor() {
    this.setupExtensionHandlers();
    // Only try to connect to native app when actually needed
    // this.tryConnectNative();
  }

  private setupExtensionHandlers() {
    // Handle messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handlePopupMessage(message)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      
      return true; // Keep message channel open
    });

    // Handle extension lifecycle
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension startup');
      // Don't auto-connect to native app
    });

    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension installed/updated');
      // Don't auto-connect to native app
    });

    chrome.action.onClicked.addListener((tab) => {
      chrome.tabs.create({ url: 'popup.html' });
    });
  }

  private tryConnectNative() {
    if (this.isNativeConnected) return;

    try {
      this.nativePort = chrome.runtime.connectNative('com.modbus.debugger');
      
      this.nativePort.onMessage.addListener((response: any) => {
        this.handleNativeMessage(response);
      });

      this.nativePort.onDisconnect.addListener(() => {
        console.debug('Native app disconnected (TCP features disabled)');
        this.isNativeConnected = false;
        this.nativePort = null;
        
        // Notify popup about disconnection (if any popup is listening)
        this.broadcastToTabs({
          type: 'native_disconnected',
          error: chrome.runtime.lastError?.message
        });
      });

      // Test connection
      this.sendToNative({ type: 'ping' })
        .then(() => {
          this.isNativeConnected = true;
          console.log('Native app connected');
          this.broadcastToTabs({ type: 'native_connected' });
        })
        .catch((error) => {
          this.isNativeConnected = false;
          console.debug('Native app not available (TCP features disabled):', error.message);
        });

    } catch (error) {
      console.debug('Native app not installed (TCP features disabled)');
      this.isNativeConnected = false;
    }
  }

  private async handlePopupMessage(message: any): Promise<any> {
    switch (message.type) {
      case 'check_native_status':
        return {
          connected: this.isNativeConnected,
          port: this.nativePort ? 'connected' : 'disconnected'
        };

      case 'tcp_connect':
        // Try to connect to native app if not already connected
        if (!this.isNativeConnected) {
          this.tryConnectNative();
          // Wait a bit for connection
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return await this.sendToNative({
          type: 'tcp_connect',
          host: message.host,
          port: message.port
        });

      case 'tcp_disconnect':
        return await this.sendToNative({
          type: 'tcp_disconnect'
        });

      case 'tcp_send':
        return await this.sendToNative({
          type: 'tcp_send',
          data: message.data
        });

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  private handleNativeMessage(response: any) {
    console.log('Native app response:', response);

    // Handle message responses
    if (response.messageId && this.messageHandlers.has(response.messageId)) {
      const handler = this.messageHandlers.get(response.messageId)!;
      this.messageHandlers.delete(response.messageId);
      handler(response);
      return;
    }

    // Broadcast unsolicited messages to popup
    this.broadcastToTabs(response);
  }

  private sendToNative(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isNativeConnected || !this.nativePort) {
        reject(new Error('Native app not connected'));
        return;
      }

      const messageId = ++this.messageId;
      message.messageId = messageId;

      this.messageHandlers.set(messageId, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data || response);
        }
      });

      try {
        this.nativePort.postMessage(message);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.messageHandlers.has(messageId)) {
            this.messageHandlers.delete(messageId);
            reject(new Error('Native app response timeout'));
          }
        }, 10000);

      } catch (error) {
        this.messageHandlers.delete(messageId);
        reject(error);
      }
    });
  }

  private broadcastToTabs(message: any) {
    // Send to all tabs/popup instances
    chrome.runtime.sendMessage(message, (response) => {
      // Check for runtime errors and ignore them
      if (chrome.runtime.lastError) {
        // Safely ignore "Receiving end does not exist" errors
        console.debug('Message broadcast ignored - no receivers:', chrome.runtime.lastError.message);
      }
    });
  }
}

// Initialize background service
new ChromeExtensionBackground();