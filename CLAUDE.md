# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 개발 명령어

## 루트 프로젝트 명령어
```bash
# 의존성 설치
bun install

# 개발 서버 시작 (메인 애플리케이션)
bun run dev

# 프로덕션 빌드
bun run build

# 빌드 미리보기
bun run preview

# 코드 린팅
bun run lint

# 린팅 자동 수정
bun run lint:fix

# TypeScript 타입 체크
bun run typecheck
```

## Chrome Extension 빌드
```bash
cd chrome-extension
bun install
bun run build
```

## Native Messaging Host 빌드
```bash
cd stdio-proxy
bun install
bun run build
```

## TCP 테스트 서버 실행
```bash
cd tcp-loopback-server
bun install
bun start
```

## Native Host 설치 (OS별)
```bash
# Windows
cd stdio-proxy
install-windows.bat

# Linux/macOS
cd stdio-proxy
chmod +x install-linux.sh
./install-linux.sh
```

# 아키텍처 개요

## Chrome Extension 멀티 타겟 아키텍처
이 프로젝트는 하나의 소스 코드에서 세 가지 다른 Chrome Extension 컨텍스트를 빌드합니다:

1. **메인 애플리케이션** (`src/index.ts`): 독립 실행형 웹 앱
2. **Extension Popup** (`src/popup.ts`): 확장 팝업 페이지
3. **Extension Options** (`src/options.ts`): 확장 옵션 페이지
4. **Background Script** (`src/background.ts`): 서비스 워커

## 하이브리드 로그 관리 시스템
```
메모리 (SimpleCircularBuffer) ←→ IndexedDB (대용량 저장)
        ↓
가상 스크롤링 (VirtualScrollManager)
        ↓
DOM 렌더링 (최적화된 업데이트)
```

## 애플리케이션 설정 관리 시스템
```
SettingsService (IndexedDB)
        ↓
패널 위치, 테마, 언어, Recent Commands 영구 저장
        ↓
자동 복원 (앱 재시작 시)
```

## 통신 아키텍처
```
RTU 모드: Browser → Web Serial API → Serial Device
TCP 모드: Browser → Chrome Extension → Native Host → TCP Socket → Device
```

## 다국어 시스템 아키텍처
- **I18nService**: 중앙 집중식 다국어 관리
- **타입 안전성**: `tString()`, `tArray()` 전용 메서드
- **폴백 시스템**: 한국어 → 영어 → 키 이름 순서

**기본 사항**
- 한글로 답변한다.
- 주석은 영어로 달아둔다.

**javascript 작성시 가이드**

- 프로젝트 초기시 javascript 기본 프로젝트 구조 생성 
- TypeScript 사용 
- Tailwind CSS Version 3 사용
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
6. 코드 수정 발생 시 코드 수정한 부분의 주석을 알맞게 변경한다.


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
- **최적화된 로그 관리**: 순환 버퍼 + IndexedDB로 메모리 효율성 극대화
- **자동 파일 저장**: 메모리 버퍼 초과 시 오래된 로그 자동 내보내기
- **영구 설정 저장**: IndexedDB 기반 패널 위치, 테마, 언어, Recent Commands 영구 저장
- **다국어 지원**: 한국어, 영어 인터페이스 지원
- **가상 스크롤링**: 대용량 로그 표시 최적화
- **Modbus 응답 계산기**: 실시간 응답 시간 및 통계 계산
- **Chrome 확장 통합**: 백그라운드, 옵션, 팝업 페이지 완전 지원

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
├── public/                # 공개 리소스 파일
├── diagram/               # 시퀀스 다이어그램 (MMD 파일)
├── prd/                   # 프로덕션 관련 정보
├── vite.config.ts         # Vite 설정
├── package.json          # Node.js 의존성
├── bunfig.toml           # Bun 런타임 설정
├── tailwind.config.js    # Tailwind CSS 설정
├── postcss.config.js     # PostCSS 설정
├── tsconfig.json         # TypeScript 설정
└── CLAUDE.md            # 프로젝트 가이드 (이 파일)
```

## 소스 코드 구조 (src/)
```
src/
├── index.ts                   # 진입점
├── background.ts              # 백그라운드 스크립트
├── options.ts                 # 옵션 페이지 스크립트
├── popup.ts                   # 팝업 스크립트
├── components/                # UI 컴포넌트
│   ├── App.ts                 # 메인 애플리케이션
│   ├── LogSettingsPanel.ts    # 로그 설정 패널
│   └── panels/                # 패널 컴포넌트들
│       ├── ConnectionPanel.ts # 연결 설정 패널
│       ├── LogPanel.ts        # 로그 표시 패널 (Virtual Scrolling + 최적화)
│       └── CommandPanel.ts    # 명령 전송 패널
├── services/                  # 비즈니스 로직
│   ├── SerialService.ts       # Web Serial API 관리
│   ├── TcpNativeService.ts    # TCP Native 서비스
│   ├── NativeMessagingService.ts # Native Messaging 관리
│   ├── LogService.ts          # 기본 로그 관리
│   ├── OptimizedLogService.ts # 최적화된 로그 서비스 (CircularBuffer)
│   ├── IndexedDBLogService.ts # IndexedDB 로그 서비스
│   ├── SimpleCircularBuffer.ts # 순환 버퍼 구현
│   ├── SettingsService.ts     # 애플리케이션 설정 관리 (IndexedDB)
│   └── I18nService.ts         # 다국어 지원 서비스
├── locales/                   # 다국어 파일
│   ├── index.ts               # 다국어 진입점
│   ├── ko.ts                  # 한국어 번역
│   └── en.ts                  # 영어 번역
├── utils/                     # 유틸리티 함수들
│   ├── DateTimeFilter.ts      # 날짜/시간 필터
│   ├── ModbusResponseCalculator.ts # Modbus 응답 계산기
│   └── VirtualScrollManager.ts # 가상 스크롤 관리자
├── types/                     # TypeScript 타입 정의
│   ├── index.ts               # 메인 타입 정의
│   └── chrome.d.ts            # Chrome API 타입 정의
└── styles/                    # CSS 스타일 파일
    └── index.css              # 메인 스타일 시트
