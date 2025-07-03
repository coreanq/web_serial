#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const version = packageJson.version;
const extensionName = `modbus-analyzer-extension-v${version}`;

console.log('🔧 Building Chrome Extension...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  execSync('rm -rf dist', { cwd: __dirname + '/..' });
  execSync(`rm -f ${extensionName}.zip`, { cwd: __dirname + '/..' });
} catch (error) {
  // Ignore if files don't exist
}

// Build the extension
console.log('📦 Building extension files...');
execSync('NODE_ENV=production bun run vite build', { 
  cwd: __dirname + '/..',
  stdio: 'inherit'
});

// Copy necessary files to dist
console.log('📂 Copying extension files...');
const filesToCopy = [
  'manifest.json',
  'background.js',
  'icons/',
  'templates/'
];

filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, '..', file);
  const destPath = path.join(__dirname, '..', 'dist', file);
  
  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      execSync(`cp -r "${srcPath}" "${destPath}"`, { cwd: __dirname + '/..' });
    } else {
      execSync(`cp "${srcPath}" "${destPath}"`, { cwd: __dirname + '/..' });
    }
    console.log(`  ✅ Copied ${file}`);
  } else {
    console.log(`  ⚠️  ${file} not found, skipping...`);
  }
});

// Remove development files from dist
console.log('🗑️  Removing development files...');
const devFilesToRemove = [
  'dist/**/*.map',
  'dist/.DS_Store',
  'dist/node_modules',
  'dist/*.log'
];

devFilesToRemove.forEach(pattern => {
  try {
    execSync(`rm -rf ${pattern}`, { cwd: __dirname + '/..' });
  } catch (error) {
    // Ignore if files don't exist
  }
});

// Create zip file
console.log('🗜️  Creating zip file...');
const zipCommand = `cd dist && zip -r ../${extensionName}.zip . -x "*.map" "*.DS_Store" "node_modules/*" "*.log"`;
execSync(zipCommand, { 
  cwd: __dirname + '/..',
  stdio: 'inherit'
});

// Verify the build
const zipPath = path.join(__dirname, '..', `${extensionName}.zip`);
if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log('\n✅ Extension build completed successfully!');
  console.log(`📦 Package: ${extensionName}.zip`);
  console.log(`📏 Size: ${fileSizeInMB} MB`);
  console.log(`📍 Location: chrome-extension/${extensionName}.zip`);
  
  console.log('\n🚀 Ready for Chrome Web Store upload!');
  console.log('📖 Upload instructions:');
  console.log('   1. Go to https://chrome.google.com/webstore/devconsole/');
  console.log('   2. Click "Add new item"');
  console.log(`   3. Upload ${extensionName}.zip`);
  console.log('   4. Fill in store listing details');
  console.log('   5. Submit for review');
} else {
  console.error('❌ Failed to create extension package');
  process.exit(1);
}