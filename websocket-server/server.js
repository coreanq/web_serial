const WebSocket = require('ws');
const net = require('net');

class ModbusTcpProxy {
  constructor(port = 8080) {
    this.wss = new WebSocket.Server({ port });
    this.clients = new Map(); // WebSocket client -> TCP connection mapping
    
    console.log(`Modbus WebSocket Proxy Server running on port ${port}`);
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`Client ${clientId} connected from ${req.socket.remoteAddress}`);
      
      // Initialize client state
      this.clients.set(ws, {
        id: clientId,
        tcpSocket: null,
        isConnected: false,
        targetHost: null,
        targetPort: null
      });
      
      ws.on('message', (message) => {
        this.handleWebSocketMessage(ws, message);
      });
      
      ws.on('close', () => {
        this.handleClientDisconnect(ws);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(ws);
      });
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        message: 'WebSocket proxy server connected'
      });
    });
  }
  
  generateClientId() {
    return Math.random().toString(36).substring(2, 15);
  }
  
  handleWebSocketMessage(ws, message) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    try {
      const data = JSON.parse(message.toString());
      console.log(`Client ${client.id} sent:`, data);
      
      switch (data.type) {
        case 'connect':
          this.handleTcpConnect(ws, data);
          break;
          
        case 'disconnect':
          this.handleTcpDisconnect(ws);
          break;
          
        case 'send':
          this.handleDataSend(ws, data);
          break;
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong' });
          break;
          
        default:
          this.sendToClient(ws, {
            type: 'error',
            message: `Unknown message type: ${data.type}`
          });
      }
    } catch (error) {
      console.error(`Error parsing message from client ${client.id}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid JSON message'
      });
    }
  }
  
  handleTcpConnect(ws, data) {
    const client = this.clients.get(ws);
    const { host, port } = data;
    
    if (!host || !port) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Host and port are required for connection'
      });
      return;
    }
    
    // Check if already connected to the same host:port
    if (client.tcpSocket && client.isConnected && 
        client.targetHost === host && client.targetPort === port) {
      console.log(`Client ${client.id} already connected to ${host}:${port}`);
      this.sendToClient(ws, {
        type: 'tcp_connected',
        host,
        port,
        message: `Already connected to Modbus device ${host}:${port}`
      });
      return;
    }
    
    // Close existing connection if any
    if (client.tcpSocket) {
      console.log(`Closing existing TCP connection for client ${client.id}`);
      client.tcpSocket.removeAllListeners(); // Remove event listeners to prevent disconnect events
      client.tcpSocket.destroy();
      client.tcpSocket = null;
      client.isConnected = false;
    }
    
    console.log(`Client ${client.id} connecting to ${host}:${port}`);
    
    // Create TCP connection to Modbus device
    const tcpSocket = new net.Socket();
    client.tcpSocket = tcpSocket;
    client.targetHost = host;
    client.targetPort = port;
    
    // Set keep-alive and timeout options for longer connections
    tcpSocket.setKeepAlive(true, 10000); // Send keep-alive every 10 seconds
    tcpSocket.setTimeout(300000); // 5 minute timeout instead of 1 minute
    tcpSocket.setNoDelay(true); // Disable Nagle's algorithm for faster response
    
    tcpSocket.connect(port, host, () => {
      console.log(`Client ${client.id} connected to Modbus device ${host}:${port}`);
      client.isConnected = true;
      
      this.sendToClient(ws, {
        type: 'tcp_connected',
        host,
        port,
        message: `Connected to Modbus device ${host}:${port}`
      });
    });
    
    tcpSocket.on('data', (data) => {
      console.log(`Client ${client.id} received from ${host}:${port}:`, this.bufferToHex(data));
      
      this.sendToClient(ws, {
        type: 'data',
        data: this.bufferToHex(data),
        timestamp: new Date().toISOString()
      });
    });
    
    tcpSocket.on('error', (error) => {
      console.error(`TCP error for client ${client.id} (${host}:${port}):`, error);
      client.isConnected = false;
      
      this.sendToClient(ws, {
        type: 'tcp_error',
        error: error.message,
        message: `Connection error to ${host}:${port}`
      });
    });
    
    tcpSocket.on('end', () => {
      console.log(`TCP connection ended for client ${client.id} (${host}:${port})`);
      // Don't send disconnect message here - wait for close event
    });
    
    tcpSocket.on('close', () => {
      console.log(`TCP connection closed for client ${client.id} (${host}:${port})`);
      
      // Only send disconnect message if we were actually connected
      if (client.isConnected) {
        client.isConnected = false;
        client.tcpSocket = null;
        
        this.sendToClient(ws, {
          type: 'tcp_disconnected',
          message: `Disconnected from ${host}:${port}`
        });
      }
    });
    
    tcpSocket.on('timeout', () => {
      console.log(`TCP connection timeout for client ${client.id} (${host}:${port})`);
      client.isConnected = false;
      tcpSocket.destroy();
      
      this.sendToClient(ws, {
        type: 'tcp_error',
        error: 'Connection timeout',
        message: `Connection timeout to ${host}:${port}`
      });
    });
  }
  
  handleTcpDisconnect(ws) {
    const client = this.clients.get(ws);
    
    if (client.tcpSocket) {
      console.log(`Client ${client.id} disconnecting from ${client.targetHost}:${client.targetPort}`);
      client.tcpSocket.destroy();
      client.tcpSocket = null;
      client.isConnected = false;
      
      this.sendToClient(ws, {
        type: 'tcp_disconnected',
        message: 'Disconnected from Modbus device'
      });
    }
  }
  
  handleDataSend(ws, data) {
    const client = this.clients.get(ws);
    
    if (!client.isConnected || !client.tcpSocket) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Not connected to Modbus device'
      });
      return;
    }
    
    try {
      const hexData = data.data;
      const buffer = this.hexToBuffer(hexData);
      
      console.log(`Client ${client.id} sending to ${client.targetHost}:${client.targetPort}:`, hexData);
      client.tcpSocket.write(buffer);
      
      this.sendToClient(ws, {
        type: 'data_sent',
        data: hexData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error sending data for client ${client.id}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: `Failed to send data: ${error.message}`
      });
    }
  }
  
  handleClientDisconnect(ws) {
    const client = this.clients.get(ws);
    if (client) {
      console.log(`Client ${client.id} disconnected`);
      
      // Close TCP connection if exists
      if (client.tcpSocket) {
        client.tcpSocket.destroy();
      }
      
      this.clients.delete(ws);
    }
  }
  
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  // Utility functions
  hexToBuffer(hexString) {
    // Remove spaces and convert to buffer
    const cleanHex = hexString.replace(/\s+/g, '');
    const buffer = Buffer.from(cleanHex, 'hex');
    return buffer;
  }
  
  bufferToHex(buffer) {
    // Convert buffer to spaced hex string
    return Array.from(buffer)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }
}

// Start the server
const proxy = new ModbusTcpProxy(8080);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Modbus WebSocket Proxy...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down Modbus WebSocket Proxy...');
  process.exit(0);
});