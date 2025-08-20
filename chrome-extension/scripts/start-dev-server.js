#!/usr/bin/env node

/**
 * Development server script for Chrome Extension with Hot Reload
 * This script starts the Vite build in watch mode with hot reload capabilities
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Chrome Extension Development Server...');
console.log('📝 Hot Reload Setup Instructions:');
console.log('');
console.log('✅ RECOMMENDED: Use "Extension Development - Auto Reloader"');
console.log('   1. Install from Chrome Web Store:');
console.log('      https://chrome.google.com/webstore/detail/extension-development-aut/falghmjeljhgmccbpffloemnfnmikked');
console.log('   2. Load your extension from chrome://extensions/');
console.log('      Point to: chrome-extension/dist/ directory');
console.log('   3. Click the Auto Reloader icon and ensure "TURN ON" is green');
console.log('   4. 🎉 Your extension will auto-reload when files change!');
console.log('');
console.log('🔧 Alternative: Manual reload');
console.log('   - Files will rebuild automatically');
console.log('   - Click "Refresh" button in chrome://extensions/ manually');
console.log('');

// Set environment variable for development
process.env.NODE_ENV = 'development';

// Start Vite in watch mode
const viteProcess = spawn('bun', ['run', 'vite', 'build', '--watch', '--mode', 'development'], {
  cwd: __dirname + '/..',
  stdio: 'inherit',
  shell: true
});

viteProcess.on('close', (code) => {
  console.log(`\n🛑 Development server stopped with code ${code}`);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping development server...');
  viteProcess.kill('SIGINT');
  process.exit(0);
});

console.log('💡 Press Ctrl+C to stop the development server');
console.log('📁 Extension files will be built to: chrome-extension/dist/');
console.log('🔄 Files will be rebuilt automatically when you save changes');