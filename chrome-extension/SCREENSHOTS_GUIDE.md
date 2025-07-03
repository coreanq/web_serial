# Chrome Web Store 스크린샷 가이드

Chrome Web Store 등록을 위한 스크린샷 제작 가이드입니다.

## 스크린샷 요구사항

### 기본 스펙
- **크기**: 1280x800px 또는 640x400px (16:10 비율)
- **형식**: PNG, JPG, WebP
- **최소 개수**: 1개 (권장: 3-5개)
- **최대 개수**: 5개

### 권장 해상도
- **데스크톱**: 1280x800px (고해상도 권장)
- **모바일/태블릿**: 640x400px (필요시)

## 촬영할 화면들

### 1. 메인 대시보드 (필수)
**파일명**: `01-main-dashboard.png`
**내용**: 
- 전체 UI 개요
- 연결 패널 + 로그 패널 + 명령 패널
- 활성화된 연결 상태
- 실시간 로그 데이터 표시

**스크린샷 설정**:
```
화면 구성:
├── 상단: Modbus Protocol Analyzer 헤더
├── 왼쪽: Connection Panel (RTU 연결됨)
├── 중앙: Log Panel (실시간 로그 30-50개)
└── 우쪽: Command Panel (명령어 입력 상태)

로그 내용 예시:
[14:23:45.123] SEND: 01 03 00 00 00 0A C5 CD
[14:23:45.145] RECV: 01 03 14 00 64 00 C8 01 2C...
[14:23:45.167] SEND: 01 06 00 10 01 F4 8D FA
```

### 2. 연결 설정 패널 (필수)
**파일명**: `02-connection-settings.png`
**내용**:
- RTU 및 TCP Native 탭
- 상세한 연결 설정 옵션
- Native Host 설치 가이드 (TCP 탭)

**설정 표시**:
```
RTU 설정:
- Port: COM3 (USB Serial Port)
- Baud Rate: 115200
- Parity: None
- Data Bits: 8
- Stop Bits: 1
- Status: Connected ✅

TCP Native 설정:
- Host: 192.168.1.100
- Port: 502
- Timeout: 5000ms
- Auto Reconnect: Enabled
- Status: Native Host Connected ✅
```

### 3. 명령 생성기 (권장)
**파일명**: `03-command-generator.png`
**내용**:
- Modbus Command Generator 활성 상태
- Function Code 선택 (03 - Read Holding Registers)
- 주소 및 수량 입력
- 생성된 명령어 미리보기

**명령어 예시**:
```
Function Code: 03 - Read Holding Registers
Slave ID: 01
Start Address: 0x0000 (0)
Quantity: 10
Generated: 01 03 00 00 00 0A C5 CD

Preview:
- RTU: 01 03 00 00 00 0A C5 CD
- TCP: 00 01 00 00 00 06 01 03 00 00 00 0A
```

### 4. 고급 로그 관리 (권장)
**파일명**: `04-log-management.png`
**내용**:
- 로그 설정 패널 열린 상태
- 메모리 사용량 통계
- 가상 스크롤링 활성화
- 내보내기 옵션

**통계 표시**:
```
Memory Statistics:
- Memory Logs: 1,234 / 10,000
- Total Logs: 15,678
- Buffer Utilization: 12.3%
- IndexedDB Logs: 14,444
- Memory Efficiency: 98.7%
```

### 5. 다국어 지원 (선택)
**파일명**: `05-korean-interface.png`
**내용**:
- 한국어 인터페이스로 전환
- 동일한 기능이지만 한국어로 표시
- 언어 설정 드롭다운 보임

## 스크린샷 촬영 방법

### 1. 브라우저 설정
```bash
# Chrome 개발자 도구 열기
F12 또는 Cmd+Option+I

# 디바이스 시뮬레이션 모드
Cmd+Shift+M (Mac) 또는 Ctrl+Shift+M (Windows)

# 커스텀 해상도 설정
1280 x 800 (또는 1920 x 1200 for 높은 DPI)
```

