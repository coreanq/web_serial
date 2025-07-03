# 🔧 Modbus Protocol Analyzer

Chrome 확장으로 제공되는 강력한 Modbus 프로토콜 분석 도구입니다. RTU(시리얼) 및 TCP Native 통신을 지원하며, 실시간 패킷 분석과 다양한 디버깅 기능을 제공합니다.

## ✨ 주요 기능

### 🔌 다중 연결 방식 지원
- **Modbus RTU (Serial)**: Web Serial API를 통한 직접 시리얼 포트 통신
- **Modbus TCP Native**: Native Messaging을 통한 TCP 소켓 통신

### 📊 실시간 통신 분석
- 실시간 패킷 로깅 및 분석
- Modbus 패킷 구조 시각화
- 요청/응답 시간 측정 및 통계
- 상세한 오류 분석 및 성능 모니터링

### 🚀 최적화된 로그 관리
- **하이브리드 저장**: 메모리 + IndexedDB 조합으로 대용량 로그 처리
- **가상 스크롤링**: 수만 개 로그 항목 실시간 렌더링
- **자동 오버플로우**: 메모리 초과 시 IndexedDB 자동 저장
- **다양한 내보내기**: JSON, CSV, TXT 형식 지원

### 🎛️ 강력한 명령어 도구
- **Modbus 명령 생성기**: GUI를 통한 쉬운 명령어 생성
- **수동 입력**: HEX 및 ASCII 모드 지원
- **명령 히스토리**: 최근 사용 명령어 재사용
- **반복 모드**: 자동 명령 반복 실행

### 🌍 다국어 지원
- 한국어/영어 인터페이스 완전 지원
- 타입 안전한 다국어 시스템
- 동적 언어 전환

### 🎨 사용자 친화적 인터페이스
- 다크 모드 최적화 디자인
- 반응형 웹 디자인 (모바일/태블릿/PC)
- 실시간 프리뷰 및 자동 CRC 계산
- 접근성 및 UX 최적화

## 🚀 빠른 시작

### Chrome 확장 설치

1. **확장 파일 다운로드**
   - `chrome-extension/modbus-debugger-extension-v1.0.0.zip` 다운로드

2. **Chrome에 설치**
   ```
   1. Chrome에서 chrome://extensions/ 접속
   2. "개발자 모드" 활성화
   3. "압축해제된 확장 프로그램을 로드합니다" 클릭
   4. chrome-extension/ 디렉토리 선택
   ```

3. **확장 실행**
   - Chrome 도구모음에서 확장 아이콘 클릭
   - 또는 chrome://extensions/에서 직접 실행

### RTU (시리얼) 모드 사용

1. **RTU** 탭 선택
2. 시리얼 포트 및 통신 설정 구성
   - 포트 선택
   - Baud Rate: 9600, 19200, 38400, 115200 등
   - Parity: None, Even, Odd
   - Data Bits: 7, 8
   - Stop Bits: 1, 2
3. **연결** 버튼 클릭
4. Modbus 명령 생성 및 전송

### TCP Native 모드 사용

1. **Native Host 설치** (최초 1회)
   ```bash
   cd stdio-proxy
   
   # Windows
   install-windows.bat
   
   # Linux/macOS
   chmod +x install-linux.sh
   ./install-linux.sh
   ```

2. **브라우저 재시작** (필수)

3. **TCP Native** 탭 선택

4. TCP 설정 구성
   - Host: Modbus 장비 IP 주소
   - Port: Modbus TCP 포트 (기본 502)
   - Timeout: 연결 타임아웃 (ms)

5. **연결** 버튼 클릭

## 🛠️ 개발 환경 설정

### 사전 요구사항
- **Node.js 22+**
- **Bun** (권장) 또는 npm
- **Chrome 브라우저**
- **TypeScript** 지식

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repository-url>
cd web_serial

# 2. 의존성 설치 (루트)
bun install

# 3. 개발 서버 실행
bun run dev

