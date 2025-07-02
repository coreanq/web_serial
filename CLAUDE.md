**기본 사항**
- 한글로 답변한다.
- 주석은 영어로 달아둔다.

**javascript 작성시 가이드**

- 프로젝트 초기시 javascript 기본 프로젝트 구조 생성 
- TypeScript 사용 
- Tailwind CSS 사용
- eslint, vite, bun 사용 
- ES Modules (ESM) 사용
- TypeScript 엄격 모드 사용 
- UI Element 들은 공통의 모듈에 선언하여 전역으로 import 해서 사용한다.
- Dark Mode 를 고려해서 색상 설정이 되어야 한다.
- 반응형 웹
- 태블릿, Mobile, PC 버전에서 보이도록 UI 구성되야 하며, 가로 보기 세로 보기 고려되야함
- node.js 를 사용하는 경우 version 22 기준이여야 함

**코드 추가/수정 시 룰**

1. 단일 책임 원칙 (SRP: Single Responsibility Principle)
목표: 클래스나 모듈은 오직 하나의 변경 이유만을 가져야 합니다. 즉, 하나의 책임만 수행해야 합니다.
2. 개방-폐쇄 원칙 (OCP: Open/Closed Principle)
목표: 소프트웨어 엔티티(클래스, 모듈, 함수 등)는 확장에 대해서는 개방되어야 하지만, 수정에 대해서는 폐쇄되어야 합니다. 즉, 새로운 기능을 추가할 때 기존 코드를 수정하지 않아야 합니다.
3. 리스코프 치환 원칙 (LSP: Liskov Substitution Principle)
목표: 상위 타입의 객체는 하위 타입의 객체로 치환해도 프로그램의 정확성이 유지되어야 합니다. 즉, 부모 클래스를 사용하는 코드가 자식 클래스로 대체되어도 문제없이 동작해야 합니다.
4. 인터페이스 분리 원칙 (ISP: Interface Segregation Principle)
목표: 클라이언트는 자신이 사용하지 않는 메서드에 의존해서는 안 됩니다. 즉, 하나의 거대한 인터페이스보다는 여러 개의 작은 인터페이스가 낫습니다.
5. 의존성 역전 원칙 (DIP: Dependency Inversion Principle)
목표: 고수준 모듈은 저수준 모듈에 의존해서는 안 됩니다. 이 두 모듈 모두 추상화에 의존해야 합니다. 추상화는 세부 사항에 의존해서는 안 됩니다. 세부 사항이 추상화에 의존해야 합니다. (즉, 인터페이스나 추상 클래스에 의존하고, 구체 클래스에 직접 의존하지 않습니다.)
6. 코드 수정 발생 시 코드 수정한 부분의 주석이 알맞게 변경한다.


** Shell 에서 사용하는 tool
검색: ripgrep (rg)
수정/변환 (범용): sd
구조화된 데이터 (CSV/TSV): xsv
인터랙티브 검색/이동: fzf

---

# 프로젝트 개요

## 주 목적
이 프로젝트는 **Modbus Protocol Analyzer** 크롬 확장을 개발하는 것입니다. 웹 브라우저에서 Modbus RTU/TCP 통신을 실시간으로 모니터링하고 분석할 수 있는 도구를 제공합니다.

## 핵심 기능
- **Modbus RTU (Serial)**: Web Serial API를 통한 시리얼 포트 통신
- **Modbus TCP Native**: Native Messaging을 통한 TCP 소켓 통신
- **실시간 로그 분석**: 패킷 해석 및 시각화
- **명령 전송**: 수동 Modbus 명령 테스트
- **반복 모드**: 자동 명령 반복 실행
- **최적화된 로그 관리**: 순환 버퍼 + 지연 할당으로 메모리 효율성 극대화
- **자동 파일 저장**: 메모리 버퍼 초과 시 오래된 로그 자동 내보내기

---

# 프로젝트 구조

## 루트 디렉토리
```
web_serial/
├── src/                    # 메인 소스 코드
├── chrome-extension/       # 크롬 확장 매니페스트 및 리소스
├── stdio-proxy/           # Native Messaging Host 프로그램
├── tcp-loopback-server/   # TCP 테스트 서버
├── dist/                  # 빌드 결과물
├── vite.config.ts         # Vite 설정
├── package.json          # Node.js 의존성
└── CLAUDE.md            # 프로젝트 가이드 (이 파일)
```

