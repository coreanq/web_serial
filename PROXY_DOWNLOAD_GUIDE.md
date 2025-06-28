# 🌐 TCP 프록시 서버 설치 가이드

> TCP/IP Modbus 통신을 위한 프록시 서버 설치 및 실행 안내

## 🤔 왜 프록시 서버가 필요한가요?

웹 브라우저의 보안 정책으로 인해 JavaScript에서 직접 TCP 소켓에 연결할 수 없습니다. 따라서 다음과 같은 구조로 통신이 이루어집니다:

```
웹 브라우저 ←→ 프록시 서버 ←→ Modbus TCP 장비
 (WebSocket)     (포트 8080)      (포트 502)
```

## 🚀 빠른 시작

### 1단계: 프록시 서버 파일 준비

프로젝트의 `websocket-server` 디렉토리에 모든 필요한 파일이 있습니다.

### 2단계: 실행 방법 선택

#### 🟢 방법 A: 직접 실행 (Node.js 필요)

```bash
# 1. websocket-server 디렉토리로 이동
cd websocket-server

# 2. 의존성 설치 (최초 1회)
npm install

# 3. 서버 실행
npm start
```

#### 🔵 방법 B: 실행 파일 생성

```bash
# 1. websocket-server 디렉토리로 이동
cd websocket-server

# 2. 의존성 설치 (최초 1회)
npm install

# 3. 플랫폼별 실행 파일 빌드
npm run build:all

# 4. 생성된 실행 파일 사용
# Windows: dist/modbus-proxy-windows.exe
# macOS:   dist/modbus-proxy-macos
# Linux:   dist/modbus-proxy-linux
```

### 3단계: 서버 실행 확인

서버가 정상적으로 실행되면 다음 메시지가 표시됩니다:

```
Modbus WebSocket Proxy Server running on port 8080
```

### 4단계: 웹 대시보드 연결

1. 웹 브라우저에서 Modbus Protocol Debugger를 열어주세요
2. **TCP** 탭을 클릭하세요
3. 자동으로 프록시 서버에 연결됩니다

## 🛠️ 플랫폼별 상세 가이드

### Windows 사용자

```cmd
REM PowerShell 또는 Command Prompt에서 실행
cd websocket-server
npm install
npm start
```

또는 실행 파일 생성:
```cmd
npm run build:win
dist\modbus-proxy-windows.exe
```

### macOS 사용자

```bash
# Terminal에서 실행
cd websocket-server
npm install
npm start
```

또는 실행 파일 생성:
```bash
npm run build:mac
chmod +x dist/modbus-proxy-macos
./dist/modbus-proxy-macos
```

### Linux 사용자

```bash
# Terminal에서 실행
cd websocket-server
npm install
npm start
```

또는 실행 파일 생성:
```bash
npm run build:linux
chmod +x dist/modbus-proxy-linux
./dist/modbus-proxy-linux
```

## 🔧 빌드 스크립트 사용

편의를 위해 제공되는 빌드 스크립트를 사용할 수 있습니다:

### Unix/Linux/macOS
```bash
cd websocket-server
chmod +x build.sh
./build.sh
```

### Windows
```cmd
cd websocket-server
build.bat
```

## ✅ 사용 시나리오

### 시나리오 1: 개발자 (Node.js 환경)
```bash
cd websocket-server
npm install
npm start
# 개발 중인 경우: npm run dev (자동 재시작)
```

### 시나리오 2: 일반 사용자 (실행 파일 선호)
```bash
cd websocket-server
npm install
npm run build:all
# 생성된 실행 파일을 원하는 위치로 복사하여 사용
```

### 시나리오 3: 서버 관리자 (백그라운드 실행)
```bash
# PM2 사용 (설치 필요: npm install -g pm2)
cd websocket-server
npm install
pm2 start server.js --name modbus-proxy
pm2 startup
pm2 save
```

## 🔍 문제 해결

### 포트 8080이 이미 사용 중인 경우

```bash
# 포트 사용 중인 프로세스 확인
# Windows
netstat -ano | findstr :8080

# macOS/Linux  
lsof -i :8080
```

포트를 변경하려면 `server.js` 파일을 수정하세요:
```javascript
// 기본값: const proxy = new ModbusTcpProxy(8080);
const proxy = new ModbusTcpProxy(8081); // 원하는 포트로 변경
```

### Node.js가 설치되지 않은 경우

1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 후 터미널/명령 프롬프트에서 확인:
   ```bash
   node --version
   npm --version
   ```

### 권한 오류 (macOS/Linux)

```bash
# 실행 권한 부여
chmod +x dist/modbus-proxy-macos
chmod +x dist/modbus-proxy-linux

# 또는 sudo로 실행
sudo ./dist/modbus-proxy-linux
```

## 🔒 보안 고려사항

- 프록시 서버는 기본적으로 `localhost`에서만 접근 가능합니다
- 외부 네트워크에서 접근이 필요한 경우 방화벽 설정을 확인하세요
- 프로덕션 환경에서는 HTTPS/WSS 사용을 권장합니다

## 📚 추가 자료

- [상세 설정 가이드](TCP_SETUP_GUIDE.md)
- [프록시 서버 소스 코드](websocket-server/)
- [API 문서](websocket-server/README.md)

## 💡 팁

1. **자동 시작**: 컴퓨터 부팅 시 자동으로 서버가 시작되도록 설정할 수 있습니다
2. **로그 확인**: 서버 실행 중 콘솔에서 연결/통신 로그를 확인할 수 있습니다
3. **다중 연결**: 여러 웹 브라우저에서 동시에 연결 가능합니다

---

문제가 발생하면 [이슈 페이지](https://github.com/your-org/web_serial/issues)에 문의해 주세요.