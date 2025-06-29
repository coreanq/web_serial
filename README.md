# 🔧 Modbus Protocol Debugger

웹 브라우저에서 사용할 수 있는 Modbus 프로토콜 디버깅 도구입니다. RTU(시리얼) 및 TCP/IP 통신을 지원하며, 실시간 패킷 분석과 다양한 디버깅 기능을 제공합니다.

## ✨ 주요 기능

### 🔌 다중 연결 방식 지원
- **RTU (Serial)**: Web Serial API를 통한 직접 시리얼 통신
- **TCP/IP**: WebSocket 프록시를 통한 네트워크 통신

### 📊 실시간 통신 분석
- 실시간 패킷 로깅 및 분석
- Modbus 패킷 구조 시각화
- 요청/응답 시간 측정
- 상세한 오류 분석

### 🎛️ 강력한 명령어 도구
- **Quick Commands**: 자주 사용하는 명령어 템플릿
- **Command Builder**: GUI를 통한 쉬운 명령어 생성
- **Recent Commands**: 최근 사용 명령어 재사용 및 주기적 전송
- **Manual Input**: HEX 및 ASCII 모드 지원

### 🎨 사용자 친화적 인터페이스
- 다크 모드 지원
- 반응형 웹 디자인 (모바일/태블릿/PC)
- 실시간 프리뷰 및 자동 CRC 계산
- 패킷 분석 툴팁

## 🚀 빠른 시작

### RTU (시리얼) 모드
1. 웹 브라우저에서 애플리케이션 열기
2. **RTU** 탭 선택
3. 시리얼 포트 선택 및 연결
4. 명령어 전송 시작

### TCP/IP 모드
1. 프록시 서버 실행 (필수)
   ```bash
   cd websocket-server
   npm install
   npm start
   ```
2. 웹 브라우저에서 **TCP** 탭 선택
3. Modbus 장비 IP/포트 입력 후 연결

## 📚 상세 가이드

### TCP/IP 설정
- [⚡ 빠른 시작](QUICK_START_TCP.md) - 3분 안에 TCP 기능 사용하기
- [📖 상세 가이드](PROXY_DOWNLOAD_GUIDE.md) - 프록시 서버 설치 및 설정
- [🔧 설정 가이드](TCP_SETUP_GUIDE.md) - 고급 설정 및 문제 해결

### 배포 옵션
- [🚀 배포 옵션](DEPLOYMENT_OPTIONS.md) - Private 저장소 배포 방안

## 🛠️ 기술 스택

- **Frontend**: TypeScript + Tailwind CSS
- **Build**: Webpack + PostCSS
- **APIs**: Web Serial API, WebSocket API
- **Proxy**: Node.js + WebSocket + TCP Sockets

## 📁 프로젝트 구조

```
web_serial/
├── src/                          # 웹 애플리케이션 소스
│   ├── components/               # UI 컴포넌트
│   ├── services/                 # 통신 서비스
│   └── styles/                   # CSS 스타일
├── websocket-server/             # TCP 프록시 서버
│   ├── server.js                 # 서버 메인 파일
│   ├── package.json              # 의존성 및 빌드 스크립트
│   └── dist/                     # 빌드된 실행 파일
├── dist/                         # 웹 앱 빌드 결과
└── docs/                         # 문서 파일들
```

## 🔧 개발 환경 설정

### 사전 요구사항
- Node.js 18+ 
- npm 또는 yarn
- 모던 웹 브라우저 (Chrome, Edge, Firefox)

### 설치 및 실행
```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 프로덕션 빌드
npm run build
```

### TCP 프록시 서버 (별도 실행)
```bash
cd websocket-server
npm install
npm start
```

## 🌟 주요 화면

### 메인 대시보드
- 연결 상태 표시
- 실시간 로그 패널
- 명령어 입력 패널

### 연결 설정
- RTU: 포트, Baud Rate, Parity 설정
- TCP: Host, Port 설정

### 명령어 도구
- Quick Commands: 미리 정의된 명령어
- Command Builder: GUI 명령어 생성기
- Recent Commands: 히스토리 및 주기적 전송

## 🎯 지원 기능

### Modbus 기능 코드
- 0x01: Read Coils
- 0x02: Read Discrete Inputs  
- 0x03: Read Holding Registers
- 0x04: Read Input Registers
- 0x06: Write Single Register
- 0x10: Write Multiple Registers

### 통신 프로토콜
- **RTU**: CRC-16 자동 계산
- **TCP**: MBAP 헤더 자동 추가
- **ASCII/HEX**: 양방향 변환 지원

### 분석 도구
- 패킷 구조 분석
- 응답 시간 측정
- 오류 코드 해석
- 실시간 로그 필터링

## 🔒 보안 고려사항

- Web Serial API는 HTTPS에서만 동작
- TCP 프록시 서버는 localhost 기본 설정
- 민감한 데이터는 로컬에서만 처리

## 📋 브라우저 지원

| 브라우저 | Web Serial | WebSocket | 지원 상태 |
|----------|------------|-----------|----------|
| Chrome 89+ | ✅ | ✅ | 완전 지원 |
| Edge 89+ | ✅ | ✅ | 완전 지원 |
| Firefox | ❌ | ✅ | TCP만 지원 |
| Safari | ❌ | ✅ | TCP만 지원 |

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🆘 지원 및 문의

- 📝 [Issues](https://github.com/your-org/web_serial/issues)
- 📧 이메일: your-email@example.com
- 📖 [문서](https://github.com/your-org/web_serial/wiki)

---

*Modbus Protocol Debugger Dashboard - 웹에서 만나는 강력한 Modbus 디버깅 도구* 🚀