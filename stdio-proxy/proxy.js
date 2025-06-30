#!/usr/bin/env node
import net from 'net';
import fs from 'fs';

// --- Logging Setup --- //
const LOG_FILE = '/tmp/native-host-log.txt';

function log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (e) {
        // Ignore logging errors
    }
}

// Log startup information
log('=== Native Messaging Host Started ===');
log(`Node.js version: ${process.version}`);

// --- Native Messaging I/O --- //

process.stdin.resume();
process.stdin.setEncoding('binary');

let inputBuffer = '';

// Handle process termination
process.on('exit', (code) => {
    log(`Process exiting with code: ${code}`);
});

process.on('SIGINT', () => {
    log('Received SIGINT, exiting gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Received SIGTERM, exiting gracefully');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`);
    process.exit(1);
});

// Function to send a message to Chrome
function sendMessage(msg) {
    try {
        const msgStr = JSON.stringify(msg);
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(msgStr.length, 0);
        process.stdout.write(buffer);
        process.stdout.write(msgStr);
    } catch (error) {
        log(`Error sending message: ${error.message}`);
    }
}

// Function to handle incoming data from stdin
process.stdin.on('data', (chunk) => {
    try {
        inputBuffer += chunk;

        while (inputBuffer.length >= 4) {
            // Read the message length (4 bytes, little-endian)
            const byte0 = inputBuffer.charCodeAt(0) & 0xFF;
            const byte1 = inputBuffer.charCodeAt(1) & 0xFF;
            const byte2 = inputBuffer.charCodeAt(2) & 0xFF;
            const byte3 = inputBuffer.charCodeAt(3) & 0xFF;
            
            const messageLength = byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);
            const messageEnd = 4 + messageLength;

            // Sanity check for message length
            if (messageLength > 1024 * 1024) { // > 1MB
                log(`Invalid message length: ${messageLength}, resetting buffer`);
                inputBuffer = '';
                break;
            }

            if (inputBuffer.length >= messageEnd) {
                // Extract the message data
                const messageData = inputBuffer.slice(4, messageEnd);
                try {
                    const parsedMessage = JSON.parse(messageData);
                    handleAppMessage(parsedMessage);
                } catch (parseError) {
                    log(`JSON parse error: ${parseError.message}`);
                }
                
                // Remove processed message from buffer
                inputBuffer = inputBuffer.slice(messageEnd);
            } else {
                break; // Not enough data for a full message
            }
        }
    } catch (error) {
        log(`Error processing stdin data: ${error.message}`);
        inputBuffer = '';
    }
});

// --- TCP Proxy Logic --- //

let tcpSocket = null;
let isConnected = false;

function handleAppMessage(data) {
    try {
        switch (data.type) {
            case 'connect':
                handleTcpConnect(data);
                break;
            case 'disconnect':
                handleTcpDisconnect();
                break;
            case 'send':
                handleDataSend(data);
                break;
            default:
                log(`Unknown command: ${data.type}`);
                sendMessage({ type: 'error', message: `Unknown command: ${data.type}` });
        }
    } catch (error) {
        log(`Error handling message: ${error.message}`);
        sendMessage({ type: 'error', message: `Message handling error: ${error.message}` });
    }
}

function handleTcpConnect(data) {
    const { host, port } = data;
    if (!host || !port) {
        return sendMessage({ type: 'error', message: 'Host and port are required.' });
    }

    // Prevent duplicate connections
    if (isConnected && tcpSocket) {
        return;
    }

    // Clean up existing socket if any
    if (tcpSocket) {
        tcpSocket.removeAllListeners();
        tcpSocket.destroy();
        tcpSocket = null;
        isConnected = false;
    }

    log(`Connecting to ${host}:${port}`);
    tcpSocket = new net.Socket();
    
    tcpSocket.connect(port, host, () => {
        isConnected = true;
        log(`Connected to ${host}:${port}`);
        sendMessage({ type: 'tcp_connected', host, port });
    });

    tcpSocket.on('data', (tcpData) => {
        sendMessage({ type: 'data', data: bufferToHex(tcpData) });
    });

    tcpSocket.on('close', () => {
        log('TCP connection closed');
        isConnected = false;
        tcpSocket = null;
        sendMessage({ type: 'tcp_disconnected' });
    });

    tcpSocket.on('error', (err) => {
        log(`TCP error: ${err.message}`);
        isConnected = false;
        sendMessage({ type: 'tcp_error', message: err.message });
        if (tcpSocket) {
            tcpSocket.removeAllListeners();
            tcpSocket.destroy();
            tcpSocket = null;
        }
    });
}

function handleTcpDisconnect() {
    if (tcpSocket && isConnected) {
        log('Disconnecting TCP connection');
        tcpSocket.end();
    }
}

function handleDataSend(data) {
    if (!isConnected || !tcpSocket) {
        return sendMessage({ type: 'error', message: 'Not connected to TCP server.' });
    }

    try {
        const hexData = data.data;
        if (!hexData) {
            return sendMessage({ type: 'error', message: 'No data provided.' });
        }

        // Convert hex string to buffer
        const cleanHex = hexData.replace(/\s+/g, '');
        
        // Validate hex string
        if (!/^[0-9A-Fa-f]*$/.test(cleanHex)) {
            return sendMessage({ type: 'error', message: 'Invalid hex data format.' });
        }

        if (cleanHex.length % 2 !== 0) {
            return sendMessage({ type: 'error', message: 'Hex data must have even number of characters.' });
        }

        const buffer = Buffer.from(cleanHex, 'hex');
        tcpSocket.write(buffer);
    } catch (error) {
        log(`Error sending data: ${error.message}`);
        sendMessage({ type: 'error', message: `Data send error: ${error.message}` });
    }
}

// Helper function to convert buffer to hex string
function bufferToHex(buffer) {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
}

// Send initial proxy_started message
sendMessage({ type: 'proxy_started' });