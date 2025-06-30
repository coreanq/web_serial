// Web Serial API types
export interface SerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

export interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

declare global {
  interface Navigator {
    serial: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
      addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
      removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
    };
  }
}

// Connection types
export interface SerialConfig {
  port?: SerialPort;
  portName?: string;
  baudRate: number;
  parity: 'none' | 'even' | 'odd';
  dataBits: number;
  stopBits: number;
}

export interface TcpConfig {
  host: string;
  port: number;
}

export type ConnectionType = 'RTU' | 'TCP_NATIVE';

export interface ConnectionConfig {
  type: ConnectionType;
  serial?: SerialConfig;
  tcp?: TcpConfig;
}

// Communication log types
export interface LogEntry {
  id: string;
  timestamp: Date;
  direction: 'send' | 'recv';
  data: string;
  parsed?: ModbusFrame;
  error?: string;
  responseTime?: number;
}

// Modbus protocol types
export interface ModbusFrame {
  slaveId: number;
  functionCode: number;
  data: number[];
  crc?: number;
  isValid: boolean;
  description?: string;
}

// Log storage configuration types
export type LogStorageMode = 'continuous' | 'rotation';

export interface LogStorageConfig {
  mode: LogStorageMode;
  // Continuous mode settings
  continuous?: {
    maxFileSize: number; // MB - when to create new file
    fileNameFormat: string; // timestamp format for file names
  };
  // Rotation mode settings
  rotation?: {
    maxFileSize: number; // MB
    maxFiles: number; // number of files to keep
    maxAge: number; // days to keep files
    compressionEnabled: boolean;
  };
}

// Application state types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AppState {
  connectionStatus: ConnectionStatus;
  connectionConfig: ConnectionConfig;
  logs: LogEntry[];
  isAutoScroll: boolean;
  filter: LogFilter;
}

export interface LogFilter {
  direction?: 'send' | 'recv';
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// UI Panel types
export interface PanelProps {
  className?: string;
  children?: HTMLElement | HTMLElement[];
}

export interface TabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: (id: string) => void;
}