### 2. 확장 실행
```bash
# 확장 페이지 직접 접속
chrome-extension://[extension-id]/index.html

# 또는 팝업에서 "Open in New Tab" 링크 클릭
```

### 3. 테스트 데이터 준비

#### RTU 연결용 더미 데이터
```javascript
// 개발자 콘솔에서 실행
// 테스트 로그 생성
for(let i = 0; i < 50; i++) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const slaveId = String(Math.floor(Math.random() * 10) + 1).padStart(2, '0');
  const functionCode = ['01', '03', '04', '06', '10'][Math.floor(Math.random() * 5)];
  
  // Send 로그
  logService.addLog({
    timestamp: `[${timestamp}]`,
    direction: 'SEND',
    data: `${slaveId} ${functionCode} 00 00 00 0A C5 CD`,
    type: 'rtu'
  });
  
  // Receive 로그 (200ms 후)
  setTimeout(() => {
    logService.addLog({
      timestamp: `[${timestamp}]`,
      direction: 'RECV', 
      data: `${slaveId} ${functionCode} 14 00 64 00 C8 01 2C...`,
      type: 'rtu'
    });
  }, 200);
}
```

### 4. 화면 캡처

#### macOS
```bash
# 전체 화면
Cmd + Shift + 3

# 선택 영역
Cmd + Shift + 4

# 특정 창
Cmd + Shift + 4 + Space
```

#### Windows
```bash
# 스니핑 도구
Windows + Shift + S

# 전체 화면
PrtScn

# 활성 창
Alt + PrtScn
```

### 5. 이미지 편집

#### 필수 편집 작업
1. **크기 조정**: 정확히 1280x800px
2. **품질 최적화**: PNG 또는 고품질 JPG
3. **개인정보 제거**: IP 주소, 포트 번호 등 마스킹
4. **UI 정리**: 불필요한 브라우저 UI 제거

#### 권장 편집 도구
- **무료**: GIMP, Paint.NET, Photopea
- **유료**: Adobe Photoshop, Sketch

## 스크린샷 체크리스트

### 기술적 요구사항
- [ ] 해상도: 1280x800px
- [ ] 파일 형식: PNG (권장) 또는 JPG
- [ ] 파일 크기: 5MB 미만
- [ ] 비율: 16:10 정확히 맞춤

### 내용 요구사항
- [ ] UI가 명확하고 읽기 쉬움
- [ ] 실제 사용 상황을 보여줌
- [ ] 주요 기능이 모두 표시됨
- [ ] 오류나 빈 화면 없음
- [ ] 개인정보 없음 (IP, 경로 등)

### 시각적 품질
- [ ] 선명하고 고품질
- [ ] 적절한 대비와 가독성
- [ ] 일관된 UI 테마
- [ ] 브라우저 UI 최소화
- [ ] 확장 기능 명확히 표시

## 파일 구조

```
chrome-extension/
└── screenshots/
    ├── 01-main-dashboard.png       # 메인 대시보드
    ├── 02-connection-settings.png  # 연결 설정
    ├── 03-command-generator.png    # 명령 생성기
    ├── 04-log-management.png       # 로그 관리
    ├── 05-korean-interface.png     # 한국어 인터페이스
    └── raw/                        # 원본 파일
        ├── full-resolution/
        └── editing-sources/
```

## 업로드 순서

Chrome Web Store에서는 스크린샷 순서가 중요합니다:

1. **메인 대시보드** - 첫 인상이 가장 중요
2. **연결 설정** - 사용 방법 이해
3. **명령 생성기** - 핵심 기능 시연
4. **로그 관리** - 고급 기능 소개  
5. **다국어 지원** - 추가 가치 제시

이 가이드를 따라 Chrome Web Store에 등록할 전문적인 스크린샷을 준비하실 수 있습니다!