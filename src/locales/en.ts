export const en = {
  // App Header
  app: {
    title: "Modbus Protocol Analyzer",
    subtitle: "Real-time Modbus RTU/TCP communication monitoring and analysis tool"
  },

  // Common UI Elements
  common: {
    connect: "Connect",
    disconnect: "Disconnect",
    send: "Send",
    clear: "Clear",
    export: "Export",
    import: "Import",
    save: "Save",
    cancel: "Cancel",
    ok: "OK",
    close: "Close",
    yes: "Yes",
    no: "No",
    loading: "Loading...",
    error: "Error",
    warning: "Warning",
    info: "Information",
    success: "Success",
    reset: "Reset",
    start: "Start",
    stop: "Stop",
    pause: "Pause",
    resume: "Resume",
    enabled: "Enabled",
    disabled: "Disabled",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light"
  },

  // Panel Controls
  panel: {
    position: "Panel Position",
    top: "Top",
    left: "Left", 
    right: "Right",
    hide: "Hide Panel",
    show: "Show Panel",
    visibility: "Panel Visibility",
    layout: "Main Layout",
    commandLeft: "Command Left",
    commandRight: "Command Right"
  },

  // Connection Panel
  connection: {
    title: "Connection",
    connected: "Connected",
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connectionError: "Connection Error",
    type: "Connection Type",
    
    // RTU Serial
    rtu: {
      title: "RTU (Serial)",
      port: "Select Port",
      selectPort: "Select Port",
      noPortSelected: "No port selected",
      baudRate: "Baud Rate",
      parity: "Parity",
      dataBits: "Data Bits",
      stopBits: "Stop Bits",
      none: "None",
      even: "Even",
      odd: "Odd"
    },

    // TCP Native
    tcp: {
      title: "TCP",
      host: "Host",
      port: "Port",
      timeout: "Timeout (ms)",
      autoReconnect: "Auto Reconnect",
      reconnectInterval: "Reconnect Interval (s)"
    },

    // Connection Messages
    messages: {
      selectPortFirst: "Please select a serial port first",
      connectionFailed: "Connection failed",
      connectionSuccess: "Connected successfully",
      disconnectSuccess: "Disconnected successfully",
      portNotAvailable: "Selected port is not available",
      nativeHostNotAvailable: "Native messaging host not available"
    },

    // Status Messages
    status: {
      nativeProxyConnected: "Native Proxy Connected",
      nativeProxyConnecting: "Connecting to Native Proxy...",
      nativeProxyFailed: "Native Proxy Connection Failed",
      nativeProxyDisconnected: "Native Proxy Disconnected",
      tcpNativeConnected: "TCP Connected",
      tcpNativeConnecting: "TCP Connecting...",
      tcpNativeFailed: "TCP Connection Failed",
      tcpNativeDisconnected: "TCP Disconnected",
      connectedTo: "Connected to:",
      connectingTo: "Connecting to:",
      failedToConnect: "Failed to connect to:",
      lastAttempted: "Last attempted:",
      noConnectionAttempted: "No connection attempted"
    },

    // Native Guide
    nativeGuide: {
      title: "Native TCP Setup Guide",
      connected: "Native Host is connected successfully!",
      notConnected: "Native Host installation required",
      connectedDesc: "TCP feature is available. Below are additional setup and troubleshooting methods.",
      notConnectedDesc: "Please follow the steps below to use TCP feature.",
      whyNeeded: "Why is separate installation needed?",
      browserSecurity: "Browser Security Limitation: Chromium-based browsers cannot make direct TCP connections for security reasons.",
      webSerialVsTcp: "Web Serial vs TCP:",
      rtuSerial: "RTU (Serial) → Uses built-in Web Serial API ✅",
      tcpNative: "TCP → Requires external program (Native Host) 📦",
      nativeHostRole: "Native Host Role: Acts as a bridge between extension and TCP devices.",
      supportedBrowsers: "Supported Browsers: All Chromium-based browsers including Chrome, Edge, Brave, Opera, Vivaldi",
      simpleInstall: "Simple Installation",
      step1: "Download OS-specific installation package",
      step1Desc: "Compressed file containing executable + installation script",
      step2: "Extract and run installation",
      macosLinux: "macOS/Linux: Extract → ./install-*.sh",
      windows: "Windows: Extract → double-click install-windows.bat",
      autoDetect: "💡 Auto-detects Extension ID, auto-installs for all browsers",
      step3: "Restart Browser",
      step3Desc: "Completely close and restart your browser",
      extensionId: "Current Extension ID",
      extensionIdDesc: "This ID will be automatically configured in the installation script.",
      installationConfirm: "Installation Verification",
      installationConfirmDesc: "Once installation is complete, the \"Native Proxy\" status above will change to \"🟢 Connected\".",
      troubleshooting: "Troubleshooting",
      confirm: "OK",
      troubleshootingItems: [
        "Check if executable has execution permissions (macOS/Linux)",
        "Verify Windows antivirus is not blocking the file",
        "Confirm Extension ID is correctly configured",
        "Completely restart browser (Chrome, Edge, Brave, etc.)",
        "Test with other Chromium-based browsers"
      ],
      clickToInstall: "Click to view installation guide",
      clickToGuide: "Click to view installation/setup guide",
      installGuide: "💡 Install",
      guideInfo: "ℹ️ Guide",
      clickToInstallTooltip: "↑ Click to install!",
      reinstallTooltip: "↑ Reinstall/troubleshoot",
      downloadManually: "Please open the download link manually: ",
      troubleshootingTitle: "& Troubleshooting"
    }
  },

  // Log Panel
  log: {
    title: "Communication Log",
    count: "{{count}} logs",
    autoScroll: "Auto Scroll",
    clearLogs: "Clear Logs",
    exportLogs: "Export Logs",
    logSettings: "Log Settings",
    filter: "Filter",
    search: "Search",
    
    // Log Entry
    timestamp: "Timestamp",
    direction: "Direction",
    data: "Data",
    send: "SEND",
    recv: "RECV",
    error: "Error",
    responseTime: "Response Time",
    
    // Export Options
    export: {
      title: "Export Log Data",
      format: "Format",
      json: "JSON",
      csv: "CSV", 
      txt: "Text",
      dateRange: "Date Range",
      allLogs: "All Logs",
      customRange: "Custom Range",
      from: "From",
      to: "To"
    },

    // Log Settings
    settings: {
      title: "Log Management Settings",
      memoryManagement: "Memory Management",
      bufferSize: "Buffer Size",
      segmentSize: "Segment Size",
      autoExport: "Auto Export",
      exportThreshold: "Export Threshold (%)",
      statistics: "Memory Statistics",
      memoryLogs: "Memory Logs",
      totalLogs: "Total Logs", 
      exportedFiles: "Exported Files",
      memoryUsage: "Memory Usage",
      bufferUtilization: "Buffer Utilization",
      indexedDBLogs: "IndexedDB Logs",
      indexedDBSize: "IndexedDB Size",
      memoryEfficiency: "Memory Efficiency",
      allocatedSegments: "Allocated Segments",
      cleanup: "Cleanup Memory",
      reset: "Reset All Settings",
      bufferSizeDesc: "Maximum number of logs to keep in memory (overflow saved to file)",
      exportFormatDesc: "File format for overflow logs",
      circularBufferInfo: "Circular Buffer + IndexedDB Storage",
      circularBufferDesc: "Keeps logs in memory up to buffer size, excess logs are automatically saved to IndexedDB.",
      indexedDBInfo: "IndexedDB Overflow Storage",
      indexedDBDesc: "Logs exceeding memory buffer are automatically saved to IndexedDB. IndexedDB is cleared when saving all logs.",
      actions: "Actions",
      clearAllLogsWithDB: "Clear All Logs (Including DB)",
      settingsSaved: "Settings saved successfully!",
      settingsSaveError: "Error occurred while saving settings.",
      memoryLogsSaved: "Memory logs saved successfully!",
      memoryLogsSaveError: "Error occurred while saving memory logs.",
      allLogsSaved: "All logs saved successfully and IndexedDB cleared!",
      allLogsSaveError: "Error occurred while saving all logs.",
      confirmClearMemory: "Are you sure you want to delete memory logs? IndexedDB logs will be preserved.",
      memoryLogsCleared: "Memory logs cleared.",
      memoryClearError: "Error occurred while clearing memory logs.",
      confirmClearAll: "Are you sure you want to delete all logs? (Memory + IndexedDB) This action cannot be undone.",
      allLogsCleared: "All logs cleared.",
      allClearError: "Error occurred while clearing logs."
    },

    // Virtual Scrolling
    virtualScroll: {
      enabled: "Virtual scrolling enabled for better performance",
      disabled: "Virtual scrolling disabled"
    }
  },

  // Command Panel
  command: {
    title: "Command Panel",
    
    // Modbus Generator
    generator: {
      title: "Modbus Command Generator",
      slaveId: "Slave ID",
      functionCode: "Function Code",
      startAddress: "Start Address", 
      quantity: "Quantity",
      hexBaseMode: "HEX?",
      buildCommand: "Build Command",
      sendCommand: "Send Command"
    },

    // Function Codes
    functionCodes: {
      "01": "01 - Read Coils",
      "02": "02 - Read Discrete Inputs", 
      "03": "03 - Read Holding Registers",
      "04": "04 - Read Input Registers",
      "05": "05 - Write Single Coil",
      "06": "06 - Write Single Register",
      "0F": "0F - Write Multiple Coils",
      "10": "10 - Write Multiple Registers"
    },

    // Manual Command
    manual: {
      title: "Manual Command",
      input: "HEX String or text",
      asciiMode: "ASCII?",
      autoCrc: "Auto CRC",
      preview: "Preview",
      invalidHex: "Invalid HEX format",
      enterData: "Enter {{mode}} data above...",
      hexData: "HEX",
      textData: "text"
    },

    // Command History
    history: {
      title: "Recent",
      empty: "No recent commands",
      remove: "Remove",
      repeat: "Repeat",
      clear: "Clear History"
    },

    // Repeat Mode
    repeat: {
      title: "Repeat",
      interval: "Interval (ms)",
      selectCommands: "Select commands to repeat",
      minInterval: "Minimum interval: 10ms",
      noCommandsSelected: "Please check at least one command for periodic sending"
    },

    // Data Values
    dataValues: {
      title: "Data Values",
      coil: "Coil",
      register: "Reg",
      add: "Add Value",
      remove: "Remove"
    },

    // Messages
    messages: {
      commandSent: "Command sent successfully",
      commandFailed: "Failed to send command",
      invalidCommand: "Invalid command format",
      notConnected: "Not connected",
      validCoilValues: "Please enter valid coil values for Function Code 0F",
      validRegisterValues: "Please enter valid register values for Function Code 10",
      atLeastOneValue: "At least one {{type}} is required for {{functionCode}}",
      coil: "coil",
      register: "register"
    }
  },

  // Modbus Protocol
  modbus: {
    analysis: "Modbus Protocol Analysis",
    rtu: "RTU",
    tcp: "TCP", 
    pdu: "PDU",
    mbap: "MBAP Header",
    crc: "CRC",
    slaveId: "Slave ID",
    functionCode: "Function Code",
    address: "Address",
    quantity: "Quantity",
    data: "Data",
    byteCount: "Byte Count",
    coilStatus: "Coil Status",
    registerValue: "Register Value",
    
    // Protocol Info
    protocol: {
      tcpPdu: "MODBUS TCP PDU (will be wrapped in MBAP header)",
      crcAdded: "+CRC: {{bytes}} bytes total",
      mbapAdded: "+MBAP: {{bytes}} bytes total"
    },

    // Error Codes
    errors: {
      "01": "Illegal Function",
      "02": "Illegal Data Address", 
      "03": "Illegal Data Value",
      "04": "Slave Device Failure",
      "05": "Acknowledge",
      "06": "Slave Device Busy",
      "08": "Memory Parity Error",
      "0A": "Gateway Path Unavailable",
      "0B": "Gateway Target Device Failed to Respond"
    }
  },

  // Error Messages
  errors: {
    general: "An unexpected error occurred",
    network: "Network connection error",
    timeout: "Operation timed out",
    invalidInput: "Invalid input",
    fileNotFound: "File not found",
    permissionDenied: "Permission denied",
    serialPortBusy: "Serial port is busy",
    serialPortNotFound: "Serial port not found",
    nativeHostError: "Native messaging host error",
    unknownError: "Unknown error occurred"
  }
};