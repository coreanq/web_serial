#!/bin/bash

# Comprehensive build and package script for stdio-proxy
# Builds executables for all platforms and creates distribution packages

echo "🔨 Building stdio-proxy executables and distribution packages..."
echo ""

# Install pkg if not already installed
if ! command -v pkg &> /dev/null; then
    echo "📦 Installing pkg globally..."
    npm install -g pkg
fi

# Create dist directory
mkdir -p dist

# ============================================================================
# STEP 1: Build executables for all platforms
# ============================================================================

echo "🏗️  STEP 1: Building executables..."
echo ""

echo "🍎 Building for macOS x64..."
pkg . --targets node18-macos-x64 --output ./dist/stdio-proxy-macos-x64

echo "🪟 Building for Windows x64..."
pkg . --targets node18-win-x64 --output ./dist/stdio-proxy-windows-x64.exe

echo "🐧 Building for Linux x64..."
pkg . --targets node18-linux-x64 --output ./dist/stdio-proxy-linux-x64

echo ""
echo "✅ Build complete! Files created:"
ls -la dist/

# ============================================================================
# STEP 2: Create distribution packages
# ============================================================================

echo ""
echo "📦 STEP 2: Creating distribution packages..."
echo ""

# Ensure built files exist
if [ ! -f "dist/stdio-proxy-macos-x64" ]; then
    echo "❌ macOS executable not found!"
    exit 1
fi

# Create packages directory
mkdir -p packages
rm -rf packages/*

# ----------------------------------------------------------------------------
# macOS package
# ----------------------------------------------------------------------------
echo "🍎 Creating macOS package..."

mkdir -p packages/stdio-proxy-macos
cp dist/stdio-proxy-macos-x64 packages/stdio-proxy-macos/
cp install-macos.sh packages/stdio-proxy-macos/

cat > packages/stdio-proxy-macos/README.md << 'EOF'
# stdio-proxy for macOS

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Open Terminal and navigate to this folder
2. Run the installation script:
   ```bash
   chmod +x install-macos.sh
   ./install-macos.sh
   ```
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- `stdio-proxy-macos-x64` - Native host executable
- `install-macos.sh` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.
EOF

cat > packages/stdio-proxy-macos/INSTALL.txt << 'EOF'
# stdio-proxy for macOS

## Quick Install:
1. Open Terminal
2. cd to this folder
3. Run: chmod +x install-macos.sh
4. Run: ./install-macos.sh
5. Restart your browser

## Files:
- stdio-proxy-macos-x64: The native host executable
- install-macos.sh: Installation script
- README.md: Detailed documentation

## Supported Browsers:
Chrome, Edge, Brave, Opera, Vivaldi, Chromium
EOF

cd packages
zip -r stdio-proxy-macos.zip stdio-proxy-macos/
cd ..
echo "✅ Created: packages/stdio-proxy-macos.zip"

# ----------------------------------------------------------------------------
# Windows package
# ----------------------------------------------------------------------------
echo ""
echo "🪟 Creating Windows package..."

mkdir -p packages/stdio-proxy-windows
cp dist/stdio-proxy-windows-x64.exe packages/stdio-proxy-windows/
cp install-windows.bat packages/stdio-proxy-windows/

cat > packages/stdio-proxy-windows/README.md << 'EOF'
# stdio-proxy for Windows

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Double-click `install-windows.bat`
2. Follow the prompts
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- `stdio-proxy-windows-x64.exe` - Native host executable
- `install-windows.bat` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.

## Note

Windows may show a security warning for the executable. This is normal for unsigned binaries.
EOF

cat > packages/stdio-proxy-windows/INSTALL.txt << 'EOF'
# stdio-proxy for Windows

## Quick Install:
1. Extract this archive
2. Double-click install-windows.bat
3. Follow the prompts
4. Restart your browser

## Files:
- stdio-proxy-windows-x64.exe: The native host executable
- install-windows.bat: Installation script
- README.md: Detailed documentation

## Supported Browsers:
Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Note:
Windows may show a security warning for the executable.
This is normal for unsigned binaries.
EOF

cd packages
zip -r stdio-proxy-windows.zip stdio-proxy-windows/
cd ..
echo "✅ Created: packages/stdio-proxy-windows.zip"

# ----------------------------------------------------------------------------
# Linux package
# ----------------------------------------------------------------------------
echo ""
echo "🐧 Creating Linux package..."

mkdir -p packages/stdio-proxy-linux
cp dist/stdio-proxy-linux-x64 packages/stdio-proxy-linux/
cp install-linux.sh packages/stdio-proxy-linux/

cat > packages/stdio-proxy-linux/README.md << 'EOF'
# stdio-proxy for Linux

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Open terminal and navigate to this folder
2. Run the installation script:
   ```bash
   chmod +x install-linux.sh
   ./install-linux.sh
   ```
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- `stdio-proxy-linux-x64` - Native host executable
- `install-linux.sh` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.

## Supported Distributions

Ubuntu, Debian, Fedora, CentOS, Arch, and most others
EOF

cat > packages/stdio-proxy-linux/INSTALL.txt << 'EOF'
# stdio-proxy for Linux

## Quick Install:
1. Extract this archive
2. Open terminal in this folder
3. Run: chmod +x install-linux.sh
4. Run: ./install-linux.sh
5. Restart your browser

## Files:
- stdio-proxy-linux-x64: The native host executable
- install-linux.sh: Installation script
- README.md: Detailed documentation

## Supported Browsers:
Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Supported Distributions:
Ubuntu, Debian, Fedora, CentOS, Arch, and most others
EOF

cd packages
tar -czf stdio-proxy-linux.tar.gz stdio-proxy-linux/
cd ..
echo "✅ Created: packages/stdio-proxy-linux.tar.gz"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "🎉 Build and packaging completed successfully!"
echo ""
echo "📁 Built executables (dist/):"
echo "  • stdio-proxy-macos-x64        (macOS x64 executable)"
echo "  • stdio-proxy-windows-x64.exe  (Windows x64 executable)"  
echo "  • stdio-proxy-linux-x64        (Linux x64 executable)"
echo ""
echo "📦 Distribution packages (packages/):"
ls -lah packages/
echo ""
echo "📤 Ready for GitHub Release:"
echo "  • stdio-proxy-macos.zip      (macOS users)"
echo "  • stdio-proxy-windows.zip    (Windows users)"
echo "  • stdio-proxy-linux.tar.gz   (Linux users)"
echo ""
echo "🚀 Complete workflow: Build → Package → Ready for distribution!"
echo "💡 Users can now download one file and run the install script!"