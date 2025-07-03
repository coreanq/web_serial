import { LogEntry } from '../types';
import { SimpleCircularBuffer } from './SimpleCircularBuffer';

export interface LogBufferConfig {
  // CircularBuffer 설정
  bufferSize: number;           // 메모리 버퍼 크기 (기본: 1000)
  
  // 파일 저장 설정
  exportFormat: 'json' | 'csv' | 'txt';  // 파일 형식
}

export class OptimizedLogService {
  private buffer: SimpleCircularBuffer;
  private config: LogBufferConfig;
  private exportedFileCount: number = 0;
  private overflowQueue: LogEntry[] = [];      // 오버플로우된 로그들을 1초마다 저장
  private autoSaveTimer: NodeJS.Timeout | null = null;  // 1초 타이머
  private onLogEvicted?: (log: LogEntry) => void; // Object Pool 콜백

  constructor(config?: Partial<LogBufferConfig>, onLogEvicted?: (log: LogEntry) => void) {
    this.config = {
      bufferSize: 10000,
      exportFormat: 'json',
      ...config
    };

    this.buffer = new SimpleCircularBuffer(this.config.bufferSize);
    this.onLogEvicted = onLogEvicted;
    this.loadSettings();
    this.startAutoSaveTimer();
  }

  // 설정 로드/저장
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('modbus-log-config');
      if (saved) {
        const savedConfig = JSON.parse(saved);
        this.config = { ...this.config, ...savedConfig };
        
        // 버퍼 크기가 변경된 경우 재할당
        this.buffer.resize(this.config.bufferSize);
      }
    } catch (error) {
      console.warn('Failed to load log settings:', error);
    }
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('modbus-log-config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save log settings:', error);
    }
  }

  // 설정 업데이트
  public updateConfig(newConfig: Partial<LogBufferConfig>): void {
    const oldBufferSize = this.config.bufferSize;
    
    this.config = { ...this.config, ...newConfig };
    
    // Always keep pendingQueueSize same as bufferSize
    this.config.pendingQueueSize = this.config.bufferSize;
    
    // 버퍼 크기 변경 시 적용
    if (newConfig.bufferSize && newConfig.bufferSize !== oldBufferSize) {
      this.buffer.resize(newConfig.bufferSize);
    }
    
    this.saveSettings();
  }

  public getConfig(): LogBufferConfig {
    return { ...this.config };
  }

  // 로그 추가
  public async addLog(log: LogEntry): Promise<void> {
    // SimpleCircularBuffer에 로그 추가
    const evictedLog = this.buffer.add(log);
    
    // 제거된 로그가 있는 경우 처리
    if (evictedLog) {
      // Object Pool로 반환 (우선순위)
      if (this.onLogEvicted) {
        this.onLogEvicted(evictedLog);
      }
      
      // 오버플로우 큐에 추가 (1초마다 파일에 저장)
      this.overflowQueue.push(evictedLog);
    }
  }

  // 1초마다 오버플로우 로그를 파일에 저장하는 타이머 시작
  private startAutoSaveTimer(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveOverflowLogs();
    }, 1000); // 1초마다 실행
  }

  // 오버플로우 로그들을 파일에 append
  private async saveOverflowLogs(): Promise<void> {
    if (this.overflowQueue.length === 0) return;

    try {
      // 현재 오버플로우 큐의 모든 로그를 가져와서 클리어
      const logsToSave = [...this.overflowQueue];
      this.overflowQueue = [];

      // 고정된 파일명으로 append
      const filename = 'modbus_logs_continuous';
      await this.appendToFile(logsToSave, filename);
      
      this.exportedFileCount++;
    } catch (error) {
      console.error('Failed to save overflow logs:', error);
      // 실패한 경우 다시 큐에 추가
      this.overflowQueue.unshift(...this.overflowQueue);
    }
  }

  // 파일에 append하는 메서드 (기존 파일에 계속 추가)
  private async appendToFile(logs: LogEntry[], filename: string): Promise<void> {
    let content: string;
    let mimeType: string;
    let fileExtension: string;

    switch (this.config.exportFormat) {
      case 'csv':
        content = this.logsToCSV(logs);
        mimeType = 'text/csv';
        fileExtension = '.csv';
        break;
      
      case 'txt':
        content = this.logsToText(logs);
        mimeType = 'text/plain';
        fileExtension = '.txt';
        break;
      
      case 'json':
      default:
        // JSON은 배열 형태로 저장 (append하기 어려우므로 개별 JSON 라인으로)
        content = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
        mimeType = 'application/json';
        fileExtension = '.jsonl'; // JSON Lines 형식
        break;
    }

    // 현재 시간을 포함한 고유 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fullFilename = `${filename}_${timestamp}${fileExtension}`;

    // 브라우저에서 파일 다운로드 (append 기능 대신 새 파일 생성)
    this.downloadFile(content, fullFilename, mimeType);
  }

  // 모든 로그 가져오기
  public getAllLogs(): LogEntry[] {
    return this.buffer.getAllLogs();
  }

  // 최신 로그들 가져오기
  public getRecentLogs(count?: number): LogEntry[] {
    if (!count) {
      return this.buffer.getAllLogs();
    }
    return this.buffer.getRecentLogs(count);
  }

  // 범위로 로그 가져오기 (Virtual Scrolling용)
  public getLogsInRange(startIndex: number, count: number): LogEntry[] {
    return this.buffer.getLogsInRange(startIndex, count);
  }

  // 전체 로그 수 반환 (메모리 + 파일로 저장된 것)
  public getTotalCount(): number {
    const bufferStats = this.buffer.getStats();
    return bufferStats.totalCount + (this.exportedFileCount * this.config.batchSize);
  }

  // 현재 메모리 로그 수 반환
  public getMemoryCount(): number {
    return this.buffer.getStats().size;
  }


  // 수동 파일 저장 (현재 메모리의 모든 로그)
  public async exportAllLogs(filename?: string): Promise<void> {
    const allLogs = this.buffer.getAllLogs();
    if (allLogs.length === 0) {
      throw new Error('No logs to export');
    }

    const exportFilename = filename || `modbus_logs_manual_${this.formatTimestamp(new Date())}`;
    await this.exportToFile(allLogs, exportFilename);
  }

  // 파일로 저장 (브라우저 다운로드)
  private async exportToFile(logs: LogEntry[], filename: string): Promise<void> {
    let content: string;
    let mimeType: string;
    let fileExtension: string;

    switch (this.config.exportFormat) {
      case 'csv':
        content = this.logsToCSV(logs);
        mimeType = 'text/csv';
        fileExtension = '.csv';
        break;
      
      case 'txt':
        content = this.logsToText(logs);
        mimeType = 'text/plain';
        fileExtension = '.txt';
        break;
      
      case 'json':
      default:
        content = JSON.stringify(logs, null, 2);
        mimeType = 'application/json';
        fileExtension = '.json';
        break;
    }

    // 압축이 활성화된 경우
    if (this.config.compressionEnabled) {
      content = this.compressContent(content);
      mimeType = 'application/gzip';
      fileExtension = fileExtension + '.gz';
    }

    // 브라우저에서 파일 다운로드
    this.downloadFile(content, filename + fileExtension, mimeType);
  }

  // CSV 형식으로 변환
  private logsToCSV(logs: LogEntry[]): string {
    const headers = ['Timestamp', 'Direction', 'Data', 'Type', 'Function', 'Address', 'Count', 'Values'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.direction,
      log.data,
      log.analysis?.type || '',
      log.analysis?.function || '',
      log.analysis?.address?.toString() || '',
      log.analysis?.count?.toString() || '',
      log.analysis?.values ? JSON.stringify(log.analysis.values) : ''
    ]);

    return [headers, ...rows].map(row => 
      row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  // 텍스트 형식으로 변환
  private logsToText(logs: LogEntry[]): string {
    return logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const direction = log.direction.toUpperCase();
      const analysis = log.analysis ? 
        `[${log.analysis.type}] Function: ${log.analysis.function}, Address: ${log.analysis.address}` :
        '';
      
      return `${timestamp} ${direction}: ${log.data} ${analysis}`;
    }).join('\n');
  }

  // 간단한 압축 (실제 환경에서는 pako 라이브러리 사용 권장)
  private compressContent(content: string): string {
    // 여기서는 간단한 예시, 실제로는 gzip 압축 라이브러리 사용
    return content; // TODO: 실제 압축 구현
  }

  // 파일 다운로드
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // 타임스탬프 포맷
  private formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  // 로그 통계
  public getStats(): {
    memoryLogs: number;
    totalLogs: number;
    exportedFiles: number;
    memoryUsage: string;
    bufferUtilization: string;
    pendingOverflow: number;
  } {
    const bufferStats = this.buffer.getStats();
    const allLogs = this.buffer.getAllLogs();
    const memoryUsage = (JSON.stringify(allLogs).length / 1024 / 1024).toFixed(2);
    
    return {
      memoryLogs: bufferStats.size || 0,
      totalLogs: bufferStats.totalCount || 0,
      exportedFiles: this.exportedFileCount || 0,
      memoryUsage: `${memoryUsage} MB`,
      bufferUtilization: `${(bufferStats.size / bufferStats.capacity * 100).toFixed(1)}%`,
      pendingOverflow: this.overflowQueue?.length || 0
    };
  }

  // 상세 메모리 통계
  public getDetailedMemoryStats() {
    return {
      buffer: this.buffer.getStats(),
      config: this.config,
      overflowQueue: this.overflowQueue.length,
      exportedFileCount: this.exportedFileCount
    };
  }

  // 로그 지우기
  public clearLogs(): void {
    // 현재 버퍼의 모든 로그를 Object Pool로 반환
    if (this.onLogEvicted) {
      const allLogs = this.buffer.getAllLogs();
      for (const log of allLogs) {
        this.onLogEvicted(log);
      }
    }
    
    // 오버플로우 큐의 로그들도 Object Pool로 반환
    if (this.onLogEvicted) {
      for (const log of this.overflowQueue) {
        this.onLogEvicted(log);
      }
    }
    
    this.buffer.clear();
    this.overflowQueue = [];
    this.exportedFileCount = 0;
  }

  // 검색 기능
  public searchLogs(query: string, options?: {
    direction?: 'send' | 'recv';
    startTime?: Date;
    endTime?: Date;
  }): LogEntry[] {
    const allLogs = this.buffer.getAllLogs();
    
    return allLogs.filter(log => {
      // 텍스트 검색
      const matchesQuery = !query || 
        log.data.toLowerCase().includes(query.toLowerCase()) ||
        (log.parsed?.functionCode && log.parsed.functionCode.toString().toLowerCase().includes(query.toLowerCase()));
      
      // 방향 필터
      const matchesDirection = !options?.direction || log.direction === options.direction;
      
      // 시간 범위 필터
      const matchesTimeRange = (!options?.startTime || log.timestamp >= options.startTime) &&
                              (!options?.endTime || log.timestamp <= options.endTime);
      
      return matchesQuery && matchesDirection && matchesTimeRange;
    });
  }

  // 리소스 정리
  public async destroy(): Promise<void> {
    // 자동 저장 타이머 정지
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    // 남은 오버플로우 로그들을 마지막으로 저장
    if (this.overflowQueue.length > 0) {
      try {
        await this.saveOverflowLogs();
      } catch (error) {
        console.warn('Failed to save final overflow logs:', error);
      }
    }
    
    // 리소스 정리
    this.overflowQueue = [];
  }
}