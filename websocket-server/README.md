# Modbus WebSocket Proxy Server

이 서버는 웹 브라우저와 Modbus TCP 장비 간의 통신을 중계하는 WebSocket 프록시 서버입니다.

## 아키텍처

```
Browser (WebSocket) ↔ Proxy Server ↔ Modbus Device (TCP)
```

## 빠른 시작 (실행 파일 사용)

가장 간단한 방법입니다. Node.js 설치가 불필요합니다.

### 1. 실행 파일 빌드
```bash
# 모든 플랫폼용 빌드
npm run build:all

# 또는 특정 플랫폼용 빌드
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux
```

### 2. 실행 파일 사용
```bash
# Windows
dist/modbus-proxy-windows.exe

# macOS
./dist/modbus-proxy-macos

# Linux
./dist/modbus-proxy-linux
```

## 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 서버 실행
```bash
npm start
```

또는 개발 모드로 실행:
```bash
npm run dev
```

서버는 기본적으로 포트 8080에서 실행됩니다.

## 빌드 스크립트

편의를 위해 제공되는 빌드 스크립트:

```bash
# Unix/Linux/macOS
./build.sh

# Windows
build.bat
```

## 사용법

### 클라이언트에서 WebSocket 연결
```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### 메시지 프로토콜

#### 1. Modbus 장비에 연결
```json
{
  "type": "connect",
  "host": "192.168.1.100",
  "port": 502
}
```

#### 2. 명령어 전송
```json
{
  "type": "send",
  "data": "01 03 00 00 00 0A"
}
```

#### 3. 연결 해제
```json
{
  "type": "disconnect"
}
```

#### 4. 핑/퐁 (연결 유지)
```json
{
  "type": "ping"
}
```

### 서버 응답 메시지

#### 연결 성공
```json
{
  "type": "tcp_connected",
  "host": "192.168.1.100",
  "port": 502,
  "message": "Connected to Modbus device 192.168.1.100:502"
}
```

#### 데이터 수신
```json
{
  "type": "data",
  "data": "01 03 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 FA 6C",
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### 오류 발생
```json
{
  "type": "tcp_error",
  "error": "Connection refused",
  "message": "Connection error to 192.168.1.100:502"
}
```

## 특징

- **다중 클라이언트 지원**: 여러 브라우저가 동시 연결 가능
- **자동 재연결**: 연결 실패 시 자동 재시도
- **에러 처리**: 상세한 에러 메시지 제공
- **로깅**: 모든 통신 내역 콘솔 출력
- **타임아웃 관리**: 10초 연결 타임아웃

## 보안 고려사항

- 프로덕션 환경에서는 HTTPS/WSS 사용 권장
- 방화벽 설정으로 허용된 IP만 접근 가능하도록 제한
- 인증 메커니즘 추가 고려

## 문제 해결

### 연결 오류
1. Modbus 장비 IP/포트 확인
2. 네트워크 연결 상태 확인
3. 방화벽 설정 확인

### WebSocket 연결 실패
1. 서버 실행 상태 확인
2. 포트 8080 사용 가능 여부 확인
3. 브라우저 개발자 도구에서 에러 메시지 확인