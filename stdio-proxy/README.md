# stdio-proxy

Chrome Native Messaging Host for TCP proxy connections. Enables the Modbus Protocol Debugger Chrome Extension to establish direct TCP connections, bypassing browser security restrictions.

## Overview

This native messaging host allows the Chrome extension to:
- Connect directly to TCP servers (ModbusTCP devices)
- Send and receive binary data over TCP connections
- Bypass browser CORS and security limitations
- Provide stable, low-latency communication

## Supported Browsers

- Chrome, Chrome Beta/Dev/Canary
- Microsoft Edge, Edge Beta/Dev
- Brave Browser
- Opera
- Vivaldi
- Chromium

## Quick Installation (Users)

### 1. Download Installation Package
- **macOS**: Download `stdio-proxy-macos.zip`
- **Windows**: Download `stdio-proxy-windows.zip`  
- **Linux**: Download `stdio-proxy-linux.tar.gz`

### 2. Extract and Install
**macOS:**
```bash
unzip stdio-proxy-macos.zip
cd stdio-proxy-macos
chmod +x install-macos.sh
./install-macos.sh
```

**Windows:**
1. Extract `stdio-proxy-windows.zip`
2. Double-click `install-windows.bat`

**Linux:**
```bash
tar -xzf stdio-proxy-linux.tar.gz
cd stdio-proxy-linux
chmod +x install-linux.sh
./install-linux.sh
```

### 3. Restart Browser
Restart your browser completely and test TCP Native connection in the extension.

The installation script automatically:
- Detects your Extension ID
- Installs for all available Chromium-based browsers
- Sets up proper permissions

## Development

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn package manager

### Setup
```bash
# Clone and setup
cd stdio-proxy
npm install

# Install pkg globally (for building executables)
npm install -g pkg
```

### Building Executables
```bash
# Build all platforms
npm run build

# Or individual platforms
npm run build:macos
npm run build:windows  
npm run build:linux

# Or use build script directly
./build.sh
```

### Creating Distribution Packages
```bash
# Build + Package in one step
npm run release

# Or step by step
npm run build
npm run package

# Or use script directly
./package-dist.sh
```

### Build Results
```bash
# Executables in dist/
stdio-proxy-macos-x64        # macOS executable
stdio-proxy-windows-x64.exe  # Windows executable
stdio-proxy-linux-x64        # Linux executable

# Distribution packages in packages/
stdio-proxy-macos.zip        # macOS distribution package
stdio-proxy-windows.zip      # Windows distribution package
stdio-proxy-linux.tar.gz     # Linux distribution package
```

### Publishing Release
1. Go to GitHub "Releases" page
2. Click "Create a new release"
3. Enter version tag (e.g., v1.0.0)
4. Upload distribution packages:
   - `stdio-proxy-macos.zip`
   - `stdio-proxy-windows.zip`
   - `stdio-proxy-linux.tar.gz`
5. Update download URLs in Chrome extension

## Technical Details

### Native Messaging Protocol

**Messages from Extension:**
- `{type: "connect", host: "127.0.0.1", port: 5020}` - Establish TCP connection
- `{type: "send", data: "01 03 00 00 00 0A"}` - Send hex data
- `{type: "disconnect"}` - Close TCP connection

**Messages to Extension:**
- `{type: "proxy_started"}` - Host ready
- `{type: "tcp_connected", host, port}` - TCP connection established
- `{type: "tcp_disconnected"}` - TCP connection closed
- `{type: "data", data: "01 03 14 ..."}` - Received hex data
- `{type: "tcp_error", message}` - Connection error

### Logging
Activity logs are written to `/tmp/native-host-log.txt` for debugging purposes.

### File Structure
- `proxy.js` - Main native messaging host application
- `install-*.sh` / `install-*.bat` - Installation scripts
- `build.sh` - Build script for all platforms
- `package-dist.sh` - Distribution packaging script
- `package.json` - Node.js package configuration

## Troubleshooting

### Connection Failed
1. Verify extension ID is correct
2. Check logs in `/tmp/native-host-log.txt`
3. Restart browser completely
4. Try different browser (Chrome, Edge, Brave)

### Permission Denied
1. Ensure installation script ran successfully
2. Check executable permissions (macOS/Linux)
3. Verify manifest files are in correct locations

### Windows Security Warnings
- Windows may show security warnings for unsigned executables
- This is normal for standalone binaries
- Add to antivirus exceptions if needed

### macOS Security Warnings
- macOS may show "unidentified developer" warnings
- Right-click executable and select "Open" to bypass
- Or disable Gatekeeper temporarily

## Security Notes

- Only connects to hosts/ports specified by the extension
- Validates all hex data before sending
- Logs connection attempts for security auditing
- Designed for development/debugging use cases

## License

MIT License - See package.json for details