# 4. 프로덕션 빌드
bun run build
```

### Chrome Extension 개발

```bash
# Chrome Extension 빌드
cd chrome-extension
bun install
bun run build
```

### Native Host 개발

```bash
# Native Messaging Host 빌드
cd stdio-proxy
bun install
bun run build
```

### TCP 테스트 서버

```bash
# 개발용 TCP 서버 실행
cd tcp-loopback-server
bun install
bun start
```

## 📁 프로젝트 구조

```
web_serial/
├── src/                           # 메인 소스 코드
│   ├── components/                # UI 컴포넌트
│   │   ├── App.ts                 # 메인 애플리케이션
│   │   ├── LogSettingsPanel.ts    # 로그 설정 패널
│   │   └── panels/                # 패널 컴포넌트들
│   ├── services/                  # 비즈니스 로직
│   │   ├── SerialService.ts       # Web Serial API
│   │   ├── TcpNativeService.ts    # TCP Native 서비스
│   │   ├── I18nService.ts         # 다국어 서비스
│   │   └── OptimizedLogService.ts # 최적화된 로그 서비스
│   ├── locales/                   # 다국어 파일
│   │   ├── ko.ts                  # 한국어
│   │   └── en.ts                  # 영어
│   └── utils/                     # 유틸리티
├── chrome-extension/              # Chrome 확장
│   ├── manifest.json              # 확장 매니페스트
│   ├── icons/                     # 확장 아이콘들
│   └── templates/                 # HTML 템플릿
├── stdio-proxy/                   # Native Messaging Host
│   ├── proxy.js                   # 메인 프록시 프로그램
│   ├── install-windows.bat        # Windows 설치
│   ├── install-linux.sh           # Linux 설치
│   └── install-macos.sh           # macOS 설치
└── tcp-loopback-server/           # TCP 테스트 서버
    ├── server.js                  # 테스트 서버
    └── config.json                # 서버 설정
