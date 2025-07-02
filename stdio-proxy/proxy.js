#!/usr/bin/env node
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Check if running in test mode
const isTestMode = process.argv.includes('--test') || process.argv.includes('-t');

// --- Logging Setup --- //
const getLogFilePath = () => {
    const logPaths = [];
    
    try {
        // Try multiple locations in order of preference
        if (process.pkg) {
            // For packaged executable
            logPaths.push(path.join(path.dirname(process.execPath), 'native-host-log.txt'));
        }
        
        // Windows-specific user directories
        if (process.platform === 'win32') {
            if (process.env.LOCALAPPDATA) {
                logPaths.push(path.join(process.env.LOCALAPPDATA, 'native-host-log.txt'));
            }
            if (process.env.APPDATA) {
                logPaths.push(path.join(process.env.APPDATA, 'native-host-log.txt'));
            }
            if (process.env.USERPROFILE) {
                logPaths.push(path.join(process.env.USERPROFILE, 'native-host-log.txt'));
            }
        }
        
        // System temp directory
        logPaths.push(path.join(os.tmpdir(), 'native-host-log.txt'));
        
        // Current working directory
        logPaths.push(path.join(process.cwd(), 'native-host-log.txt'));
        
        // Relative path as last resort
        logPaths.push('./native-host-log.txt');
        
        // Try each path until one works
        for (const logPath of logPaths) {
            try {
                const dir = path.dirname(logPath);
                // Test if we can write to this directory
                fs.accessSync(dir, fs.constants.F_OK | fs.constants.W_OK);
                return logPath;
            } catch (e) {
                // Try next path
                continue;
            }
        }
        
        // If all else fails, return the temp directory path
        return logPaths[logPaths.length - 3]; // temp directory
        
    } catch (error) {
        return './native-host-log.txt';
    }
};

const LOG_FILE = getLogFilePath();

function log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    
    // Force output to stderr (won't interfere with native messaging)
    try {
        process.stderr.write(logLine + '\n');
    } catch (e) {
        // Fallback if stderr fails
    }
    
    // Additional Windows-specific output methods
    if (process.platform === 'win32') {
        try {
            // Try multiple output methods for Windows cmd.exe
            console.error(logLine);
            console.warn(logLine);
            
            // Force flush if available
            if (process.stderr.cork) {
                process.stderr.cork();
                process.stderr.write(logLine + '\n');
                process.stderr.uncork();
            }
            
            // Windows Event Log (for debugging)
            try {
                const { execSync } = require('child_process');
                const eventCmd = `eventcreate /T INFORMATION /ID 1000 /L APPLICATION /SO "Native-Host" /D "${message.replace(/"/g, '\\"')}"`;
                execSync(eventCmd, { stdio: 'ignore' });
            } catch (eventError) {
                // Ignore event log errors
            }
            
        } catch (e) {
            // Ignore errors
        }
    } else {
        console.error(logLine);
    }
    
    // Log to file with multiple attempts - FORCE CREATE
    const attempts = [LOG_FILE];
    
    // Add backup locations if primary LOG_FILE fails
    if (process.platform === 'win32') {
        // Windows specific high-priority locations
        attempts.push(path.join('C:\\', 'native-host-debug.txt'));
        attempts.push(path.join('C:\\Windows\\Temp', 'native-host-debug.txt'));
        if (process.env.TEMP) {
            attempts.push(path.join(process.env.TEMP, 'native-host-log.txt'));
        }
        if (process.env.TMP) {
            attempts.push(path.join(process.env.TMP, 'native-host-log.txt'));
        }
        if (process.env.USERPROFILE) {
            attempts.push(path.join(process.env.USERPROFILE, 'Desktop', 'native-host-debug.txt'));
        }
    }
    attempts.push('./native-host-log.txt');
    
    let written = false;
    let usedPath = null;
    for (const logPath of attempts) {
        try {
            // Try to create directory if doesn't exist
            const dir = path.dirname(logPath);
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (mkdirError) {
                // Ignore mkdir errors
            }
            
            // Try to write
            fs.appendFileSync(logPath, logLine + '\n', { flag: 'a' });
            written = true;
            usedPath = logPath;
            break;
        } catch (e) {
            // Try next location
            continue;
        }
    }
    
    // Last resort - try to write to a simple file
    if (!written && process.platform === 'win32') {
        try {
            fs.writeFileSync('debug.txt', logLine + '\n', { flag: 'a' });
            written = true;
            usedPath = 'debug.txt';
        } catch (e) {
            // Even this failed
        }
    }
    
    if (!written) {
        console.error(`❌ Failed to write to any log file location`);
    } else if (usedPath && usedPath !== LOG_FILE) {
        console.error(`📝 Logging to: ${usedPath}`);
    }
}

