# Web Serial Online - Modbus-RTU Monitor

웹 기반 Modbus-RTU 시리얼 모니터 애플리케이션입니다. Web Serial API를 사용하여 브라우저에서 직접 시리얼 포트와 통신할 수 있습니다.

## 주요 기능

- 🔌 Web Serial API를 통한 시리얼 포트 연결
- 📊 실시간 Modbus-RTU 패킷 모니터링
- 🔍 패킷 파싱 및 분석
- 💾 데이터 내보내기 (CSV, JSON)
- 🌙 다크 테마 UI
- 📱 반응형 디자인

## 시스템 요구사항

- Chrome 89+, Edge 89+, 또는 Opera 75+ 브라우저
- Web Serial API 지원 필요

## 개발 환경 설정

1. 저장소 클론:
```bash
git clone https://github.com/yourusername/chrome_serial_mon.git
cd chrome_serial_mon
```

2. 개발 서버 실행:
```bash
node server.js
```

3. 브라우저에서 `http://localhost:3000` 접속

## 프로젝트 구조

```
chrome_serial_mon/
├── index.html              # 메인 HTML 파일
├── src/
│   ├── js/
│   │   ├── main.js        # 애플리케이션 진입점
│   │   └── modules/       # JavaScript 모듈
│   ├── css/
│   │   ├── bootstrap.min.css  # Bootstrap 5.3.0
│   │   └── styles.css         # 커스텀 스타일
│   └── assets/            # 이미지 및 기타 리소스
├── tests/                 # 테스트 파일
├── server.js             # 개발 서버
└── README.md            # 프로젝트 문서
```

## 사용 방법

1. "Select Serial Port" 버튼을 클릭하여 시리얼 포트 선택
2. 연결 설정 (Baud Rate, Data Bits 등) 구성
3. "Open Serial Port" 버튼을 클릭하여 연결
4. 실시간으로 Modbus-RTU 패킷 모니터링
5. 필요시 데이터 내보내기

## 기술 스택

- **Frontend**: 바닐라 JavaScript (ES6+)
- **UI Framework**: Bootstrap 5.3.0
- **API**: Web Serial API
- **Architecture**: 모듈 패턴

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
