#!/bin/bash

# Modbus WebSocket Proxy Server 빌드 스크립트

echo "🚀 Building Modbus WebSocket Proxy Server..."

# dist 디렉토리 생성
mkdir -p dist

echo "📦 Building for all platforms..."
npm run build:all

echo "✅ Build completed!"
echo "📁 Executables are available in the 'dist' directory:"
echo "   - modbus-proxy-macos (macOS)"
echo "   - modbus-proxy-windows.exe (Windows)"  
echo "   - modbus-proxy-linux (Linux)"
echo ""
echo "🎯 To run the server:"
echo "   macOS/Linux: ./dist/modbus-proxy-[platform]"
echo "   Windows: dist\\modbus-proxy-windows.exe"
echo ""
echo "🌐 Server will start on: ws://localhost:8080"