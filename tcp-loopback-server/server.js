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

    // Echo the data back (loopback functionality)
    try {
      client.socket.write(data);
      client.bytesSent += data.length;
      
      if (this.config.logging.logData) {
        this.log(`Server -> Client #${clientId}: ${this.hexDump(data)}`, 'data');
      }
    } catch (error) {
      this.log(`Failed to echo data to client #${clientId}: ${error.message}`, 'error');
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