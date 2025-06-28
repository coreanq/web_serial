#!/bin/bash
# This script acts as a wrapper for the Node.js proxy to log any errors.
# The native messaging manifest will point to this script.

# Define a log file path. Using /tmp is common for temporary logs.
LOG_FILE="/tmp/native-host-log.txt"

# Get the directory where the script is located, so we can find proxy.js
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Log a timestamp to know when the host was started.
echo "---" >> "$LOG_FILE"
echo "Native host started at: $(date)" >> "$LOG_FILE"
echo "Executing: node $DIR/proxy.js" >> "$LOG_FILE"

# Execute the actual Node.js script.
# 'exec' replaces the shell process with the node process.
# We redirect stderr (2) to our log file.

# Try to find node in common locations
NODE_PATH=""

# Check if node is in PATH
if command -v node >/dev/null 2>&1; then
    NODE_PATH="node"
# Check common NVM locations
elif [ -f "$HOME/.nvm/versions/node/v22.16.0/bin/node" ]; then
    NODE_PATH="$HOME/.nvm/versions/node/v22.16.0/bin/node"
elif [ -f "/usr/local/bin/node" ]; then
    NODE_PATH="/usr/local/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
else
    echo "Node.js not found" >> "$LOG_FILE"
    exit 1
fi

echo "Using Node.js: $NODE_PATH" >> "$LOG_FILE"
exec "$NODE_PATH" "$DIR/proxy.js" 2>> "$LOG_FILE"
