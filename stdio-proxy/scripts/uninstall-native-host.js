#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

const HOST_NAME = 'com.my_company.stdio_proxy';

// Platform detection
const platform = process.platform;
const isWindows = platform === 'win32';
const isMacOS = platform === 'darwin';
const isLinux = platform === 'linux';

console.log(`\n🗑️  Uninstalling Native Messaging Host for ${platform}...`);

// Windows uninstallation
function uninstallWindows() {
  console.log('\n🪟 Uninstalling from Windows...');
  
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
  
  let removedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      const manifestPath = join(dir, `${HOST_NAME}.json`);
      if (existsSync(manifestPath)) {
        unlinkSync(manifestPath);
        console.log(`✅ Removed: ${manifestPath}`);
        removedCount++;
      }
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  // Remove registry entries
  const registryPaths = [
    `HKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${HOST_NAME}`
  ];
  
  let regRemoved = 0;
  registryPaths.forEach(regPath => {
    try {
      execSync(`reg delete "${regPath}" /f`, { stdio: 'ignore' });
      regRemoved++;
    } catch (error) {
      // Silently ignore registry errors
    }
  });
  
  // Remove package manifest
  const packageManifest = join(packageRoot, `${HOST_NAME}.json`);
  if (existsSync(packageManifest)) {
    unlinkSync(packageManifest);
    console.log(`✅ Removed package manifest: ${packageManifest}`);
  }
  
  console.log(`✅ Removed ${removedCount} manifest file(s)`);
  console.log(`✅ Removed ${regRemoved} registry entry/entries`);
}

// macOS uninstallation
function uninstallMacOS() {
  console.log('\n🍎 Uninstalling from macOS...');
  
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
  
  let removedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      const manifestPath = join(dir, `${HOST_NAME}.json`);
      if (existsSync(manifestPath)) {
        unlinkSync(manifestPath);
        console.log(`✅ Removed: ${manifestPath}`);
        removedCount++;
      }
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  console.log(`✅ Removed ${removedCount} manifest file(s)`);
}

// Linux uninstallation
function uninstallLinux() {
  console.log('\n🐧 Uninstalling from Linux...');
  
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
  
  let removedCount = 0;
  
  userDirs.forEach(dir => {
    try {
      const manifestPath = join(dir, `${HOST_NAME}.json`);
      if (existsSync(manifestPath)) {
        unlinkSync(manifestPath);
        console.log(`✅ Removed: ${manifestPath}`);
        removedCount++;
      }
    } catch (error) {
      // Silently ignore permission errors
    }
  });
  
  console.log(`✅ Removed ${removedCount} manifest file(s)`);
}

// Main uninstallation function
function uninstall() {
  try {
    if (isWindows) {
      uninstallWindows();
    } else if (isMacOS) {
      uninstallMacOS();
    } else if (isLinux) {
      uninstallLinux();
    } else {
      console.error(`❌ Unsupported platform: ${platform}`);
      process.exit(1);
    }
    
    console.log(`\n🎉 Uninstallation completed!`);
    console.log(`\n📋 Note:`);
    console.log(`   • Restart your browser to complete removal`);
    console.log(`   • Extension ID file preserved for reinstallation`);
    
  } catch (error) {
    console.error(`❌ Uninstallation failed:`, error.message);
    process.exit(1);
  }
}

// Run uninstallation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uninstall();
}

export { uninstall };