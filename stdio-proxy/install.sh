#!/bin/bash
# install.sh - Installs the native messaging host for macOS and Linux.

set -e

# --- Configuration ---
# The ID of the Chrome extension that will connect to this host.
# IMPORTANT: Replace this with your actual extension ID.
# You can find it in Chrome at chrome://extensions
# For development, you can also use a wildcard pattern (not recommended for production)
EXTENSION_ID="${EXTENSION_ID:-*}"

echo "Using Extension ID: $EXTENSION_ID"
if [ "$EXTENSION_ID" == "*" ]; then
    echo "⚠️  WARNING: Using wildcard (*) for Extension ID - this allows any extension to connect"
    echo "   Set EXTENSION_ID environment variable or edit this script with your actual extension ID"
fi 

# The name of the native messaging host. Must match the name in the extension's code.
HOST_NAME="com.my_company.stdio_proxy"

# --- Script Logic ---
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# The manifest path should point to our wrapper script.
PROXY_SCRIPT_PATH="$SCRIPT_DIR/run.sh"

# Check if node is installed
if ! command -v node &> /dev/null
then
    echo "Error: Node.js is not installed. Please install it to run the native messaging host."
    exit 1
fi

# Determine the target directory for the manifest file based on the OS.
if [ "$(uname)" == "Darwin" ]; then
  TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else # Assuming Linux
  TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

# Create the target directory if it doesn't exist.
mkdir -p "$TARGET_DIR"

# Create the manifest file content.
# Note: We use #!/usr/bin/env node to ensure the script runs with the user's installed Node.js.
# We also need to make the proxy script executable.
chmod +x "$PROXY_SCRIPT_PATH"

# The path in the manifest must be absolute.
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOL
{
  "name": "$HOST_NAME",
  "description": "TCP Proxy for Modbus Debugger",
  "path": "$PROXY_SCRIPT_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOL

echo "Native messaging host '$HOST_NAME' has been installed successfully."
echo "Manifest file created at: $TARGET_DIR/$HOST_NAME.json"
echo ""
echo "IMPORTANT: Update the EXTENSION_ID in this script with your actual Chrome extension ID"
echo "Current ID: $EXTENSION_ID"
echo "You can find your extension ID at chrome://extensions"
echo ""
echo "To test the installation:"
echo "1. Load your Chrome extension"
echo "2. Use the TCP Native tab to connect to a TCP device"
echo "3. Check logs at /tmp/native-host-log.txt if needed"
