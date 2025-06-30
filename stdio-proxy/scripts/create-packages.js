#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📦 Creating distribution packages...');

// Ensure packages directory exists
const packagesDir = path.join(__dirname, '..', 'packages');
if (fs.existsSync(packagesDir)) {
  fs.rmSync(packagesDir, { recursive: true });
}
fs.mkdirSync(packagesDir, { recursive: true });

// Check if executables exist
const distDir = path.join(__dirname, '..', 'dist');
const executables = {
  macos: 'stdio-proxy-macos-x64',
  windows: 'stdio-proxy-windows-x64.exe',
  linux: 'stdio-proxy-linux-x64'
};

for (const [platform, filename] of Object.entries(executables)) {
  const execPath = path.join(distDir, filename);
  if (!fs.existsSync(execPath)) {
    console.error(`❌ ${platform} executable not found: ${filename}`);
    process.exit(1);
  }
}

// Create packages
createMacOSPackage();
createWindowsPackage(); 
createLinuxPackage();

console.log('✅ All packages created successfully!');

function createMacOSPackage() {
  console.log('🍎 Creating macOS package...');
  
  const packageDir = path.join(packagesDir, 'stdio-proxy-macos');
  fs.mkdirSync(packageDir, { recursive: true });
  
  // Copy files
  fs.copyFileSync(
    path.join(distDir, 'stdio-proxy-macos-x64'),
    path.join(packageDir, 'stdio-proxy-macos-x64')
  );
  fs.copyFileSync(
    path.join(__dirname, '..', 'install-macos.sh'),
    path.join(packageDir, 'install-macos.sh')
  );
  
  // Create README
  const readme = `# stdio-proxy for macOS

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Open Terminal and navigate to this folder
2. Run the installation script:
   \`\`\`bash
   chmod +x install-macos.sh
   ./install-macos.sh
   \`\`\`
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- \`stdio-proxy-macos-x64\` - Native host executable
- \`install-macos.sh\` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.
`;
  
  fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
  
  // Create zip
  process.chdir(packagesDir);
  execSync('zip -r stdio-proxy-macos.zip stdio-proxy-macos/');
  console.log('✅ Created: packages/stdio-proxy-macos.zip');
}

function createWindowsPackage() {
  console.log('🪟 Creating Windows package...');
  
  const packageDir = path.join(packagesDir, 'stdio-proxy-windows');
  fs.mkdirSync(packageDir, { recursive: true });
  
  // Copy files
  fs.copyFileSync(
    path.join(distDir, 'stdio-proxy-windows-x64.exe'),
    path.join(packageDir, 'stdio-proxy-windows-x64.exe')
  );
  fs.copyFileSync(
    path.join(__dirname, '..', 'install-windows.bat'),
    path.join(packageDir, 'install-windows.bat')
  );
  
  // Create README
  const readme = `# stdio-proxy for Windows

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Double-click \`install-windows.bat\`
2. Follow the prompts
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- \`stdio-proxy-windows-x64.exe\` - Native host executable
- \`install-windows.bat\` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.

## Note

Windows may show a security warning for the executable. This is normal for unsigned binaries.
`;
  
  fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
  
  // Create zip
  execSync('zip -r stdio-proxy-windows.zip stdio-proxy-windows/');
  console.log('✅ Created: packages/stdio-proxy-windows.zip');
}

function createLinuxPackage() {
  console.log('🐧 Creating Linux package...');
  
  const packageDir = path.join(packagesDir, 'stdio-proxy-linux');
  fs.mkdirSync(packageDir, { recursive: true });
  
  // Copy files
  fs.copyFileSync(
    path.join(distDir, 'stdio-proxy-linux-x64'),
    path.join(packageDir, 'stdio-proxy-linux-x64')
  );
  fs.copyFileSync(
    path.join(__dirname, '..', 'install-linux.sh'),
    path.join(packageDir, 'install-linux.sh')
  );
  
  // Create README
  const readme = `# stdio-proxy for Linux

Native Messaging Host for Modbus Protocol Debugger Chrome Extension.

## Installation

1. Open terminal and navigate to this folder
2. Run the installation script:
   \`\`\`bash
   chmod +x install-linux.sh
   ./install-linux.sh
   \`\`\`
3. Restart your browser completely
4. Test TCP Native connection in the extension

## Supported Browsers

Chrome, Edge, Brave, Opera, Vivaldi, Chromium

## Files

- \`stdio-proxy-linux-x64\` - Native host executable
- \`install-linux.sh\` - Installation script

The installation script automatically detects your Extension ID and installs for all available browsers.

## Supported Distributions

Ubuntu, Debian, Fedora, CentOS, Arch, and most others
`;
  
  fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
  
  // Create tar.gz
  execSync('tar -czf stdio-proxy-linux.tar.gz stdio-proxy-linux/');
  console.log('✅ Created: packages/stdio-proxy-linux.tar.gz');
}