# stdio-proxy - Chrome Native Messaging Host

TCP proxy for Chrome extensions using Native Messaging API. Enables direct TCP socket connections from Chrome extensions for ModbusTCP debugging and analysis.

## Installation Methods

### Method 1: npm Package (Recommended)

Install directly from npm with automatic Native Host registration:

```bash
# Global installation
npm install -g stdio-proxy

# Local installation (in your project)
npm install stdio-proxy
```

The installation will automatically:
- Register Native Messaging Host manifests for all supported browsers
- Create Windows registry entries (on Windows)
- Set up proper file paths for Node.js execution
- Prompt for Chrome Extension ID

#### Manual Registration (if needed)

```bash
# If postinstall didn't run or you need to re-register
node scripts/install-native-host.js

# To uninstall/remove registration
node scripts/uninstall-native-host.js
```

### Method 2: Compiled Binaries

Download pre-compiled binaries for your platform:

1. **Download**: Get the appropriate package for your OS
   - Windows: `stdio-proxy-windows.zip`
   - macOS: `stdio-proxy-macos.zip` 
   - Linux: `stdio-proxy-linux.zip`

2. **Extract**: Unzip to a permanent location

3. **Install**: Run the installation script
   ```bash
   # Windows
   install-windows.bat
   
   # macOS/Linux
   chmod +x install-macos.sh
   ./install-macos.sh
   ```

## Supported Browsers

- Google Chrome (all channels: Stable, Beta, Dev, Canary)
- Microsoft Edge
- Brave Browser
- Opera
- Vivaldi
- Chromium

## How it Works

### npm Installation
- Uses Node.js binary as the executable
- Passes `proxy.js` as an argument to Node.js
- Automatically handles cross-platform path resolution
- No compilation required - works on any system with Node.js 22+

### Binary Installation
- Self-contained executable (no Node.js required)
- Compiled with pkg for maximum compatibility
- Direct execution without dependencies

## Configuration

The Native Host registers with the name: `com.my_company.stdio_proxy`

### Manifest Structure (npm)
```json
{
  "name": "com.my_company.stdio_proxy",
  "description": "stdio-proxy Native Messaging Host (Node.js)",
  "path": "/path/to/node",
  "args": ["/path/to/proxy.js"],
  "type": "stdio",
  "allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
}
```

### Manifest Structure (binary)
```json
{
  "name": "com.my_company.stdio_proxy", 
  "description": "stdio-proxy Native Messaging Host",
  "path": "/path/to/stdio-proxy-executable",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
}
```

## Registry/File Locations

### Windows
- **User Manifests**: `%LOCALAPPDATA%\[Browser]\User Data\NativeMessagingHosts\`
- **Registry**: `HKEY_CURRENT_USER\Software\[Browser]\NativeMessagingHosts\`

### macOS
- **User Manifests**: `~/Library/Application Support/[Browser]/NativeMessagingHosts/`

### Linux
- **User Manifests**: `~/.config/[browser]/NativeMessagingHosts/`

## Requirements

### npm Installation
- Node.js 22.0.0 or higher
- npm or yarn package manager

### Binary Installation
- No runtime dependencies
- Pre-compiled for Node.js 22 runtime

## Development

```bash
# Clone and setup
git clone <repository>
cd stdio-proxy
npm install

# Development mode
npm run dev

# Build TypeScript
npm run build

# Create all platform binaries
npm run package
```

## Troubleshooting

### Common Issues

1. **Extension ID Missing**: Ensure you provide the correct 32-character Extension ID
2. **Browser Not Found**: Install will attempt all browsers but only registers for installed ones  
3. **Permission Errors**: On Windows, try running as Administrator for system-wide registration
4. **Node.js Version**: Ensure Node.js 22+ is installed and accessible in PATH

### Manual Verification

Check if Native Host is registered:

```bash
# Windows Registry
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.my_company.stdio_proxy"

# macOS/Linux - Check manifest files
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
ls ~/.config/google-chrome/NativeMessagingHosts/
```

### Debug Mode

Enable debugging in your Chrome extension:
```javascript
chrome.runtime.connectNative('com.my_company.stdio_proxy');
```

Check Chrome's extension logs at `chrome://extensions/` → Developer mode → Background page.

## License

MIT License - See LICENSE file for details.