// Force immediate output with Windows-specific handling
const forceOutput = (message) => {
    const line = `${new Date().toISOString()} - ${message}\n`;
    
    // Primary stderr output
    try {
        process.stderr.write(line);
    } catch (e) {
        // Ignore stderr errors in packaged executable
    }
    
    // Windows-specific console output attempts
    if (process.platform === 'win32') {
        try {
            console.error(message);
            console.warn(message);
            console.log(message); // Try all console methods
            
            // Force output if running from console
            if (process.stdout.isTTY || process.stderr.isTTY) {
                process.stdout.write(line);
            }
        } catch (e) {
            // Ignore console errors in packaged executable
        }
    }
};

// Immediate startup output with crash detection
forceOutput('=== PROXY STARTING ===');
forceOutput(`Platform: ${process.platform}`);
forceOutput(`Node.js: ${process.version}`);
forceOutput(`PID: ${process.pid}`);
forceOutput(`Args: ${process.argv.join(' ')}`);
forceOutput(`Test Mode: ${isTestMode}`);
forceOutput(`CWD: ${process.cwd()}`);
forceOutput(`Environment: ${process.env.NODE_ENV || 'development'}`);
forceOutput(`Executable: ${process.execPath}`);

// Force create a startup indicator file
try {
    const startupFile = process.platform === 'win32' ? 'C:\\native-host-started.txt' : './native-host-started.txt';
    fs.writeFileSync(startupFile, `Started at: ${new Date().toISOString()}\nPID: ${process.pid}\n`);
    forceOutput(`Startup file created: ${startupFile}`);
} catch (e) {
    forceOutput(`Failed to create startup file: ${e.message}`);
}

// Log startup information
log('=== Native Messaging Host Started ===');
log(`Node.js version: ${process.version}`);
log(`Log file location: ${LOG_FILE}`);

// Test mode - don't listen to stdin, just output info and exit
if (isTestMode) {
    forceOutput('=== TEST MODE ACTIVE ===');
    log('Running in test mode');
    log('Testing TCP connection to localhost:5020...');
    
    const testSocket = new net.Socket();
    testSocket.setTimeout(3000);
    
    testSocket.connect(5020, 'localhost', () => {
        log('✅ TCP connection test successful');
        testSocket.end();
        setTimeout(() => {
            log('Test completed. Exiting...');
            process.exit(0);
        }, 1000);
    });
    
    testSocket.on('error', (err) => {
        log(`❌ TCP connection test failed: ${err.message}`);
        setTimeout(() => {
            log('Test completed with errors. Exiting...');
            process.exit(1);
        }, 1000);
    });
    
    testSocket.on('timeout', () => {
        log('❌ TCP connection test timed out');
        testSocket.destroy();
        setTimeout(() => {
            log('Test completed with timeout. Exiting...');
            process.exit(1);
        }, 1000);
    });
    
    // Exit after 10 seconds regardless
    setTimeout(() => {
        log('Test timeout reached. Exiting...');
        process.exit(0);
    }, 10000);
    
} else {

// --- Native Messaging I/O --- //

// Check if stdin is available for Native Messaging
log('Checking Native Messaging environment...');
log(`stdin.isTTY: ${process.stdin.isTTY}`);
log(`stdout.isTTY: ${process.stdout.isTTY}`);
log(`stderr.isTTY: ${process.stderr.isTTY}`);

// Test if we can read from stdin
try {
    log('Setting up stdin for Native Messaging...');
    process.stdin.resume();
    process.stdin.setEncoding('binary');
    log('stdin setup completed');
} catch (error) {
    log(`stdin setup failed: ${error.message}`);
    // Continue anyway
}

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
    log(`Stack trace: ${error.stack}`);
    if (process.platform === 'win32') {
        log(`Windows specific error details:`);
        log(`Error code: ${error.code || 'N/A'}`);
        log(`Error errno: ${error.errno || 'N/A'}`);
        log(`Error syscall: ${error.syscall || 'N/A'}`);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}`);
    log(`Reason: ${reason}`);
    if (process.platform === 'win32') {
        log('Windows specific unhandled rejection');
    }
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
log('Sending proxy_started message to Chrome');
try {
    sendMessage({ type: 'proxy_started' });
    log('Successfully sent proxy_started message');
} catch (error) {
    log(`Failed to send proxy_started message: ${error.message}`);
    if (process.platform === 'win32') {
        log('Windows Native Messaging communication error');
        log(`Error details: ${JSON.stringify(error)}`);
    }
}

} // End of else block (non-test mode)