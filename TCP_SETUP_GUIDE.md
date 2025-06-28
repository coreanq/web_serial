# TCP/IP Modbus 설정 가이드

## 개요

Modbus Protocol Debugger의 TCP/IP 기능을 사용하려면 별도의 프록시 서버가 필요합니다. 이 가이드에서는 프록시 서버 설치 및 설정 방법을 안내합니다.

## 왜 프록시 서버가 필요한가요?

웹 브라우저의 보안 정책으로 인해 JavaScript에서 직접 TCP 소켓에 연결할 수 없습니다. 따라서 WebSocket을 통해 TCP 연결을 중계하는 프록시 서버가 필요합니다.

```
브라우저 (WebSocket) ↔ 프록시 서버 ↔ Modbus 장비 (TCP)
```

## 설치 방법

### 방법 1: 실행 파일 다운로드 (권장)

가장 간단한 방법입니다. Node.js 설치가 불필요합니다.

1. **다운로드**: [GitHub Releases](https://github.com/your-repo/releases)에서 플랫폼에 맞는 파일을 다운로드하세요.
   - Windows: `modbus-proxy-windows.exe`
   - macOS: `modbus-proxy-macos`
   - Linux: `modbus-proxy-linux`

2. **실행**: 다운로드한 파일을 더블클릭하여 실행하세요.

3. **확인**: 콘솔에 다음 메시지가 나타나면 성공입니다.
   ```
   Modbus WebSocket Proxy Server running on port 8080
   ```

### 방법 2: 소스 코드에서 빌드

개발자이거나 사용자 정의가 필요한 경우 사용하세요.

1. **사전 요구사항**: Node.js 18 이상이 설치되어 있어야 합니다.

2. **의존성 설치**:
   ```bash
   cd websocket-server
   npm install
   ```

3. **서버 실행**:
   ```bash
   npm start
   ```

4. **빌드 (선택사항)**:
   ```bash
   # 모든 플랫폼용 빌드
   npm run build:all
   
   # 특정 플랫폼용 빌드
   npm run build:win    # Windows
   npm run build:mac    # macOS
   npm run build:linux  # Linux
   ```

## 사용법

### 1. 프록시 서버 시작

선택한 방법으로 프록시 서버를 실행하세요. 서버는 포트 8080에서 실행됩니다.

### 2. 웹 애플리케이션에서 연결

1. 웹 브라우저에서 Modbus Protocol Debugger를 열어주세요.
2. **TCP** 탭을 클릭하세요.
3. 프록시 서버가 실행 중이면 자동으로 연결됩니다.
4. 프록시 서버가 실행되지 않은 경우 안내 모달이 표시됩니다.

### 3. Modbus 장비에 연결

1. **Host**: Modbus 장비의 IP 주소를 입력하세요.
2. **Port**: Modbus 장비의 포트 번호를 입력하세요 (기본값: 502).
3. **Connect** 버튼을 클릭하세요.

## 문제 해결

### 프록시 서버 연결 실패

**증상**: "Cannot connect to proxy server" 오류 메시지

**해결 방법**:
1. 프록시 서버가 실행 중인지 확인하세요.
2. 포트 8080이 다른 프로그램에서 사용 중이지 않은지 확인하세요.
3. 방화벽에서 포트 8080을 허용하세요.

### Modbus 장비 연결 실패

**증상**: "Connection error to [IP]:[PORT]" 오류 메시지

**해결 방법**:
1. Modbus 장비의 IP 주소와 포트가 정확한지 확인하세요.
2. 네트워크 연결 상태를 확인하세요.
3. Modbus 장비가 TCP 연결을 허용하는지 확인하세요.
4. 방화벽 설정을 확인하세요.

### 권한 오류 (macOS/Linux)

**증상**: 실행 파일을 실행할 수 없음

**해결 방법**:
```bash
# 실행 권한 부여
chmod +x modbus-proxy-macos  # macOS
chmod +x modbus-proxy-linux  # Linux

# 실행
./modbus-proxy-macos   # macOS
./modbus-proxy-linux   # Linux
```

## 보안 고려사항

### 개발 환경
- 로컬 네트워크에서만 사용하세요.
- 프록시 서버는 기본적으로 localhost(127.0.0.1)에서만 접근 가능합니다.

### 프로덕션 환경
- HTTPS/WSS 사용을 권장합니다.
- 방화벽으로 허용된 IP만 접근하도록 제한하세요.
- 인증 메커니즘 추가를 고려하세요.

## 고급 설정

### 포트 변경

기본 포트(8080)를 변경하려면:

```javascript
// server.js 수정
const proxy = new ModbusTcpProxy(8081); // 원하는 포트 번호
```

### 로그 레벨 조정

더 자세한 로그를 보려면 `server.js`의 로그 레벨을 조정하세요.

## 지원

문제가 발생하면:
1. 이 가이드의 문제 해결 섹션을 확인하세요.
2. 브라우저 개발자 도구의 콘솔 메시지를 확인하세요.
3. 프록시 서버의 콘솔 출력을 확인하세요.
4. [GitHub Issues](https://github.com/your-repo/issues)에 문제를 보고하세요.

---

*이 문서는 Modbus Protocol Debugger v1.0.0을 기준으로 작성되었습니다.*