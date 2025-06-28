# stdio-proxy

Chrome Native Messaging Host for TCP proxy connections. Enables the Modbus Protocol Debugger Chrome Extension to establish direct TCP connections, bypassing browser security restrictions.

## Overview

This native messaging host allows the Chrome extension to:
- Connect directly to TCP servers (ModbusTCP devices)
- Send and receive binary data over TCP connections
- Bypass browser CORS and security limitations
- Provide stable, low-latency communication

## Prerequisites

- Node.js 18.0.0 or higher
- Chrome browser with Developer mode enabled
- Modbus Protocol Debugger Chrome Extension

## Installation

### 1. Get Chrome Extension ID
1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Find your Modbus Protocol Debugger extension
4. Copy the Extension ID (long string of letters)

### 2. Install Native Host
```bash
cd stdio-proxy
# Edit install.sh and replace EXTENSION_ID with your actual extension ID
chmod +x install.sh
./install.sh
```

### 3. Reload Extension
1. Go back to `chrome://extensions`
2. Click the reload button on your extension
3. Test TCP Native connection in the extension

## Files

- `proxy.js` - Main native messaging host application
- `manifest.json` - Chrome native messaging host manifest
- `install.sh` - Installation script for macOS/Linux
- `run.sh` - Node.js launcher script with path detection
- `get-extension-id.js` - Helper to get Chrome extension ID
- `package.json` - Node.js package configuration

## Usage

Once installed, the native host runs automatically when the Chrome extension requests a TCP Native connection. The host:

1. Receives connection requests from the Chrome extension
2. Establishes TCP socket connections to specified hosts/ports
3. Proxies data bidirectionally between Chrome extension and TCP server
4. Handles connection lifecycle (connect, send, receive, disconnect)

## Logging

Activity logs are written to `/tmp/native-host-log.txt` for debugging purposes.

## Protocol

The native host communicates with Chrome using the Native Messaging protocol:

### Messages from Extension:
- `{type: "connect", host: "127.0.0.1", port: 5020}` - Establish TCP connection
- `{type: "send", data: "01 03 00 00 00 0A"}` - Send hex data
- `{type: "disconnect"}` - Close TCP connection

### Messages to Extension:
- `{type: "proxy_started"}` - Host ready
- `{type: "tcp_connected", host, port}` - TCP connection established
- `{type: "tcp_disconnected"}` - TCP connection closed
- `{type: "data", data: "01 03 14 ..."}` - Received hex data
- `{type: "tcp_error", message}` - Connection error

## Troubleshooting

### Connection Failed
1. Check that Node.js is installed and accessible
2. Verify extension ID in manifest.json is correct
3. Check logs in `/tmp/native-host-log.txt`
4. Restart Chrome completely

### Permission Denied
1. Ensure install.sh was run with proper permissions
2. Check that manifest.json was copied to correct location
3. Verify Chrome can read the manifest file

### Path Issues
The `run.sh` script automatically detects Node.js installation from:
- System PATH
- NVM installation
- Homebrew installation
- Manual installations in common locations

## Security Notes

- Only connects to hosts/ports specified by the extension
- Validates all hex data before sending
- Logs connection attempts for security auditing
- Designed for development/debugging use cases

## License

MIT License - See package.json for details