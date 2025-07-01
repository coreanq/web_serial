#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

const HOST_NAME = 'com.my_company.stdio_proxy';

// Platform detection
const platform = process.platform;
const isWindows = platform === 'win32';
const isMacOS = platform === 'darwin';
const isLinux = platform === 'linux';

console.log(`\n🔌 Installing Native Messaging Host for ${platform}...`);

// Get Chrome Extension ID from user
async function getExtensionId() {
  const extensionIdFile = join(packageRoot, 'extension-id.txt');
  
  if (existsSync(extensionIdFile)) {
    const extensionId = readFileSync(extensionIdFile, 'utf8').trim();
    if (extensionId) {
      console.log(`📋 Using Extension ID from file: ${extensionId}`);
      return extensionId;
    }
  }
  
  // Interactive prompt for Extension ID
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = promisify(rl.question).bind(rl);
  
  console.log(`\n⚠️  Chrome Extension ID required!`);
  console.log(`   You can find your extension ID at chrome://extensions/`);
  console.log(`   Example: abcdefghijklmnopqrstuvwxyzabcdef`);
  
  let extensionId = '';
  while (!extensionId) {
    extensionId = await question('\n📝 Enter your Chrome Extension ID: ');
    extensionId = extensionId.trim();
    
    if (!extensionId) {
      console.log('❌ Extension ID cannot be empty!');
    } else if (extensionId.length !== 32) {
      console.log('❌ Extension ID must be 32 characters long!');
      extensionId = '';
    }
  }
  
  rl.close();
  
  // Save for future use
  writeFileSync(extensionIdFile, extensionId);
  console.log(`✅ Extension ID saved to ${extensionIdFile}`);
  
  return extensionId;
}

// Create manifest content
function createManifest(extensionId) {
  const nodeExecutable = process.execPath; // Path to node binary
  const proxyScript = join(packageRoot, 'proxy.js');
  
  return {
    name: HOST_NAME,
    description: 'stdio-proxy Native Messaging Host (Node.js)',
    path: nodeExecutable,
    args: [proxyScript], // Node.js will execute proxy.js
    type: 'stdio',
    allowed_origins: [
      `chrome-extension://${extensionId}/`
    ]
  };
}

// Windows installation
function installWindows(manifest) {
  console.log('\n🪟 Installing for Windows...');
  
  const manifestContent = JSON.stringify(manifest, null, 2);
  
  // User-level directories
  const userDirs = [
    join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Google', 'Chrome Beta', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Google', 'Chrome Dev', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Google', 'Chrome SxS', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data', 'NativeMessagingHosts'),
    join(process.env.APPDATA, 'Opera Software', 'Opera Stable', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Vivaldi', 'User Data', 'NativeMessagingHosts'),
    join(process.env.LOCALAPPDATA, 'Chromium', 'User Data', 'NativeMessagingHosts')
  ];
  
  let installedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      const browserDir = dirname(dir);
      if (existsSync(browserDir)) {
        mkdirSync(dir, { recursive: true });
        const manifestPath = join(dir, `${HOST_NAME}.json`);
        writeFileSync(manifestPath, manifestContent);
        console.log(`✅ Installed: ${manifestPath}`);
        installedCount++;
      }
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  // Registry installation
  const manifestPath = join(packageRoot, `${HOST_NAME}.json`);
  writeFileSync(manifestPath, manifestContent);
  
  const registryPaths = [
    `HKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${HOST_NAME}`
  ];
  
  let regSuccess = 0;
  registryPaths.forEach(regPath => {
    try {
      execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`, { stdio: 'ignore' });
      regSuccess++;
    } catch (error) {
      // Silently ignore registry errors
    }
  });
  
  console.log(`✅ Installed for ${installedCount} browser(s)`);
  console.log(`✅ Registry entries: ${regSuccess}`);
}

// macOS installation
function installMacOS(manifest) {
  console.log('\n🍎 Installing for macOS...');
  
  const manifestContent = JSON.stringify(manifest, null, 2);
  const homeDir = process.env.HOME;
  
  const userDirs = [
    join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome Beta', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome Dev', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome Canary', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'com.operasoftware.Opera', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Vivaldi', 'NativeMessagingHosts'),
    join(homeDir, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts')
  ];
  
  let installedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      mkdirSync(dir, { recursive: true });
      const manifestPath = join(dir, `${HOST_NAME}.json`);
      writeFileSync(manifestPath, manifestContent);
      console.log(`✅ Installed: ${manifestPath}`);
      installedCount++;
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  console.log(`✅ Installed for ${installedCount} browser(s)`);
}

// Linux installation
function installLinux(manifest) {
  console.log('\n🐧 Installing for Linux...');
  
  const manifestContent = JSON.stringify(manifest, null, 2);
  const homeDir = process.env.HOME;
  
  const userDirs = [
    join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'google-chrome-beta', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'google-chrome-unstable', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'microsoft-edge', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'opera', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'vivaldi', 'NativeMessagingHosts'),
    join(homeDir, '.config', 'chromium', 'NativeMessagingHosts')
  ];
  
  let installedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      mkdirSync(dir, { recursive: true });
      const manifestPath = join(dir, `${HOST_NAME}.json`);
      writeFileSync(manifestPath, manifestContent);
      console.log(`✅ Installed: ${manifestPath}`);
      installedCount++;
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  console.log(`✅ Installed for ${installedCount} browser(s)`);
}

// Main installation function
async function install() {
  try {
    const extensionId = await getExtensionId();
    const manifest = createManifest(extensionId);
    
    if (isWindows) {
      installWindows(manifest);
    } else if (isMacOS) {
      installMacOS(manifest);
    } else if (isLinux) {
      installLinux(manifest);
    } else {
      console.error(`❌ Unsupported platform: ${platform}`);
      process.exit(1);
    }
    
    console.log(`\n🎉 Installation completed!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Restart your browser completely`);
    console.log(`   2. Reload your Chrome extension`);
    console.log(`   3. Try connecting via TCP Native tab`);
    console.log(`\n📝 Extension ID: ${extensionId}`);
    console.log(`🔧 Host Name: ${HOST_NAME}`);
    console.log(`📁 Node.js: ${process.execPath}`);
    console.log(`📄 Script: ${join(packageRoot, 'proxy.js')}`);
    
  } catch (error) {
    console.error(`❌ Installation failed:`, error.message);
    process.exit(1);
  }
}

// Run installation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  install();
}

export { install };