```

---

# 주요 컴포넌트 설명

## 1. Chrome Extension (chrome-extension/)
크롬 확장의 핵심 파일들:
- **manifest.json**: 확장 설정 및 권한 정의
- **background.js**: 서비스 워커
- **icons/**: 확장 아이콘들 (16x16, 32x32, 48x48, 128x128)
- **templates/**: HTML 템플릿
  - **popup.html**: 팝업 페이지
  - **options.html**: 옵션 페이지
- **dist/**: 빌드된 확장 파일들
- **modbus-analyzer-extension-v1.0.0.zip**: 패키지된 확장
- **promotional/**: 확장 프로모션 관련 파일들
- **scripts/**: 빌드 스크립트
- **store-listing.json**: 스토어 등록 정보
- **PROMOTIONAL_IMAGES_GUIDE.md**: 프로모션 이미지 가이드
- **SCREENSHOTS_GUIDE.md**: 스크린샷 가이드

### 주요 권한
- `webSerial`: Web Serial API 사용
- `nativeMessaging`: Native Host와 통신
- `storage`: 로컬 데이터 저장

### 확장 스크립트
- **src/background.ts**: 백그라운드 서비스 워커
- **src/popup.ts**: 팝업 페이지 스크립트
- **src/options.ts**: 옵션 페이지 스크립트

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
- **IndexedDB API**: 대용량 로그 데이터 저장
- **Chrome Extension APIs**: 백그라운드, 팝업, 옵션 페이지

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

## 서비스 클래스 상세 구현

### SerialService.ts
- **Web Serial API 관리**: 시리얼 포트 연결, 데이터 송수신, 연결 상태 관리
- **주요 메서드**: `isSupported()`, `requestPort()`, `connect()`, `disconnect()`, `sendData()`, `startReading()`
- **패킷 버퍼링**: 5ms 타임아웃으로 응답 패킷을 수집하고 Modbus 응답 길이 예측을 통한 완전한 패킷 수신
- **연결 관리**: 중복 연결 방지, 타임아웃 처리(15초), 상세한 오류 메시지 제공
- **데이터 변환**: `uint8ArrayToHex()`, `hexToUint8Array()` 유틸리티 메서드

### TcpNativeService.ts
- **Native Messaging 통합**: `com.my_company.stdio_proxy` 호스트와 통신
- **패킷 버퍼링**: RTU와 동일한 5ms 타임아웃 방식으로 TCP 패킷 수집
- **연결 상태 관리**: Proxy 연결과 TCP 연결을 분리하여 관리
- **콜백 시스템**: `onConnectionChange()`, `onData()`, `onError()`, `onProxyStatus()` 이벤트 핸들러

### SettingsService.ts
- **IndexedDB 기반 설정 관리**: 브라우저 재시작 시에도 설정 유지
- **AppSettings 인터페이스**: 패널 위치, 테마, 언어, Recent Commands 타입 안전 관리
- **비동기 설정 로드/저장**: `loadSettings()`, `saveSettings()`, 특화된 업데이트 메서드들
- **Recent Commands 관리**: 최대 10개까지 명령 히스토리 자동 관리
- **자동 병합**: 기본 설정과 사용자 설정 자동 병합으로 누락 방지
- **오류 처리**: IndexedDB 접근 실패 시 기본값으로 안전한 폴백

### I18nService.ts
- **다국어 메서드**: `t()`, `tString()`, `tArray()` - 타입 안전성 보장
- **폴백 시스템**: 한국어 → 영어 → 키 이름 순서로 폴백
- **매개변수 보간**: `{{key}}` 형태의 동적 값 치환
- **중첩 객체 지원**: 점 표기법으로 깊은 객체 구조 접근

## UI 컴포넌트 상세 구현

### App.ts
- **패널 관리**: 연결 패널 위치(상단/좌측/우측) 동적 변경, 컴팩트 모드 지원
- **메모리 최적화**: Object Pool을 통한 LogEntry 재사용, GC 타이머(30초)
- **배치 처리**: 반복 모드에서 50개씩 로그 배치 처리, 250ms 업데이트 간격
- **언어 변경**: 전체 UI 재렌더링 및 상태 복원

### LogPanel.ts
- **가상 스크롤링**: VirtualScrollManager를 통한 30개 이상 로그 시 자동 활성화
- **실시간 툴팁 시스템**: 마우스 오버 시 실시간으로 Modbus 패킷 분석 및 툴팁 생성
- **조건부 툴팁 활성화**: 반복 모드 실행 중 및 스크롤 중일 때 성능을 위해 툴팁 비활성화
- **시간 필터**: DateTimeFilter로 프리셋(1시간, 4시간, 오늘 등) 및 커스텀 범위 지원
- **증분 렌더링**: 새 로그만 DOM에 추가하는 효율적 업데이트

### CommandPanel.ts
- **새로운 UI 구조**: Command Builder → Recent Commands → Manual Command 순서로 재구성
- **섹션별 시각화**: 파란색(Command Builder), 초록색(Recent Commands), 주황색(Manual Command) 테두리로 구분
- **간소화된 명령 전송**: Build Command 버튼 제거, Send Command 시 자동 빌드 후 전송
- **명령 생성기**: HEX/DEC 모드 지원, 펑션 코드별 데이터 값 입력
- **반복 모드**: 다중 명령 선택, 정밀한 타이밍 제어(드리프트 보정)
- **실시간 미리보기**: Modbus 패킷 분석 및 프로토콜 정보 표시
- **영구 히스토리**: SettingsService 연동으로 최근 10개 명령 IndexedDB 저장

### ConnectionPanel.ts
- **탭 시스템**: RTU/TCP_NATIVE 탭별 다른 UI 렌더링
- **연결 진행 상태**: 단계별 진행 메시지 표시
- **Native Host 가이드**: OS별 설치 패키지 다운로드, 문제해결 가이드
- **상태 표시**: Proxy 연결/TCP 연결 분리된 상태 인디케이터

## 유틸리티 클래스 상세 구현

### ModbusResponseCalculator.ts
- **응답 길이 예측**: RTU/TCP 프로토콜별 정확한 응답 크기 계산
- **펑션 코드 지원**: 0x01-0x2B 모든 주요 펑션 코드 지원
- **프레임 구조 인식**: MBAP 헤더(TCP), Device ID + CRC(RTU) 처리
- **유효성 검증**: 응답 길이 검증 및 허용 오차 설정

### VirtualScrollManager.ts
- **뷰포트 계산**: 스크롤 위치 기반 가시 영역 아이템 계산
- **오버스캔**: 부드러운 스크롤을 위한 추가 아이템 렌더링
- **상태 관리**: `scrollTop`, `startIndex`, `endIndex`, `visibleItems` 추적
- **콜백 시스템**: 상태 변경 시 UI 업데이트 트리거

### DateTimeFilter.ts
- **프리셋 필터**: 1시간, 4시간, 오늘, 어제 등 빠른 시간 범위 설정
- **커스텀 범위**: 사용자 정의 시작/종료 날짜 및 시간 설정
- **실시간 업데이트**: 현재 시간 기준 동적 필터링
- **타임존 처리**: 로컬 타임존 기반 정확한 시간 계산

## 최적화된 로그 관리 시스템

### SimpleCircularBuffer
- **순환 버퍼**: 설정된 크기를 초과하면 오래된 로그를 자동 제거
- **메모리 효율성**: 고정 크기 버퍼로 메모리 사용량 예측 가능
- **고속 액세스**: 인덱스 기반 빠른 데이터 접근
- **효율적 연산**: head/tail 포인터로 O(1) 삽입/제거
- **동적 크기 조정**: `resize()` 메서드로 런타임 버퍼 크기 변경
- **통계 정보**: 용량, 사용량, 메모리 추정치 제공

### OptimizedLogService
- **하이브리드 저장**: SimpleCircularBuffer(메모리) + IndexedDBLogService(DB) 조합으로 대용량 로그 처리
- **자동 오버플로우 처리**: 메모리 버퍼 초과 시 IndexedDB로 자동 이동 (배치 처리 100개 단위)
- **사용자 설정 가능**: 버퍼 크기, 세그먼트 크기, 자동 저장 임계값 등 사용자 정의
- **다양한 파일 형식**: JSON, CSV, TXT 형식으로 로그 내보내기 지원
- **메모리 자동 정리**: 주기적으로 사용하지 않는 메모리 세그먼트 해제
- **설정 관리**: `loadSettings()`, `saveSettings()`, `updateConfig()` 메서드
- **통계 정보**: 메모리 사용량, 버퍼 이용률, IndexedDB 크기 등 8가지 통계

### IndexedDBLogService
- **브라우저 DB 활용**: IndexedDB를 활용한 대용량 로그 저장
- **오프라인 지원**: 브라우저 재시작 후에도 로그 데이터 유지
- **효율적 검색**: 인덱스 기반 빠른 로그 검색 및 필터링
- **자동 정리**: 전체 로그 저장 시 IndexedDB 자동 초기화
- **DB 관리**: `ModbusLogsDB` 데이터베이스, `overflowLogs` 테이블
- **배치 처리**: `addOverflowLogs()` 메서드로 대량 로그 효율적 저장
- **페이지네이션**: `getOverflowLogsPaginated()` 메서드로 메모리 효율적 로그 조회
- **통계 및 정리**: DB 크기 추정, 날짜별 로그 정리 기능

### 반복 모드 최적화
- **Throttled Logging**: 반복 모드에서 UI 응답성을 위한 로그 배치 처리
- **정확한 카운팅**: 반복 모드에서도 모든 로그가 정확히 카운트되도록 보장
- **순서 보장**: 송수신 로그의 시간 순서를 정확히 유지

### 설정 UI
- **실시간 통계**: 메모리 사용량, 할당된 세그먼트, 메모리 효율성 등 8가지 통계 표시
- **버퍼 설정**: 버퍼 크기, 세그먼트 크기, 자동 저장 설정 등
- **자동 메모리 정리**: 주기적 메모리 정리 설정 및 수동 정리 기능

### 메모리 최적화 특징
1. **하이브리드 저장**: 메모리 + IndexedDB 조합으로 최적 성능
2. **순환 버퍼**: 고정 크기 버퍼로 메모리 사용량 예측 가능
3. **자동 오버플로우**: 메모리 초과 시 IndexedDB로 자동 이동
4. **효율성 모니터링**: 실시간 메모리 및 DB 사용량 추적

## UI 최적화 시스템

### VirtualScrollManager
- **가상 스크롤링**: 대용량 로그 데이터를 효율적으로 렌더링
- **동적 높이 계산**: 로그 항목의 동적 높이 자동 계산
- **스크롤 위치 추적**: 정확한 스크롤 위치 및 가시 영역 관리
- **메모리 절약**: 화면에 보이는 항목만 DOM에 렌더링
- **뷰포트 계산**: 스크롤 위치 기반 가시 영역 아이템 계산
- **오버스캔**: 부드러운 스크롤을 위한 추가 아이템 렌더링
- **상태 관리**: `scrollTop`, `startIndex`, `endIndex`, `visibleItems` 추적
- **콜백 시스템**: 상태 변경 시 UI 업데이트 트리거

### 성능 최적화
- **지연 렌더링**: 필요할 때만 DOM 요소 생성
- **배치 업데이트**: 다수의 로그를 한 번에 처리
- **스크롤 버퍼링**: 부드러운 스크롤 경험을 위한 버퍼 관리

## Modbus 프로토콜 지원

### ModbusResponseCalculator
- **응답 시간 계산**: 요청-응답 쌍의 정확한 응답 시간 측정
- **통계 수집**: 평균, 최소, 최대 응답 시간 통계
- **오류 분석**: Modbus 오류 코드 분석 및 통계
- **성능 모니터링**: 실시간 통신 성능 지표 제공
- **응답 길이 예측**: RTU/TCP 프로토콜별 정확한 응답 크기 계산
- **펑션 코드 지원**: 0x01-0x2B 모든 주요 펑션 코드 지원
- **프레임 구조 인식**: MBAP 헤더(TCP), Device ID + CRC(RTU) 처리
- **유효성 검증**: 응답 길이 검증 및 허용 오차 설정

## 다국어 지원 시스템 (I18nService)

### 주요 기능
- **다국어 지원**: 한국어, 영어 지원
- **중첩 객체 지원**: 점 표기법(dot notation)으로 중첩된 번역 키 접근
- **폴백 지원**: 번역이 없는 경우 영어로 자동 폴백
- **타입 안전성**: 문자열과 배열을 구분하는 전용 메서드 제공

### 메서드 종류
- **`t(key)`**: 범용 번역 메서드 (string | string[] 반환)
- **`tString(key)`**: 문자열 전용 번역 메서드 (string 반환 보장)
- **`tArray(key)`**: 배열 전용 번역 메서드 (string[] 반환 보장)
- **파라미터 보간**: `{{key}}` 형태의 동적 값 치환 지원

### 사용 예시
```typescript
// 문자열 번역
const title = i18n.tString('app.title');

