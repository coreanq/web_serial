# Chrome Web Store 프로모션 이미지 제작 가이드

Chrome Web Store에 필요한 프로모션 이미지들을 제작하기 위한 상세 가이드입니다.

## 필수 이미지 스펙

### 1. 작은 프로모션 타일 (Small Tile)
- **크기**: 440x280px
- **형식**: JPEG 또는 24비트 PNG (알파 채널 없음)
- **용도**: Chrome Web Store 검색 결과에서 표시

### 2. 마키 프로모션 타일 (Marquee)
- **크기**: 1400x560px  
- **형식**: JPEG 또는 24비트 PNG (알파 채널 없음)
- **용도**: Chrome Web Store 특집 섹션에서 표시

## 디자인 콘셉트

### 브랜딩 요소
- **제품명**: "Modbus Protocol Analyzer"
- **색상 테마**: 
  - 주색상: #1e40af (파란색 - 기술적 신뢰성)
  - 보조색상: #059669 (녹색 - 실시간 데이터)
  - 강조색상: #dc2626 (빨간색 - 경고/오류)
  - 배경색: #0f172a (다크 네이비 - 전문성)
- **폰트**: 모던하고 기술적인 Sans-serif (Roboto, Inter 추천)

### 핵심 메시지
1. **전문적인 Modbus 디버깅 도구**
2. **실시간 패킷 분석**
3. **RTU & TCP 지원**
4. **Chrome Extension**

## Small Tile (440x280) 디자인 가이드

```
┌─────────────────────────────────────────┐ 440px
│  🔧 Modbus Protocol Analyzer           │
│                                         │
│     📊 ◄──► 📱                          │
│    RTU      TCP                         │
│                                         │
│  ✓ Real-time Analysis                   │
│  ✓ Professional Debugging               │
│  ✓ Chrome Extension                     │
│                                         │
│           [Chrome Store Badge]          │
└─────────────────────────────────────────┘
                                       280px
```

### 레이아웃 요소
1. **상단 (60px)**: 제품명 + 아이콘
2. **중간 (120px)**: 핵심 기능 아이콘/일러스트
3. **하단 (100px)**: 주요 특징 3가지 + Chrome 배지

### 텍스트 내용
```
제목: "Modbus Protocol Analyzer"
부제: "Professional Chrome Extension"
특징:
- Real-time Packet Analysis
- RTU & TCP Support  
- Advanced Debugging Tools
```

## Marquee (1400x560) 디자인 가이드

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ 1400px
│  🔧 Modbus Protocol Analyzer                                                                      Chrome Extension          │
│  Professional Debugging Tool for Industrial Automation                                                                     │
│                                                                                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────────┐    ┌─────────────────────────────────────────────────────┐   │
│  │     RTU     │    │         Real-time Analysis           │    │              TCP Native                             │   │
│  │  📡 Serial  │    │    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │    │           🌐 Network                               │   │
│  │ Communication│    │    │ 01  │ │ 03  │ │ 06  │ │ 10  │    │    │         Communication                             │   │
│  │     Port    │    │    └─────┘ └─────┘ └─────┘ └─────┘    │    │                                                     │   │
│  └─────────────┘    │         Function Codes               │    └─────────────────────────────────────────────────────┘   │
│                     └──────────────────────────────────────┘                                                              │
│                                                                                                                             │
│  ✓ Multi-language Support (한국어/English)    ✓ Virtual Scrolling Logs    ✓ Advanced Command Generator                     │
│  ✓ IndexedDB Storage System                   ✓ Response Time Analysis    ✓ Export Multiple Formats                       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                          560px
```

### 레이아웃 구성
1. **헤더 (80px)**: 제품명 + 태그라인
2. **메인 영역 (320px)**: 3개 주요 기능 블록
3. **특징 영역 (160px)**: 6개 핵심 특징

## 제작 도구 추천

### 온라인 도구 (무료)
1. **Canva** - https://canva.com
   - 템플릿 풍부, 사용 쉬움
   - Chrome Extension 관련 템플릿 검색

2. **Figma** - https://figma.com
   - 전문적인 디자인 도구
   - 협업 및 버전 관리 가능

3. **Photopea** - https://photopea.com
   - 브라우저에서 Photoshop 기능
   - PSD 파일 지원

### 데스크톱 도구
1. **Adobe Photoshop/Illustrator**
2. **GIMP** (무료)
3. **Inkscape** (무료, 벡터)

## 아이콘 및 그래픽 리소스

### 아이콘 다운로드
```
추천 아이콘 라이브러리:
- Heroicons: https://heroicons.com/
- Lucide: https://lucide.dev/
- Tabler Icons: https://tabler-icons.io/
- Feather Icons: https://feathericons.com/
```

### 필요한 아이콘들
- 🔧 wrench (도구)
- 📊 bar-chart (분석)
- 📡 wifi/signal (통신)  
- 🌐 globe (네트워크)
- ⚡ bolt (실시간)
- 📱 device-mobile (장치)
- 🔍 magnifying-glass (분석)
- ✅ check-circle (기능 완료)

## 색상 팔레트

```css
/* 주 색상 */
--primary-blue: #1e40af;
--primary-green: #059669;
--primary-red: #dc2626;

/* 배경 */
--bg-dark: #0f172a;
--bg-gray: #1e293b;
--bg-light: #f8fafc;

/* 텍스트 */
--text-white: #ffffff;
--text-gray: #64748b;
--text-dark: #0f172a;

/* 그라데이션 */
--gradient-tech: linear-gradient(135deg, #1e40af 0%, #059669 100%);
--gradient-dark: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
```

## 텍스트 내용 (한국어/영어)

### Small Tile
```
영어:
- Modbus Protocol Analyzer
- Professional Chrome Extension
- Real-time Packet Analysis
- RTU & TCP Support

한국어:
- Modbus 프로토콜 분석기
- 전문 Chrome 확장 프로그램
- 실시간 패킷 분석
- RTU & TCP 지원
```

### Marquee
```
영어:
- Professional Debugging Tool for Industrial Automation
- Real-time Analysis & Advanced Logging
- Multi-language Support • Virtual Scrolling • Advanced Tools

한국어:
- 산업 자동화를 위한 전문 디버깅 도구
- 실시간 분석 및 고급 로깅
- 다국어 지원 • 가상 스크롤링 • 고급 도구
```

## 제작 체크리스트

### Small Tile (440x280)
- [ ] 크기 정확 (440x280px)
- [ ] 24비트 PNG 또는 JPEG
- [ ] 알파 채널 제거
- [ ] 제품명 명확히 표시
- [ ] Chrome Extension 표시
- [ ] 핵심 기능 3가지 포함
- [ ] 가독성 확인 (작은 크기에서도)

### Marquee (1400x560)
- [ ] 크기 정확 (1400x560px)
- [ ] 24비트 PNG 또는 JPEG
- [ ] 알파 채널 제거
- [ ] 상세한 기능 설명 포함
- [ ] 시각적 임팩트 강화
- [ ] 브랜딩 일관성 유지
- [ ] 고해상도에서 선명함

## 파일 저장 경로

```
chrome-extension/
└── promotional/
    ├── small-tile-440x280.png      # 작은 타일
    ├── marquee-1400x560.png        # 마키 타일
    ├── design-source/              # 원본 디자인 파일
    │   ├── small-tile.psd
    │   └── marquee.psd
    └── assets/                     # 디자인 에셋
        ├── icons/
        ├── fonts/
        └── colors.css
```

이 가이드를 참고하여 Canva나 Figma 같은 도구로 직접 제작하시거나, 디자이너에게 의뢰하실 수 있습니다!