## 소스 코드 구조 (src/)
```
src/
├── components/           # UI 컴포넌트
│   ├── App.ts           # 메인 애플리케이션
│   ├── LogSettingsPanel.ts  # 로그 설정 패널
│   └── panels/          # 패널 컴포넌트들
│       ├── ConnectionPanel.ts  # 연결 설정 패널
│       ├── LogPanel.ts         # 로그 표시 패널 (Virtual Scrolling + 최적화)
│       └── CommandPanel.ts     # 명령 전송 패널
├── services/            # 비즈니스 로직
│   ├── SerialService.ts      # Web Serial API 관리
│   ├── TcpNativeService.ts   # Native Messaging 관리
│   ├── ModbusParser.ts       # Modbus 프로토콜 파싱
│   ├── LogService.ts         # 기본 로그 관리
│   ├── OptimizedLogService.ts # 최적화된 로그 서비스 (CircularBuffer)
│   └── LazyCircularBuffer.ts  # 지연 할당 순환 버퍼
├── utils/               # 유틸리티 함수들
│   └── DateTimeFilter.ts    # 날짜/시간 필터
├── types/               # TypeScript 타입 정의
├── styles/              # CSS 스타일 파일
└── index.ts            # 진입점
```

---

# 주요 컴포넌트 설명

