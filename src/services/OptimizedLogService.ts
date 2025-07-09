import { LogEntry } from '../types';
import { SimpleCircularBuffer } from './SimpleCircularBuffer';
import { IndexedDBLogService, IndexedDBStats } from './IndexedDBLogService';

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
  private indexedDBService: IndexedDBLogService;  // IndexedDB 서비스
  private onLogEvicted?: (log: LogEntry) => void; // Object Pool 콜백
  private overflowQueue: LogEntry[] = [];
  private flushTimeout: number | null = null;

  constructor(config?: Partial<LogBufferConfig>, onLogEvicted?: (log: LogEntry) => void) {
    this.config = {
      bufferSize: 10000,
      exportFormat: 'json',
      ...config
    };

    this.buffer = new SimpleCircularBuffer(this.config.bufferSize);
    this.indexedDBService = new IndexedDBLogService();
    this.onLogEvicted = onLogEvicted;
    this.loadSettings();
  }

  // 설정 로드/저장
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('modbus-log-config');
      if (saved) {
        const savedConfig = JSON.parse(saved);
        this.config = { ...this.config, ...savedConfig };
        
        // 버퍼 크기가 변경된 경우 재할당
        if (this.buffer) {
          this.buffer.resize(this.config.bufferSize);
        }
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
    
    // Note: pendingQueueSize no longer exists in simplified config
    
    // 버퍼 크기 변경 시 적용
    if (newConfig.bufferSize && newConfig.bufferSize !== oldBufferSize) {
      if (this.buffer) {
        this.buffer.resize(newConfig.bufferSize);
      }
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
      
      // IndexedDB에 오버플로우 로그 저장
      this.overflowQueue.push(evictedLog);

      if (this.overflowQueue.length >= 100) {
        this.flushOverflowQueue();
      } else {
        this.scheduleFlush();
      }
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.flushTimeout = setTimeout(() => {
      this.flushOverflowQueue();
    }, 500);
  }

  private async flushOverflowQueue(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.overflowQueue.length === 0) {
      return;
    }

    const logsToFlush = [...this.overflowQueue];
    this.overflowQueue = [];

    try {
      await this.indexedDBService.addOverflowLogs(logsToFlush);
    } catch (error) {
      console.error('Failed to save bulk overflow logs to IndexedDB:', error);
    }
  }

  // 모든 로그 내보내기 (메모리 + IndexedDB)
  public async exportAllLogsIncludingIndexedDB(filename?: string): Promise<void> {
    try {
      // 메모리의 로그
      const memoryLogs = this.buffer.getAllLogs();
      
      // IndexedDB의 오버플로우 로그
      const overflowLogs = await this.indexedDBService.getAllOverflowLogs();
      
      // 시간순으로 병합
      const allLogs = [...overflowLogs, ...memoryLogs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      if (allLogs.length === 0) {
        throw new Error('No logs to export');
      }

      const exportFilename = filename || `modbus_logs_complete_${this.formatTimestamp(new Date())}`;
      await this.exportToFile(allLogs, exportFilename);
      
      // 내보내기 후 IndexedDB 초기화
      await this.indexedDBService.clearAllOverflowLogs();
      
    } catch (error) {
      console.error('Failed to export all logs:', error);
      throw error;
    }
  }

  // IndexedDB 통계 조회
  public async getIndexedDBStats(): Promise<IndexedDBStats> {
    return await this.indexedDBService.getStats();
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
    return bufferStats.totalCount + this.exportedFileCount;
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

    // Note: compression feature removed in simplified version

    // 브라우저에서 파일 다운로드
    this.downloadFile(content, filename + fileExtension, mimeType);
  }

  // CSV 형식으로 변환
  private logsToCSV(logs: LogEntry[]): string {
    const headers = ['Timestamp', 'Direction', 'Data', 'Error', 'ResponseTime'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.direction,
      log.data,
      log.error || '',
      log.responseTime?.toString() || ''
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
      const error = log.error ? ` [ERROR: ${log.error}]` : '';
      const responseTime = log.responseTime ? ` (${log.responseTime}ms)` : '';
      
      return `${timestamp} ${direction}: ${log.data}${error}${responseTime}`;
    }).join('\n');
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

  // 로그 통계 (비동기 - IndexedDB 조회 포함)
  public async getStats(): Promise<{
    memoryLogs: number;
    totalLogs: number;
    exportedFiles: number;
    memoryUsage: string;
    bufferUtilization: string;
    indexedDBLogs: number;
    indexedDBSize: string;
  }> {
    const bufferStats = this.buffer.getStats();
    const allLogs = this.buffer.getAllLogs();
    const memoryUsage = (JSON.stringify(allLogs).length / 1024 / 1024).toFixed(2);
    
    // IndexedDB 통계 조회
    const indexedDBStats = await this.indexedDBService.getStats();
    
    return {
      memoryLogs: bufferStats.size || 0,
      totalLogs: (bufferStats.totalCount || 0) + indexedDBStats.totalLogs,
      exportedFiles: this.exportedFileCount || 0,
      memoryUsage: `${memoryUsage} MB`,
      bufferUtilization: `${(bufferStats.size / bufferStats.capacity * 100).toFixed(1)}%`,
      indexedDBLogs: indexedDBStats.totalLogs,
      indexedDBSize: indexedDBStats.dbSize
    };
  }

  // 상세 메모리 통계
  public getDetailedMemoryStats() {
    return {
      buffer: this.buffer.getStats(),
      config: this.config,
      exportedFileCount: this.exportedFileCount
    };
  }

  // 로그 지우기 (메모리만 - IndexedDB는 유지)
  public clearLogs(): void {
    
    // 현재 버퍼의 모든 로그를 Object Pool로 반환
    if (this.onLogEvicted) {
      const allLogs = this.buffer.getAllLogs();
      for (const log of allLogs) {
        this.onLogEvicted(log);
      }
    }
    
    // 오버플로우 큐도 지우기
    if (this.overflowQueue.length > 0) {
      this.overflowQueue = [];
    }
    
    // 플러시 타이머 정리
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    this.buffer.clear();
  }

  // 모든 로그 지우기 (메모리 + IndexedDB)
  public async clearAllLogs(): Promise<void> {
    // 메모리 버퍼 지우기
    this.clearLogs();
    
    // IndexedDB도 지우기
    try {
      await this.indexedDBService.clearAllOverflowLogs();
    } catch (error) {
      console.error('Failed to clear IndexedDB logs:', error);
    }
    
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
    await this.flushOverflowQueue();
    // IndexedDB 연결 해제
    this.indexedDBService.destroy();
  }
}