const net = require('net');
const fs = require('fs');
const path = require('path');
const colors = require('colors');

class TCPLoopbackServer {
  constructor() {
    this.configPath = path.join(__dirname, 'config.json');
    this.config = this.loadConfig();
    this.server = null;
    this.clients = new Map();
    this.clientIdCounter = 0;
    this.isRunning = false;
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Failed to load config file, using defaults:', error.message);
      return {
        server: { host: '0.0.0.0', port: 502, name: 'TCP Loopback Server' },
        logging: { enabled: true, logConnections: true, logData: true },
        options: { maxConnections: 10, timeout: 30000, keepAlive: true }
      };
    }
  }

  log(message, type = 'info') {
    if (!this.config.logging.enabled) return;
    
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const prefix = `[${timestamp}]`;
    
    switch (type) {
      case 'info':
        console.log(`${prefix} ${message}`.cyan);
        break;
      case 'success':
        console.log(`${prefix} ${message}`.green);
        break;
      case 'warning':
        console.log(`${prefix} ${message}`.yellow);
        break;
      case 'error':
        console.log(`${prefix} ${message}`.red);
        break;
      case 'data':
        console.log(`${prefix} ${message}`.magenta);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  hexDump(buffer) {
    const hex = buffer.toString('hex').toUpperCase();
    const ascii = buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    const hexFormatted = hex.match(/.{1,2}/g).join(' ');
    return `${hexFormatted} | ${ascii}`;
  }

  generateModbusResponse(requestData) {
    if (requestData.length < 8) {
      this.log('Invalid Modbus TCP request: too short', 'warning');
      return null;
    }

    // Parse MBAP header
    const transactionId = requestData.readUInt16BE(0);
    const protocolId = requestData.readUInt16BE(2);
    const length = requestData.readUInt16BE(4);  
    const unitId = requestData.readUInt8(6);
    
    // Parse PDU 
    const functionCode = requestData.readUInt8(7);
    
    this.log(`Modbus TCP Request - TID:${transactionId.toString(16).padStart(4, '0')}, Unit:${unitId}, FC:${functionCode.toString(16).padStart(2, '0')}`, 'info');

    let responsePdu = null;

    switch (functionCode) {
      case 0x03: // Read Holding Registers
        responsePdu = this.generateReadHoldingRegistersResponse(requestData);
        break;
      case 0x04: // Read Input Registers  
        responsePdu = this.generateReadInputRegistersResponse(requestData);
        break;
      case 0x06: // Write Single Register
        responsePdu = this.generateWriteSingleRegisterResponse(requestData);
        break;
      case 0x10: // Write Multiple Registers
        responsePdu = this.generateWriteMultipleRegistersResponse(requestData);
        break;
      default:
        this.log(`Unsupported function code: 0x${functionCode.toString(16).padStart(2, '0')}`, 'warning');
        return this.generateErrorResponse(transactionId, unitId, functionCode, 0x01); // Illegal Function
    }

    if (!responsePdu) {
      return null;
    }

    // Create MBAP header for response
    const responseLength = responsePdu.length + 1; // PDU + Unit ID
    const response = Buffer.alloc(6 + responseLength);
    
    response.writeUInt16BE(transactionId, 0); // Transaction ID
    response.writeUInt16BE(0x0000, 2);        // Protocol ID (always 0 for Modbus)
    response.writeUInt16BE(responseLength, 4); // Length
    response.writeUInt8(unitId, 6);           // Unit ID
    
    // Copy PDU
    responsePdu.copy(response, 7);
    
    return response;
  }

  generateReadHoldingRegistersResponse(requestData) {
    if (requestData.length < 12) {
      return null;
    }
    
    const startAddress = requestData.readUInt16BE(8);
    const quantity = requestData.readUInt16BE(10);
    
    // Validate quantity (1-125 registers per spec)
    if (quantity < 1 || quantity > 125) {
      return null;
    }
    
    // Generate response with sample data
    const byteCount = quantity * 2;
    const response = Buffer.alloc(2 + byteCount);
    
    response.writeUInt8(0x03, 0);        // Function code
    response.writeUInt8(byteCount, 1);   // Byte count
    
    // Fill with sample register values (incrementing pattern)
    for (let i = 0; i < quantity; i++) {
      const registerValue = (startAddress + i) % 65536;
      response.writeUInt16BE(registerValue, 2 + (i * 2));
    }
    
    return response;
  }

  generateReadInputRegistersResponse(requestData) {
    // Same as holding registers for this demo
    return this.generateReadHoldingRegistersResponse(requestData);
  }

  generateWriteSingleRegisterResponse(requestData) {
    if (requestData.length < 12) {
      return null;
    }
    
    // Echo back the same register address and value
    const response = Buffer.alloc(5);
    response.writeUInt8(0x06, 0);                    // Function code
    response.writeUInt16BE(requestData.readUInt16BE(8), 1);  // Register address
    response.writeUInt16BE(requestData.readUInt16BE(10), 3); // Register value
    
    return response;
  }

  generateWriteMultipleRegistersResponse(requestData) {
    if (requestData.length < 12) {
      return null;
    }
    
    // Echo back starting address and quantity
    const response = Buffer.alloc(5);
    response.writeUInt8(0x10, 0);                    // Function code
    response.writeUInt16BE(requestData.readUInt16BE(8), 1);  // Starting address
    response.writeUInt16BE(requestData.readUInt16BE(10), 3); // Quantity of registers
    
    return response;
  }

  generateErrorResponse(transactionId, unitId, functionCode, exceptionCode) {
    const response = Buffer.alloc(9);
    
    response.writeUInt16BE(transactionId, 0);        // Transaction ID
    response.writeUInt16BE(0x0000, 2);               // Protocol ID
    response.writeUInt16BE(0x0003, 4);               // Length (Unit ID + FC + Exception)
    response.writeUInt8(unitId, 6);                  // Unit ID
    response.writeUInt8(functionCode | 0x80, 7);     // Function code with error bit
    response.writeUInt8(exceptionCode, 8);           // Exception code
    
    return response;
  }

  start() {
    if (this.isRunning) {
      this.log('Server is already running', 'warning');
      return;
    }

    this.server = net.createServer();
    
    // Set server options
    this.server.maxConnections = this.config.options.maxConnections;

    // Server event handlers
    this.server.on('connection', (socket) => this.handleConnection(socket));
    this.server.on('error', (error) => this.handleServerError(error));
    this.server.on('close', () => this.handleServerClose());

    // Start listening
    this.server.listen(this.config.server.port, this.config.server.host, () => {
      this.isRunning = true;
      const address = this.server.address();
      this.log(`${this.config.server.name} started`, 'success');
      this.log(`Listening on ${address.address}:${address.port}`, 'info');
      this.log(`Max connections: ${this.config.options.maxConnections}`, 'info');
      this.log('Press Ctrl+C to stop the server', 'info');
    });
  }

  handleConnection(socket) {
    const clientId = ++this.clientIdCounter;
    const clientInfo = {
      id: clientId,
      socket: socket,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      connectedAt: new Date(),
      bytesReceived: 0,
      bytesSent: 0
    };

    this.clients.set(clientId, clientInfo);

    if (this.config.logging.logConnections) {
      this.log(`Client #${clientId} connected from ${clientInfo.remoteAddress}:${clientInfo.remotePort}`, 'success');
      this.log(`Active connections: ${this.clients.size}`, 'info');
    }

    // Set socket options
    if (this.config.options.keepAlive) {
      socket.setKeepAlive(true);
    }

    if (this.config.options.timeout > 0) {
      socket.setTimeout(this.config.options.timeout);
    }

    // Socket event handlers
    socket.on('data', (data) => this.handleClientData(clientId, data));
    socket.on('close', () => this.handleClientDisconnect(clientId));
    socket.on('error', (error) => this.handleClientError(clientId, error));
    socket.on('timeout', () => this.handleClientTimeout(clientId));
  }

  handleClientData(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.bytesReceived += data.length;

    if (this.config.logging.logData) {
      this.log(`Client #${clientId} -> Server: ${this.hexDump(data)}`, 'data');
    }

    // Generate Modbus TCP response instead of simple echo
    try {
      const responseData = this.generateModbusResponse(data);
      if (responseData) {
        client.socket.write(responseData);
        client.bytesSent += responseData.length;
        
        if (this.config.logging.logData) {
          this.log(`Server -> Client #${clientId}: ${this.hexDump(responseData)}`, 'data');
        }
      }
    } catch (error) {
      this.log(`Failed to generate response for client #${clientId}: ${error.message}`, 'error');
    }
  }

  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (this.config.logging.logConnections) {
      const duration = new Date() - client.connectedAt;
      this.log(`Client #${clientId} disconnected after ${Math.round(duration/1000)}s`, 'warning');
      this.log(`Data exchanged: ${client.bytesReceived} bytes received, ${client.bytesSent} bytes sent`, 'info');
      this.log(`Active connections: ${this.clients.size - 1}`, 'info');
    }

    this.clients.delete(clientId);
  }

  handleClientError(clientId, error) {
    this.log(`Client #${clientId} error: ${error.message}`, 'error');
    const client = this.clients.get(clientId);
    if (client && client.socket) {
      client.socket.destroy();
    }
  }

  handleClientTimeout(clientId) {
    this.log(`Client #${clientId} timed out`, 'warning');
    const client = this.clients.get(clientId);
    if (client && client.socket) {
      client.socket.destroy();
    }
  }

  handleServerError(error) {
    if (error.code === 'EADDRINUSE') {
      this.log(`Port ${this.config.server.port} is already in use`, 'error');
    } else if (error.code === 'EACCES') {
      this.log(`Permission denied to bind to port ${this.config.server.port}`, 'error');
    } else {
      this.log(`Server error: ${error.message}`, 'error');
    }
    this.stop();
  }

  handleServerClose() {
    this.log('Server closed', 'warning');
    this.isRunning = false;
  }

  stop() {
    if (!this.isRunning) {
      this.log('Server is not running', 'warning');
      return;
    }

    this.log('Stopping server...', 'info');

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      if (client.socket && !client.socket.destroyed) {
        client.socket.destroy();
      }
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      this.server.close(() => {
        this.log('Server stopped', 'success');
        process.exit(0);
      });
    }
  }

  showStatus() {
    console.log('\n=== TCP Loopback Server Status ==='.cyan.bold);
    console.log(`Server: ${this.isRunning ? 'Running'.green : 'Stopped'.red}`);
    console.log(`Address: ${this.config.server.host}:${this.config.server.port}`);
    console.log(`Active connections: ${this.clients.size}/${this.config.options.maxConnections}`);
    
    if (this.clients.size > 0) {
      console.log('\nConnected clients:');
      for (const [clientId, client] of this.clients) {
        const duration = Math.round((new Date() - client.connectedAt) / 1000);
        console.log(`  #${clientId}: ${client.remoteAddress}:${client.remotePort} (${duration}s, ↓${client.bytesReceived} ↑${client.bytesSent})`);
      }
    }
    console.log('');
  }
}

// Create and start server
const server = new TCPLoopbackServer();

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--status') || args.includes('-s')) {
  server.showStatus();
  process.exit(0);
}

// Start server
server.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.stop();
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  server.stop();
});

// Show status every 30 seconds if verbose mode
if (args.includes('--verbose') || args.includes('-v')) {
  setInterval(() => {
    server.showStatus();
  }, 30000);
}