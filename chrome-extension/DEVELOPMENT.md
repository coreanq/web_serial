# Chrome Extension Development Guide

이 문서는 Chrome Extension 개발 시 자동화된 워크플로우 사용법을 설명합니다.

## 🔥 Hot Reload 개발 환경

### 방법 1: Extension Development - Auto Reloader 사용 (권장)

**가장 효과적이고 안정적인 방법입니다!**

1. **Chrome Web Store에서 확장 설치**
   ```
   https://chrome.google.com/webstore/detail/extension-development-aut/falghmjeljhgmccbpffloemnfnmikked
   ```

2. **개발 서버 시작**
   ```bash
   # 루트 디렉토리에서
   bun run dev:extension
   
   # 또는 chrome-extension 디렉토리에서
   bun run dev:server
   ```

3. **확장 로드**
   - `chrome://extensions/` 접속
   - "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - `chrome-extension/dist/` 디렉토리 선택

4. **Auto Reloader 활성화**
   - Extension Development - Auto Reloader 확장 아이콘 클릭
   - "TURN ON"이 녹색으로 표시되면 활성화 완료
   - 파일 변경 시 자동으로 확장과 페이지가 리로드됩니다!

### 방법 2: 자동 빌드만 사용 (수동 리로드)

Auto Reloader 확장을 사용하지 않는 경우:

```bash
# chrome-extension 디렉토리에서
bun run dev
```

파일 변경 시 자동으로 빌드되지만, 확장은 수동으로 리로드해야 합니다.
- `chrome://extensions/`에서 "새로고침" 버튼 클릭

## 📁 프로젝트 구조

```
chrome-extension/
├── dist/               # 빌드된 확장 파일들 (Chrome에서 로드할 디렉토리)
├── scripts/            # 개발 도구 스크립트
├── templates/          # HTML 템플릿
├── icons/             # 확장 아이콘들
├── manifest.json      # 확장 매니페스트
├── vite.config.ts     # Vite 설정 (Hot Reload 플러그인 포함)
└── package.json       # 의존성 및 스크립트
```

## 🛠️ 개발 명령어

```bash
# 개발 서버 시작 (Hot Reload 포함)
bun run dev:server

# 개발 빌드 (Watch 모드)
bun run dev

# 프로덕션 빌드
bun run build

# 확장 패키징
bun run pack

# 빌드 정리
bun run clean

# 타입 체크
bun run typecheck

# 린팅
bun run lint
bun run lint:fix
```

## 🔄 개발 워크플로우

1. **개발 서버 시작**
   ```bash
   bun run dev:extension
   ```

2. **Chrome에서 확장 로드**
   - `chrome://extensions/`에서 `dist/` 디렉토리 로드

3. **코드 수정**
   - `../src/` 디렉토리의 파일들 수정
   - 저장 시 자동으로 빌드 및 리로드

4. **테스트**
   - 확장이 자동으로 업데이트됨
   - 브라우저 탭도 자동 새로고침 (설정에 따라)

## 🎯 Hot Reload 범위

다음 파일들의 변경사항이 자동으로 감지됩니다:

- `src/background.ts` → `dist/background.js`
- `src/popup.ts` → `dist/popup.js`
- `src/options.ts` → `dist/options.js`
- `manifest.json` → `dist/manifest.json`
- 모든 import된 TypeScript/CSS 파일들

## ⚡ 성능 팁

1. **개발 모드에서만 Hot Reload 활성화**
   - `NODE_ENV=development`일 때만 플러그인 로드
   - 프로덕션 빌드에는 영향 없음

2. **포트 설정**
   - WebSocket 포트: `9090` (변경 가능)
   - 다른 프로젝트와 충돌 시 `vite.config.ts`에서 변경

3. **선택적 리로드**
   - 페이지 리로드: `reloadPage: true`
   - 확장만 리로드: `reloadPage: false`

## 🐛 문제해결

### Hot Reload가 작동하지 않는 경우

1. **WebSocket 연결 확인**
   ```bash
   # 포트 9090이 사용 중인지 확인
   netstat -an | find "9090"
   ```

2. **확장 권한 확인**
   - 개발자 모드가 활성화되어 있는지
   - 확장이 올바른 디렉토리에서 로드되었는지

3. **빌드 에러 확인**
   ```bash
   bun run typecheck
   bun run lint
   ```

### Extension Development - Auto Reloader 문제

1. **WebSocket URL 확인**: `ws://localhost:9090`
2. **방화벽 설정 확인**
3. **확장 권한 확인**

## 📚 추가 리소스

- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Vite Plugin Documentation](https://vitejs.dev/guide/api-plugin.html)
- [WebSocket API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)