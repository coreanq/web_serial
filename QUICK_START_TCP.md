# ⚡ TCP 기능 빠른 시작

> 3분 안에 TCP/IP Modbus 기능 사용하기

## 🎯 한 눈에 보는 설정 과정

```
1️⃣ 프록시 서버 실행 → 2️⃣ 웹에서 TCP 탭 클릭 → 3️⃣ Modbus 장비 연결
```

## 🚀 Step 1: 프록시 서버 실행

### 💻 명령어 3줄로 끝내기

```bash
cd websocket-server
npm install
npm start
```

### 📱 더 간단하게 (실행 파일)

```bash
cd websocket-server
npm install && npm run build:all
./dist/modbus-proxy-[your-platform]
```

## ✅ Step 2: 실행 확인

이 메시지가 보이면 성공! 👍
```
Modbus WebSocket Proxy Server running on port 8080
```

## 🌐 Step 3: 웹에서 연결

1. 브라우저에서 대시보드 열기
2. **TCP** 탭 클릭 ← 자동 연결됨!
3. Host/Port 입력 후 Connect

## 🎉 완료!

이제 TCP/IP Modbus 장비와 통신할 수 있습니다.

---

### 🆘 문제가 생겼나요?

| 문제 | 해결책 |
|------|--------|
| 🔴 "Cannot connect to proxy server" | Step 1 프록시 서버 실행 확인 |
| 🔴 "Port 8080 already in use" | 다른 프로그램이 포트 사용 중 → 종료 후 재시도 |
| 🔴 "Node.js not found" | [Node.js 설치](https://nodejs.org/) 필요 |

### 📖 더 자세한 가이드

- [📋 상세 설정 가이드](TCP_SETUP_GUIDE.md)
- [🔽 다운로드 가이드](PROXY_DOWNLOAD_GUIDE.md)
- [⚙️ 고급 설정](websocket-server/README.md)