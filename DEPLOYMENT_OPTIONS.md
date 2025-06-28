# TCP 프록시 서버 배포 옵션

Private 저장소에서 공개 배포를 위한 여러 방안을 정리했습니다.

## 🎯 권장 방안: 별도 Public 저장소

### 1. 새 Public 저장소 생성
```bash
# 예시 저장소명
modbus-websocket-proxy
```

### 2. 프록시 서버 코드만 복사
```bash
# websocket-server 디렉토리 내용을 새 저장소로 복사
cp -r websocket-server/* /path/to/modbus-websocket-proxy/
```

### 3. 새 저장소 구조
```
modbus-websocket-proxy/
├── .github/workflows/release.yml
├── README.md
├── package.json
├── server.js
├── build.sh
├── build.bat
└── TCP_SETUP_GUIDE.md
```

### 4. 대시보드에서 참조
```javascript
// ConnectionPanel.ts에서 사용할 public 저장소 URL
const PROXY_RELEASES_URL = 'https://github.com/your-username/modbus-websocket-proxy/releases';
```

## 🔄 대안 방안들

### 방안 2: 클라우드 스토리지 호스팅

**AWS S3, Google Cloud Storage, Azure Blob 등 사용**

장점:
- 완전한 제어권
- 사용자 정의 다운로드 페이지 가능
- 다운로드 통계 수집 가능

단점:
- 비용 발생
- 인프라 관리 필요

### 방안 3: CDN 서비스 활용

**GitHub Pages, Netlify, Vercel 등에 호스팅**

장점:
- 무료 또는 저렴한 비용
- 전 세계 CDN 지원
- 자동 HTTPS

단점:
- 파일 크기 제한 가능
- 바이너리 파일 제한 가능

### 방안 4: 직접 빌드 안내

**사용자가 직접 빌드하도록 안내**

장점:
- 배포 인프라 불필요
- 최신 코드 보장

단점:
- 사용자 진입 장벽 높음
- Node.js 환경 필요

## 💡 권장 구현 방법

1. **별도 Public 저장소 생성**
   ```bash
   # 1. 새 저장소 생성
   gh repo create modbus-websocket-proxy --public
   
   # 2. 프록시 서버 코드 복사
   cp -r websocket-server/* ../modbus-websocket-proxy/
   
   # 3. GitHub Actions 워크플로우 설정
   cp .github/workflows/release.yml ../modbus-websocket-proxy/.github/workflows/
   
   # 4. 첫 릴리즈 생성
   cd ../modbus-websocket-proxy
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **대시보드 링크 업데이트**
   ```javascript
   // 프록시 가이드 모달에서 사용할 URL
   const DOWNLOAD_URL = 'https://github.com/your-username/modbus-websocket-proxy/releases/latest';
   const GUIDE_URL = 'https://github.com/your-username/modbus-websocket-proxy/blob/main/TCP_SETUP_GUIDE.md';
   ```

3. **문서 동기화**
   - TCP_SETUP_GUIDE.md를 두 저장소에서 동기화
   - 메인 저장소에서 수정 시 public 저장소로 복사

## 🔒 보안 고려사항

- Public 저장소에는 민감한 정보 포함 금지
- 프록시 서버 코드만 포함 (웹 앱 코드 제외)
- 적절한 라이선스 표시
- README에 보안 사용 지침 포함

이 방법으로 private 메인 저장소는 유지하면서, 프록시 서버만 공개적으로 배포할 수 있습니다.