```

## 🔧 기술 스택

### Frontend
- **TypeScript**: 정적 타입 체크
- **Tailwind CSS**: 유틸리티 CSS 프레임워크
- **Vite**: 모듈 번들러 및 개발 서버
- **Bun**: 고성능 JavaScript 런타임

### Browser APIs
- **Web Serial API**: 시리얼 포트 통신
- **Chrome Native Messaging**: 네이티브 앱 통신
- **Chrome Storage API**: 로컬 데이터 저장
- **IndexedDB API**: 대용량 로그 데이터 저장

### 아키텍처
- **Chrome Extension**: MV3 매니페스트
- **Native Messaging Host**: Node.js 기반
- **Virtual Scrolling**: 대용량 데이터 최적화
- **Circular Buffer**: 메모리 효율적 로그 관리

## 🎯 지원 기능

### Modbus 기능 코드
- **0x01**: Read Coils (코일 읽기)
- **0x02**: Read Discrete Inputs (이산 입력 읽기)
- **0x03**: Read Holding Registers (홀딩 레지스터 읽기)
- **0x04**: Read Input Registers (입력 레지스터 읽기)
- **0x05**: Write Single Coil (단일 코일 쓰기)
- **0x06**: Write Single Register (단일 레지스터 쓰기)
- **0x0F**: Write Multiple Coils (다중 코일 쓰기)
- **0x10**: Write Multiple Registers (다중 레지스터 쓰기)

### 통신 프로토콜
- **RTU**: CRC-16 자동 계산 및 검증
- **TCP**: MBAP 헤더 자동 추가
- **HEX/ASCII**: 양방향 변환 지원

### 분석 도구
- **패킷 구조 분석**: 실시간 Modbus 프레임 해석
- **응답 시간 측정**: 요청-응답 쌍 성능 분석
- **오류 코드 해석**: Modbus 예외 코드 상세 분석
- **실시간 통계**: 평균/최소/최대 응답 시간

### 로그 관리
- **메모리 버퍼**: 고속 액세스를 위한 순환 버퍼
- **IndexedDB 저장**: 대용량 로그 오프라인 저장
- **가상 스크롤링**: 수만 개 로그 항목 최적화 렌더링
- **자동 내보내기**: 메모리 초과 시 자동 파일 저장

## 🌟 주요 화면

### 메인 대시보드
- **연결 패널**: RTU/TCP Native 연결 설정
- **로그 패널**: 실시간 통신 로그 및 가상 스크롤링
- **명령 패널**: Modbus 명령 생성 및 전송
- **설정 패널**: 로그 관리 및 다국어 설정

### 연결 설정
- **RTU 설정**: 포트, Baud Rate, Parity, Data/Stop Bits
- **TCP 설정**: Host, Port, Timeout, 자동 재연결
- **Native Host 가이드**: 설치 및 문제해결 도움말

### 명령어 도구
- **Modbus 생성기**: Function Code 기반 명령어 생성
- **수동 입력**: HEX/ASCII 모드 지원
- **명령 히스토리**: 최근 명령어 및 반복 모드
- **실시간 미리보기**: CRC/MBAP 자동 계산

## 📋 브라우저 지원

| 브라우저 | Web Serial | Native Messaging | Chrome Extension | 지원 상태 |
|----------|------------|------------------|------------------|-----------|
| Chrome 89+ | ✅ | ✅ | ✅ | **완전 지원** |
| Edge 89+ | ✅ | ✅ | ✅ | **완전 지원** |
| Brave | ✅ | ✅ | ✅ | **완전 지원** |
| Opera | ✅ | ✅ | ✅ | **완전 지원** |
| Vivaldi | ✅ | ✅ | ✅ | **완전 지원** |
| Firefox | ❌ | ❌ | ❌ | 미지원 |
| Safari | ❌ | ❌ | ❌ | 미지원 |

> **참고**: 모든 Chromium 기반 브라우저에서 완전 지원됩니다.

## 🔒 보안 고려사항

### Web Serial API
- HTTPS 또는 localhost에서만 동작
- 사용자 명시적 포트 선택 필요
- 브라우저 권한 관리 시스템 적용

### Native Messaging
- Chrome Extension 매니페스트 기반 권한
- Native Host 디지털 서명 검증
- localhost 네트워크 통신 제한

### 데이터 보안
- 모든 통신 데이터는 로컬 처리
- 외부 서버로 데이터 전송 없음
- IndexedDB 로컬 저장만 사용

## 🚨 문제해결

### Native Host 연결 실패
1. stdio-proxy 설치 스크립트 실행 확인
2. 브라우저 완전 재시작
3. 확장 ID 및 레지스트리 등록 확인
4. 방화벽/백신 프로그램 예외 설정

### Serial 포트 접근 불가
1. 포트 사용 중인 다른 프로그램 종료
2. 디바이스 드라이버 설치 확인
3. 브라우저 권한 설정 확인
4. HTTPS 환경에서 실행

### 로그 성능 문제
1. 로그 설정에서 버퍼 크기 조정
2. 가상 스크롤링 활성화 확인
3. 자동 정리 기능 사용
4. 불필요한 로그 내보내기 및 삭제

## 🤝 기여하기

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add some amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### 개발 가이드라인
- TypeScript 엄격 모드 사용
- ESLint 규칙 준수
- SOLID 원칙 적용
- 단위 테스트 작성 권장

## 📜 버전 히스토리

### v1.0.0 (Current)
- ✅ Chrome Extension 완전 구현
- ✅ 다국어 지원 (한국어/영어)
- ✅ IndexedDB 로그 시스템
- ✅ 가상 스크롤링 최적화
- ✅ Native Messaging Host
- ✅ Modbus 응답 분석기

### 향후 계획
- 🔄 Firefox WebExtension 지원
- 📊 통계 대시보드 확장
- 🔐 통신 암호화 지원
- 📱 PWA 버전 개발

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE) 하에 배포됩니다.

## 🆘 지원 및 문의

- 📝 **Issues**: [GitHub Issues](https://github.com/your-org/web_serial/issues)
- 📖 **Documentation**: [프로젝트 위키](https://github.com/your-org/web_serial/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-org/web_serial/discussions)

---

**Modbus Protocol Analyzer** - Chrome Extension으로 만나는 강력한 Modbus 디버깅 도구 🚀

*Real-time Modbus RTU/TCP communication monitoring and analysis tool for Chrome browsers*