# TCP Loopback Server

사용자가 정한 IP로 접속할 수 있는 TCP 루프백 서버입니다. 받은 데이터를 그대로 돌려주는 에코 서버로 동작합니다.

## 기능

- **루프백 기능**: 클라이언트에서 받은 데이터를 그대로 돌려줌
- **다중 연결 지원**: 여러 클라이언트 동시 연결 가능
- **실시간 로깅**: 연결 상태 및 데이터 흐름 모니터링
- **설정 가능**: IP, 포트, 로깅 옵션 등 커스터마이징 가능
- **우아한 종료**: Ctrl+C로 안전하게 서버 종료

## 설치

```bash
cd tcp-loopback-server
npm install
```

## 사용법

### 기본 실행
```bash
npm start
```

### 개발 모드 (자동 재시작)
```bash
npm run dev
```

### 상세 로그와 함께 실행
```bash
node server.js --verbose
```

### 서버 상태 확인
```bash
node server.js --status
```

## 설정

`config.json` 파일을 수정하여 서버 설정을 변경할 수 있습니다:

```json
{
  "server": {
    "host": "0.0.0.0",     // 바인딩할 IP 주소 (0.0.0.0 = 모든 인터페이스)
    "port": 502,           // 바인딩할 포트 번호
    "name": "TCP Loopback Server"
  },
  "logging": {
    "enabled": true,       // 로깅 활성화/비활성화
    "logConnections": true, // 연결/해제 로그
    "logData": true        // 데이터 송수신 로그 (16진수)
  },
  "options": {
    "maxConnections": 10,  // 최대 동시 연결 수
    "timeout": 30000,      // 연결 타임아웃 (밀리초)
    "keepAlive": true      // TCP Keep-Alive 활성화
  }
}
```

## 사용 예시

### 1. Modbus TCP 테스트
기본 포트 502에서 Modbus TCP 장비 시뮬레이션:
```bash
npm start
```

### 2. 커스텀 IP/포트
`config.json`에서 다른 IP/포트로 설정:
```json
{
  "server": {
    "host": "192.168.1.100",
    "port": 8502
  }
}
```

### 3. 데이터 흐름 모니터링
클라이언트가 데이터를 보내면 콘솔에 16진수로 표시:
```
[2024-06-27 10:30:15] Client #1 -> Server: 01 03 00 00 00 0A C5 CD | ........
[2024-06-27 10:30:15] Server -> Client #1: 01 03 00 00 00 0A C5 CD | ........
```

## 테스트

텔넷이나 다른 TCP 클라이언트로 테스트 가능:
```bash
telnet localhost 502
```

또는 Python으로 테스트:
```python
import socket

sock = socket.socket(socket.socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('localhost', 502))
sock.send(b'Hello World')
response = sock.recv(1024)
print(f"Received: {response}")
sock.close()
```

## 로그 형식

- **연결**: `Client #1 connected from 127.0.0.1:54321`
- **데이터**: `Client #1 -> Server: 48 65 6C 6C 6F | Hello`
- **해제**: `Client #1 disconnected after 30s`
- **상태**: `Active connections: 2/10`

## 주의사항

- 포트 502는 관리자 권한이 필요할 수 있습니다 (Linux/macOS)
- 방화벽 설정에서 해당 포트를 허용해야 합니다
- 프로덕션 환경에서는 보안을 고려하여 설정하세요