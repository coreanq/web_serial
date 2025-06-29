#!/bin/bash

# Linux Installation script for stdio-proxy Native Host
# This script installs the native messaging host for Chrome extension

echo "🐧 Installing stdio-proxy Native Host for Linux..."

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get Chrome Extension ID
EXTENSION_ID=""
if [ -f "$DIR/extension-id.txt" ]; then
    EXTENSION_ID=$(cat "$DIR/extension-id.txt" | tr -d '\n\r')
    echo "📋 Using Extension ID from file: $EXTENSION_ID"
else
    echo "⚠️  Extension ID file not found. Please create 'extension-id.txt' with your Chrome extension ID."
    echo "   You can find your extension ID at chrome://extensions"
    read -p "   Enter your Extension ID: " EXTENSION_ID
    echo "$EXTENSION_ID" > "$DIR/extension-id.txt"
fi

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Extension ID is required. Installation aborted."
    exit 1
fi

# Create manifest with the actual extension ID
MANIFEST_CONTENT='{
  "name": "com.my_company.stdio_proxy",
  "description": "stdio-proxy Native Messaging Host",
  "path": "'$DIR'/stdio-proxy-linux-x64",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://'$EXTENSION_ID'/"
  ]
}'

# Native messaging host directories for different browsers
NATIVE_HOST_DIRS=(
    "$HOME/.config/google-chrome/NativeMessagingHosts"
    "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
    "$HOME/.config/google-chrome-unstable/NativeMessagingHosts"
    "$HOME/.config/chromium/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge-beta/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge-dev/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "$HOME/.config/opera/NativeMessagingHosts"
    "$HOME/.config/vivaldi/NativeMessagingHosts"
)

# Install manifest for all detected browsers
INSTALLED_COUNT=0
for dir in "${NATIVE_HOST_DIRS[@]}"; do
    # Check if browser directory exists (indicating browser is installed)
    BROWSER_DIR=$(dirname "$dir")
    if [ -d "$BROWSER_DIR" ]; then
        mkdir -p "$dir"
        echo "$MANIFEST_CONTENT" > "$dir/com.my_company.stdio_proxy.json"
        BROWSER_NAME=$(echo "$BROWSER_DIR" | sed 's/.*\///' | sed 's/google-chrome/Chrome/' | sed 's/microsoft-edge/Edge/' | sed 's/BraveSoftware\/Brave-Browser/Brave/')
        echo "📁 Installed for: $BROWSER_NAME"
        INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    fi
done

if [ $INSTALLED_COUNT -eq 0 ]; then
    echo "⚠️  No Chromium-based browsers found. Installing for Chrome (default)..."
    mkdir -p "${NATIVE_HOST_DIRS[0]}"
    echo "$MANIFEST_CONTENT" > "${NATIVE_HOST_DIRS[0]}/com.my_company.stdio_proxy.json"
    INSTALLED_COUNT=1
fi

# Make executable file executable
chmod +x "$DIR/stdio-proxy-linux-x64"

echo "✅ Installation completed!"
echo ""
echo "📁 Files installed:"
echo "   • Executable: $DIR/stdio-proxy-linux-x64"
echo "   • Manifests installed for $INSTALLED_COUNT browser(s)"
echo ""
echo "🌐 Supported browsers:"
echo "   • Chrome, Chrome Beta/Unstable"
echo "   • Microsoft Edge, Edge Beta/Dev"
echo "   • Brave Browser"
echo "   • Opera"
echo "   • Vivaldi"
echo "   • Chromium"
echo ""
echo "🔄 Next steps:"
echo "   1. Restart your browser completely"
echo "   2. Reload your extension"
echo "   3. Try connecting via TCP Native tab"
echo ""
echo "🔍 Troubleshooting:"
echo "   • Check logs: /tmp/native-host-log.txt"
echo "   • Verify Extension ID: $EXTENSION_ID"