// 배열 번역 (예: 문제해결 항목)
const items = i18n.tArray('connection.nativeGuide.troubleshootingItems');

// 파라미터 보간
const message = i18n.tString('log.count', { count: 10 });
```

### 로케일 파일 구조
```typescript
// src/locales/ko.ts, en.ts
export const ko = {
  app: {
    title: "Modbus 프로토콜 분석기"
  },
  connection: {
    nativeGuide: {
      troubleshootingItems: [
        "항목 1",
        "항목 2"
      ]
    }
  }
};
```

### 번역 구조
- **체계적 구조**: `app`, `common`, `panel`, `connection`, `log`, `command`, `modbus`, `errors` 섹션
- **중첩 객체**: 연결 → RTU/TCP → 메시지 → 상태 형태의 계층 구조
- **배열 지원**: `troubleshootingItems` 등 리스트 형태 번역
- **매개변수 지원**: `{{count}}`, `{{bytes}}` 등 동적 값 치환

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

---

# 추가 프로젝트 파일

## 다이어그램 (diagram/)
- **serial_read_seq.mmd**: 시리얼 읽기 시퀀스 다이어그램
- **serial_write_seq.mmd**: 시리얼 쓰기 시퀀스 다이어그램

## 프로덕션 관련 (prd/)
- **prd.txt**: 프로덕션 관련 정보

## 설정 파일들
- **tailwind.config.js**: Tailwind CSS 설정
- **postcss.config.js**: PostCSS 설정
- **tsconfig.json**: TypeScript 설정
- **bunfig.toml**: Bun 런타임 설정

---

# 최신 업데이트 사항

## v1.0.3 주요 변경사항 (최신)
1. **SettingsService 도입**: IndexedDB 기반 영구 설정 저장 시스템
2. **Command Panel UI 재구성**: Command Builder → Recent Commands → Manual Command 순서, 색상 구분
3. **실시간 툴팁 시스템**: 성능 최적화를 위한 온디맨드 툴팁 생성
4. **연결 패널 기본값 변경**: Connection Panel 기본 위치를 'left'로 변경
5. **명령 전송 간소화**: Build Command 버튼 제거, Send 시 자동 빌드

## v1.0.0 주요 변경사항
1. **다국어 지원 완전 구현**: 한국어, 영어 UI 완전 지원
2. **IndexedDB 로그 시스템**: 대용량 로그 처리 및 오프라인 지원
3. **가상 스크롤링**: 수만 개 로그 항목 실시간 렌더링
4. **Chrome 확장 완전 통합**: 백그라운드, 팝업, 옵션 페이지
5. **Modbus 응답 분석**: 실시간 통신 성능 모니터링
6. **UI/UX 개선**: 반응형 디자인 및 접근성 향상

## 타입 안전성 개선
- Chrome API 타입 정의 추가
- I18nService 타입 안전성 강화 (tString, tArray 메서드)
- 엄격한 TypeScript 설정 적용

## 성능 최적화
- 가상 스크롤링으로 DOM 요소 최소화
- IndexedDB 활용으로 메모리 사용량 최적화
- 배치 처리로 UI 응답성 향상

---

이 문서는 프로젝트의 전반적인 이해를 돕기 위한 가이드입니다. 코드 수정 시 이 구조를 참고하여 일관성을 유지해주세요.