## 1. Chrome Extension (chrome-extension/)
크롬 확장의 핵심 파일들:
- **manifest.json**: 확장 설정 및 권한 정의
- **background.js**: 서비스 워커
- **content.js**: 웹 페이지 스크립트
- **icons/**: 확장 아이콘들

### 주요 권한
- `webSerial`: Web Serial API 사용
- `nativeMessaging`: Native Host와 통신
- `storage`: 로컬 데이터 저장

## 2. Native Messaging Host (stdio-proxy/)
TCP 소켓 통신을 위한 네이티브 프로그램:

### 설치 스크립트
- **install-windows.bat**: Windows용 설치 (레지스트리 등록 포함)
- **install-linux.sh**: Linux용 설치
- **install-macos.sh**: macOS용 설치

### 주요 기능
- Chrome Extension ↔ TCP Socket 브릿지 역할
- JSON 메시지 프로토콜로 통신
- com.my_company.stdio_proxy로 등록
- ES Modules 및 TypeScript 사용

### 설치 과정
1. Native Host 바이너리를 시스템에 복사
2. Chrome Native Messaging Host 매니페스트 파일 생성
3. Windows: 레지스트리 등록 (모든 Chromium 기반 브라우저 지원)
4. 확장에서 `chrome.runtime.connectNative()` 호출 가능

### 빌드 시스템
- **Vite**: 모던 빌드 도구 사용
- **TypeScript**: 타입 체크 및 ES Modules

## 3. TCP Loopback Server (tcp-loopback-server/)
개발 및 테스트용 TCP 서버:
- 포트 5020에서 수신 대기
- Modbus TCP 요청에 대한 응답 시뮬레이션
- 개발 중 실제 장비 없이 테스트 가능

---

# 통신 흐름

## RTU (Serial) 모드
```
Browser → Web Serial API → USB/Serial Device
```

## TCP Native 모드
```
Browser → Chrome Extension → Native Messaging → stdio-proxy → TCP Socket → Target Device
```

---

# 개발 환경 설정

## 필수 요구사항
- Node.js 22+
- Chrome 브라우저
- TypeScript
- Vite
- Bun

## 빌드 및 실행
```bash
# 의존성 설치
bun install

# 개발 서버 시작
bun run dev

# 프로덕션 빌드
bun run build

# 빌드 미리보기
bun run preview
```

## Chrome Extension 로드
1. Chrome에서 `chrome://extensions/` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `chrome-extension/` 디렉토리 선택

## Native Messaging Host 설치
```bash
# Windows
cd stdio-proxy
install-windows.bat

# Linux/macOS
cd stdio-proxy
chmod +x install-linux.sh
./install-linux.sh
```

---

# 주요 기술 스택

## Frontend
- **TypeScript**: 정적 타입 체크
- **Tailwind CSS**: 유틸리티 CSS 프레임워크
- **Vite**: 모듈 번들러 및 개발 서버
- **Bun**: 고성능 JavaScript 런타임 및 패키지 매니저
- **ESLint**: 코드 품질 관리

## Browser APIs
- **Web Serial API**: 시리얼 포트 통신
- **Chrome Native Messaging**: 네이티브 앱 통신
- **Chrome Storage API**: 로컬 데이터 저장

## Protocol
- **Modbus RTU**: 시리얼 기반 Modbus
- **Modbus TCP**: TCP/IP 기반 Modbus
- **JSON**: Native Messaging 프로토콜

---

# 트러블슈팅

## 일반적인 문제들

### 1. Native Proxy 연결 실패
- stdio-proxy 설치 확인
- Chrome Registry 등록 확인
- 확장 권한 확인

### 2. Serial 포트 접근 불가
- 포트 사용 중인지 확인
- 브라우저 권한 확인
- 포트 드라이버 설치 확인

### 3. TCP 연결 실패
- 방화벽 설정 확인
- 대상 장비 네트워크 확인
- tcp-loopback-server로 테스트

---

# 확장 및 커스터마이징

## 새로운 Modbus 기능 추가
1. `ModbusParser.ts`에 파싱 로직 추가
2. `types/index.ts`에 타입 정의
3. UI 컴포넌트에 표시 로직 추가

## 새로운 연결 타입 추가
1. `ConnectionPanel.ts`에 탭 추가
2. 해당 Service 클래스 생성
3. `App.ts`에 통합

## UI 컴포넌트 추가
1. `components/panels/`에 새 패널 추가
2. `App.ts`의 레이아웃에 통합
3. CSS 스타일 추가

# 고급 기능

## 최적화된 로그 관리 시스템

### LazyCircularBuffer
- **지연 할당 기법**: 메모리 세그먼트를 필요할 때만 할당하여 메모리 효율성 극대화
- **순환 버퍼**: 설정된 크기를 초과하면 오래된 로그를 자동 제거
- **세그먼트 기반**: 큰 버퍼를 작은 세그먼트로 나누어 관리

### OptimizedLogService
- **자동 파일 저장**: 버퍼 용량 초과 시 오래된 로그를 자동으로 파일 저장
- **사용자 설정 가능**: 버퍼 크기, 세그먼트 크기, 자동 저장 임계값 등 사용자 정의
- **다양한 파일 형식**: JSON, CSV, TXT 형식으로 로그 내보내기 지원
- **메모리 자동 정리**: 주기적으로 사용하지 않는 메모리 세그먼트 해제

### 반복 모드 최적화
- **Throttled Logging**: 반복 모드에서 UI 응답성을 위한 로그 배치 처리
- **정확한 카운팅**: 반복 모드에서도 모든 로그가 정확히 카운트되도록 보장
- **순서 보장**: 송수신 로그의 시간 순서를 정확히 유지

### 설정 UI
- **실시간 통계**: 메모리 사용량, 할당된 세그먼트, 메모리 효율성 등 8가지 통계 표시
- **버퍼 설정**: 버퍼 크기, 세그먼트 크기, 자동 저장 설정 등
- **자동 메모리 정리**: 주기적 메모리 정리 설정 및 수동 정리 기능

### 메모리 최적화 특징
1. **지연 할당**: 실제 필요할 때만 메모리 할당
2. **세그먼트 기반**: 메모리 재할당 없이 버퍼 크기 변경 가능
3. **자동 해제**: 사용하지 않는 세그먼트 자동 해제
4. **효율성 모니터링**: 실시간 메모리 효율성 추적

## 패키지 매니저 마이그레이션

### Bun 도입
- **고성능**: npm/yarn 대비 훨씬 빠른 패키지 설치 및 빌드 성능
- **TypeScript 네이티브 지원**: 별도 트랜스파일 과정 없이 TypeScript 직접 실행
- **전체 프로젝트 통합**: 루트, chrome-extension, stdio-proxy, tcp-loopback-server 모두 bun 사용

### 변경된 스크립트
- `npm install` → `bun install`
- `npm run dev` → `bun run dev`
- `npm run build` → `bun run build`

---

이 문서는 프로젝트의 전반적인 이해를 돕기 위한 가이드입니다. 코드 수정 시 이 구조를 참고하여 일관성을 유지해주세요.

│ 반복 전송 모드 성능 최적화 계획                                                                                                                                               │ │
│ │                                                                                                                                                                               │ │
│ │ 문제 분석                                                                                                                                                                     │ │
│ │                                                                                                                                                                               │ │
│ │ 반복 전송 모드에서 로그 수가 증가할수록 성능이 급격히 저하되는 문제를 발견했습니다.                                                                                           │ │
│ │                                                                                                                                                                               │ │
│ │ 주요 성능 병목 지점:                                                                                                                                                          │ │
│ │                                                                                                                                                                               │ │
│ │ 1. App.ts의 flushThrottledLogs(): O(n²) 복잡도로 각 로그마다 전체 배열 순회                                                                                                   │ │
│ │ 2. 동기적 UI 업데이트: 개별 로그마다 DOM 재렌더링                                                                                                                             │ │
│ │ 3. 메모리 누적: pendingRepeatLogs 배열 지속적 증가                                                                                                                            │ │
│ │ 4. 타임스탬프 기반 정렬: 매번 삽입 위치 계산                                                                                                                                  │ │
│ │                                                                                                                                                                               │ │
│ │ 최적화 전략                                                                                                                                                                   │ │
│ │                                                                                                                                                                               │ │
│ │ 1. 배치 처리 최적화 (App.ts)                                                                                                                                                  │ │
│ │                                                                                                                                                                               │ │
│ │ - flushThrottledLogs() 함수를 단순 append 방식으로 변경                                                                                                                       │ │
│ │ - 타임스탬프 정렬을 별도 스레드나 지연 처리로 분리                                                                                                                            │ │
│ │ - 대량 로그 처리를 위한 청크 단위 처리 도입                                                                                                                                   │ │
│ │                                                                                                                                                                               │ │
│ │ 2. UI 렌더링 최적화 (LogPanel.ts)                                                                                                                                             │ │
│ │                                                                                                                                                                               │ │
│ │ - 반복 모드 중 실시간 렌더링 억제                                                                                                                                             │ │
│ │ - Virtual scrolling이나 windowing 기법 적용                                                                                                                                   │ │
│ │ - 툴팁 비활성화로 마우스 이벤트 오버헤드 제거                                                                                                                                 │ │
│ │                                                                                                                                                                               │ │
│ │ 3. 메모리 관리 개선                                                                                                                                                           │ │
│ │                                                                                                                                                                               │ │
│ │ - pendingRepeatLogs 크기 제한 및 순환 처리                                                                                                                                    │ │
│ │ - 최적화된 로그 서비스 활용도 증대                                                                                                                                            │ │
│ │ - 가비지 컬렉션 최적화                                                                                                                                                        │ │
│ │                                                                                                                                                                               │ │
│ │ 4. 비동기 처리 강화                                                                                                                                                           │ │
│ │                                                                                                                                                                               │ │
│ │ - setTimeout 기반 배치 처리를 requestIdleCallback으로 변경                                                                                                                    │ │
│ │ - Web Workers 활용 검토 (대용량 로그 처리용)                                                                                                                                  │ │
│ │                                                                                                                                                                               │ │
│ │ 구현 순서                                                                                                                                                                     │ │
│ │                                                                                                                                                                               │ │
│ │ 1. App.ts의 로그 배치 처리 로직 최적화                                                                                                                                        │ │
│ │ 2. LogPanel.ts의 반복 모드 UI 최적화                                                                                                                                          │ │
│ │ 3. CommandPanel.ts의 타이머 관리 개선                                                                                                                                         │ │
│ │ 4. 통합 테스트 및 성능 검증                                                                                                                                                   │ │
│ │                                                                                                                                                                               │ │
│ │ 이 최적화를 통해 반복 전송 모드에서도 안정적인 성능을 확보할 수 있을 것입니다.  