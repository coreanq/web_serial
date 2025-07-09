export const ko = {
  // App Header
  app: {
    title: "Modbus 프로토콜 분석기",
    subtitle: "실시간 Modbus RTU/TCP 통신 모니터링 및 분석 도구"
  },

  // Common UI Elements
  common: {
    connect: "연결",
    disconnect: "연결 해제",
    send: "전송",
    clear: "지우기",
    export: "내보내기",
    import: "가져오기",
    save: "저장",
    cancel: "취소",
    ok: "확인",
    close: "닫기",
    yes: "예",
    no: "아니오",
    loading: "로딩 중...",
    error: "오류",
    warning: "경고",
    info: "정보",
    success: "성공",
    reset: "초기화",
    start: "시작",
    stop: "정지",
    pause: "일시정지",
    resume: "재개",
    enabled: "활성화",
    disabled: "비활성화",
    settings: "설정",
    language: "언어",
    theme: "테마",
    dark: "다크",
    light: "라이트"
  },

  // Panel Controls
  panel: {
    position: "패널 위치",
    top: "상단",
    left: "좌측",
    right: "우측", 
    hide: "패널 숨기기",
    show: "패널 보이기",
    visibility: "패널 표시",
    layout: "메인 레이아웃",
    commandLeft: "명령 창 좌측",
    commandRight: "명령 창 우측"
  },

  // Connection Panel
  connection: {
    title: "연결",
    connected: "연결됨",
    disconnected: "연결 안됨",
    connecting: "연결 중...",
    connectionError: "연결 오류",
    type: "연결 타입",
    
    // RTU Serial
    rtu: {
      title: "RTU (시리얼)",
      port: "시리얼 포트",
      selectPort: "포트 선택",
      noPortSelected: "포트가 선택되지 않음",
      baudRate: "보드레이트",
      parity: "패리티",
      dataBits: "데이터 비트",
      stopBits: "스톱 비트",
      none: "없음",
      even: "짝수",
      odd: "홀수"
    },

    // TCP Native
    tcp: {
      title: "TCP Native",
      host: "호스트",
      port: "포트",
      timeout: "타임아웃 (ms)",
      autoReconnect: "자동 재연결",
      reconnectInterval: "재연결 간격 (초)"
    },

    // Connection Messages
    messages: {
      selectPortFirst: "먼저 시리얼 포트를 선택해주세요",
      connectionFailed: "연결에 실패했습니다",
      connectionSuccess: "성공적으로 연결되었습니다",
      disconnectSuccess: "연결이 해제되었습니다",
      portNotAvailable: "선택한 포트를 사용할 수 없습니다",
      nativeHostNotAvailable: "Native messaging 호스트를 사용할 수 없습니다"
    },

    // Status Messages
    status: {
      nativeProxyConnected: "Native Proxy 연결됨",
      nativeProxyConnecting: "Native Proxy 연결 중...",
      nativeProxyFailed: "Native Proxy 연결 실패",
      nativeProxyDisconnected: "Native Proxy 연결 해제",
      tcpNativeConnected: "TCP Native 연결됨",
      tcpNativeConnecting: "TCP 장치 연결 중...",
      tcpNativeFailed: "TCP Native 연결 실패",
      tcpNativeDisconnected: "TCP Native 연결 해제",
      connectedTo: "연결됨:",
      connectingTo: "연결 중:",
      failedToConnect: "연결 실패:",
      lastAttempted: "마지막 시도:",
      noConnectionAttempted: "연결 시도 없음"
    },

    // Native Guide
    nativeGuide: {
      title: "Native TCP 설치 가이드",
      connected: "Native Host가 정상적으로 연결되었습니다!",
      notConnected: "Native Host 설치가 필요합니다",
      connectedDesc: "TCP Native 기능을 사용할 수 있습니다. 아래는 추가 설정 및 문제해결 방법입니다.",
      notConnectedDesc: "TCP Native 기능을 사용하려면 아래 단계를 따라 설치해주세요.",
      whyNeeded: "왜 별도 설치가 필요한가요?",
      browserSecurity: "브라우저 보안 제한: Chromium 기반 브라우저는 보안상 직접 TCP 연결을 할 수 없습니다.",
      webSerialVsTcp: "Web Serial vs TCP:",
      rtuSerial: "RTU (시리얼) → 브라우저 내장 Web Serial API 사용 ✅",
      tcpNative: "TCP Native → 외부 프로그램(Native Host) 필요 📦",
      nativeHostRole: "Native Host 역할: 확장과 TCP 장치 사이의 브리지 역할을 합니다.",
      supportedBrowsers: "지원 브라우저: Chrome, Edge, Brave, Opera, Vivaldi 등 모든 Chromium 기반 브라우저",
      simpleInstall: "간단 설치",
      step1: "OS별 설치 패키지 다운로드",
      step1Desc: "실행파일 + 설치스크립트가 포함된 압축파일",
      step2: "압축 해제 후 설치 실행",
      macosLinux: "macOS/Linux: 압축 해제 → ./install-*.sh",
      windows: "Windows: 압축 해제 → install-windows.bat 더블클릭",
      autoDetect: "💡 Extension ID 자동 감지, 모든 브라우저 자동 설치",
      step3: "브라우저 재시작",
      step3Desc: "사용 중인 브라우저를 완전히 종료 후 다시 실행하세요",
      extensionId: "현재 Extension ID",
      extensionIdDesc: "이 ID가 설치 스크립트에 자동으로 설정됩니다.",
      installationConfirm: "설치 완료 확인",
      installationConfirmDesc: "설치가 완료되면 위의 \"Native Proxy\" 상태가 \"🟢 Connected\"로 변경됩니다.",
      troubleshooting: "문제 해결",
      confirm: "확인",
      troubleshootingItems: [
        "실행파일에 실행 권한이 있는지 확인 (macOS/Linux)",
        "Windows에서 바이러스 검사기가 차단하지 않는지 확인",
        "Extension ID가 정확히 설정되었는지 확인",
        "브라우저를 완전히 재시작 (Chrome, Edge, Brave 등)",
        "다른 Chromium 기반 브라우저에서도 테스트해보기"
      ],
      clickToInstall: "클릭하여 설치 가이드 보기",
      clickToGuide: "클릭하여 설치/설정 가이드 보기",
      installGuide: "💡 설치하기",
      guideInfo: "ℹ️ 가이드",
      clickToInstallTooltip: "↑ 클릭하여 설치하세요!",
      reinstallTooltip: "↑ 재설치/문제해결",
      downloadManually: "다운로드 링크를 수동으로 열어주세요: ",
      troubleshootingTitle: "& 문제해결"
    }
  },

  // Log Panel
  log: {
    title: "통신 로그",
    count: "{{count}}개 로그",
    autoScroll: "자동 스크롤",
    clearLogs: "로그 지우기",
    exportLogs: "로그 내보내기",
    logSettings: "로그 설정",
    filter: "필터",
    search: "검색",
    
    // Log Entry
    timestamp: "시간",
    direction: "방향",
    data: "데이터",
    send: "송신",
    recv: "수신",
    error: "오류",
    responseTime: "응답 시간",
    
    // Export Options
    export: {
      title: "로그 데이터 내보내기",
      format: "형식",
      json: "JSON",
      csv: "CSV",
      txt: "텍스트",
      dateRange: "날짜 범위",
      allLogs: "모든 로그",
      customRange: "사용자 지정 범위",
      from: "시작",
      to: "끝"
    },

    // Log Settings
    settings: {
      title: "로그 관리 설정",
      memoryManagement: "메모리 관리",
      bufferSize: "버퍼 크기",
      segmentSize: "세그먼트 크기",
      autoExport: "자동 내보내기",
      exportThreshold: "내보내기 임계값 (%)",
      statistics: "메모리 통계",
      memoryLogs: "메모리 로그",
      totalLogs: "전체 로그",
      exportedFiles: "내보낸 파일",
      memoryUsage: "메모리 사용량",
      bufferUtilization: "버퍼 사용률",
      indexedDBLogs: "IndexedDB 로그",
      indexedDBSize: "IndexedDB 크기",
      memoryEfficiency: "메모리 효율성",
      allocatedSegments: "할당된 세그먼트",
      cleanup: "메모리 정리",
      reset: "모든 설정 초기화",
      bufferSizeDesc: "메모리에 보관할 최대 로그 수 (초과시 파일로 저장)",
      exportFormatDesc: "오버플로우 시 저장될 파일 형식",
      circularBufferInfo: "순환 버퍼 + IndexedDB 저장",
      circularBufferDesc: "설정한 버퍼 크기만큼 메모리에 보관하고, 초과된 로그는 즉시 IndexedDB에 저장됩니다.",
      indexedDBInfo: "IndexedDB 오버플로우 저장",
      indexedDBDesc: "메모리 버퍼를 초과한 로그는 자동으로 IndexedDB에 저장됩니다. 전체 로그 저장 시 IndexedDB가 초기화됩니다.",
      actions: "작업",
      clearAllLogsWithDB: "전체 로그 지우기 (DB 포함)",
      settingsSaved: "설정이 저장되었습니다!",
      settingsSaveError: "설정 저장 중 오류가 발생했습니다.",
      memoryLogsSaved: "메모리 로그가 성공적으로 저장되었습니다!",
      memoryLogsSaveError: "메모리 로그 저장 중 오류가 발생했습니다.",
      allLogsSaved: "전체 로그가 성공적으로 저장되고 IndexedDB가 초기화되었습니다!",
      allLogsSaveError: "전체 로그 저장 중 오류가 발생했습니다.",
      confirmClearMemory: "메모리 로그를 삭제하시겠습니까? IndexedDB 로그는 유지됩니다.",
      memoryLogsCleared: "메모리 로그가 삭제되었습니다.",
      memoryClearError: "메모리 로그 삭제 중 오류가 발생했습니다.",
      confirmClearAll: "모든 로그를 삭제하시겠습니까? (메모리 + IndexedDB) 이 작업은 되돌릴 수 없습니다.",
      allLogsCleared: "모든 로그가 삭제되었습니다.",
      allClearError: "로그 삭제 중 오류가 발생했습니다."
    },

    // Virtual Scrolling
    virtualScroll: {
      enabled: "성능 향상을 위해 가상 스크롤링이 활성화되었습니다",
      disabled: "가상 스크롤링이 비활성화되었습니다"
    }
  },

  // Command Panel
  command: {
    title: "명령 패널",
    
    // Modbus Generator
    generator: {
      title: "Modbus 명령 생성기",
      slaveId: "슬레이브 ID",
      functionCode: "펑션 코드",
      startAddress: "시작 주소",
      quantity: "수량",
      hexBaseMode: "HEX 베이스 모드",
      generateCommand: "명령 생성",
      addToHistory: "히스토리에 추가"
    },

    // Function Codes
    functionCodes: {
      "01": "01 - 코일 읽기",
      "02": "02 - 이산 입력 읽기",
      "03": "03 - 홀딩 레지스터 읽기",
      "04": "04 - 입력 레지스터 읽기",
      "05": "05 - 단일 코일 쓰기",
      "06": "06 - 단일 레지스터 쓰기",
      "0F": "0F - 다중 코일 쓰기",
      "10": "10 - 다중 레지스터 쓰기"
    },

    // Manual Command
    manual: {
      title: "수동 명령",
      input: "HEX 데이터 또는 텍스트 입력",
      asciiMode: "ASCII 모드",
      autoCrc: "자동 CRC",
      preview: "미리보기",
      invalidHex: "잘못된 HEX 형식",
      enterData: "위에 {{mode}} 데이터를 입력하세요...",
      hexData: "HEX",
      textData: "텍스트"
    },

    // Command History
    history: {
      title: "최근 명령",
      empty: "최근 명령이 없습니다",
      remove: "제거",
      repeat: "반복",
      clear: "히스토리 지우기"
    },

    // Repeat Mode
    repeat: {
      title: "반복 모드",
      interval: "간격 (ms)",
      selectCommands: "반복할 명령 선택",
      minInterval: "최소 간격: 10ms",
      noCommandsSelected: "주기적 전송을 위해 최소 하나의 명령을 선택해주세요"
    },

    // Data Values
    dataValues: {
      title: "데이터 값",
      coil: "코일",
      register: "레지스터",
      add: "값 추가",
      remove: "제거"
    },

    // Messages
    messages: {
      commandSent: "명령이 성공적으로 전송되었습니다",
      commandFailed: "명령 전송에 실패했습니다",
      invalidCommand: "잘못된 명령 형식입니다",
      notConnected: "연결되지 않았습니다",
      validCoilValues: "펑션 코드 0F에 대한 유효한 코일 값을 입력해주세요",
      validRegisterValues: "펑션 코드 10에 대한 유효한 레지스터 값을 입력해주세요",
      atLeastOneValue: "{{functionCode}}에는 최소 하나의 {{type}}이 필요합니다",
      coil: "코일",
      register: "레지스터"
    }
  },

  // Modbus Protocol
  modbus: {
    analysis: "Modbus 프로토콜 분석",
    rtu: "RTU",
    tcp: "TCP",
    pdu: "PDU", 
    mbap: "MBAP 헤더",
    crc: "CRC",
    slaveId: "슬레이브 ID",
    functionCode: "펑션 코드",
    address: "주소",
    quantity: "수량",
    data: "데이터",
    byteCount: "바이트 수",
    coilStatus: "코일 상태",
    registerValue: "레지스터 값",
    
    // Protocol Info
    protocol: {
      tcpPdu: "MODBUS TCP PDU (MBAP 헤더로 래핑됨)",
      crcAdded: "+CRC: 총 {{bytes}}바이트",
      mbapAdded: "+MBAP: 총 {{bytes}}바이트"
    },

    // Error Codes
    errors: {
      "01": "잘못된 펑션",
      "02": "잘못된 데이터 주소",
      "03": "잘못된 데이터 값",
      "04": "슬레이브 장치 오류",
      "05": "확인",
      "06": "슬레이브 장치 사용 중",
      "08": "메모리 패리티 오류",
      "0A": "게이트웨이 경로 사용 불가",
      "0B": "게이트웨이 대상 장치 응답 실패"
    }
  },

  // Error Messages
  errors: {
    general: "예상치 못한 오류가 발생했습니다",
    network: "네트워크 연결 오류",
    timeout: "작업 시간 초과",
    invalidInput: "잘못된 입력",
    fileNotFound: "파일을 찾을 수 없습니다",
    permissionDenied: "권한이 거부되었습니다",
    serialPortBusy: "시리얼 포트가 사용 중입니다",
    serialPortNotFound: "시리얼 포트를 찾을 수 없습니다",
    nativeHostError: "Native messaging 호스트 오류",
    unknownError: "알 수 없는 오류가 발생했습니다"
  }
};