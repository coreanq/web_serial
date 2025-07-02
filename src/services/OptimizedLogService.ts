import { LogEntry } from '../types';
import { SimpleCircularBuffer } from './SimpleCircularBuffer';

export interface LogBufferConfig {
  // CircularBuffer 설정
  bufferSize: number;           // 메모리 버퍼 크기 (기본: 1000)
  pendingQueueSize: number;     // 대기 중인 export 큐 크기 (기본: 200)
  autoExportThreshold: number;  // 자동 파일 저장 임계값 (기본: 100)
  
  // 파일 저장 설정
  exportFormat: 'json' | 'csv' | 'txt';  // 파일 형식
  autoExportEnabled: boolean;   // 자동 저장 활성화
  exportPath?: string;          // 저장 경로 (브라우저에서는 다운로드)
  
  // 성능 설정
  batchSize: number;           // 일괄 처리 크기 (기본: 100)
  compressionEnabled: boolean;  // 압축 저장
  
  // 비동기 처리 설정
  maxConcurrentExports: number; // 동시 export 작업 수 (기본: 2)
  exportRetryAttempts: number;  // export 실패 시 재시도 횟수 (기본: 3)
}

export class OptimizedLogService {
  private buffer: SimpleCircularBuffer;
  private config: LogBufferConfig;
  private exportedFileCount: number = 0;
  private pendingExportQueue: LogEntry[] = [];
  private activeExports: Set<Promise<void>> = new Set();

  constructor(config?: Partial<LogBufferConfig>) {
    this.config = {
      bufferSize: 10000,
      pendingQueueSize: 10000, // Always same as bufferSize
      autoExportThreshold: 2000,
      exportFormat: 'json',
      autoExportEnabled: true,
      batchSize: 100,
      compressionEnabled: false,
      maxConcurrentExports: 2,
      exportRetryAttempts: 3,
      ...config
    };

    // Always keep pendingQueueSize same as bufferSize
    this.config.pendingQueueSize = this.config.bufferSize;

    this.buffer = new SimpleCircularBuffer(this.config.bufferSize);
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
    
    // 제거된 로그가 있고 자동 저장이 활성화된 경우 pending queue에 추가
    if (evictedLog && this.config.autoExportEnabled) {
      this.pendingExportQueue.push(evictedLog);
      
      // Pending queue가 임계값에 도달하면 비동기 export 시작
      if (this.pendingExportQueue.length >= this.config.autoExportThreshold) {
        this.triggerAsyncExport();
      }
    }
  }

  // 비동기 export 트리거
  private triggerAsyncExport(): void {
    // 동시 export 작업 수 제한
    if (this.activeExports.size >= this.config.maxConcurrentExports) {
      return;
    }
    
    // Export할 로그들 분리 (배치 크기만큼)
    const logsToExport = this.pendingExportQueue.splice(0, this.config.batchSize);
    if (logsToExport.length === 0) return;
    
    // 비동기 export 실행
    const exportPromise = this.performAsyncExport(logsToExport);
    this.activeExports.add(exportPromise);
    
    // Export 완료 후 정리
    exportPromise.finally(() => {
      this.activeExports.delete(exportPromise);
      
      // 더 export할 것이 있다면 재귀 호출
      if (this.pendingExportQueue.length >= this.config.autoExportThreshold && 
          this.activeExports.size < this.config.maxConcurrentExports) {
        this.triggerAsyncExport();
      }
    });
  }

  // 실제 비동기 export 수행 (재시도 로직 포함)
  private async performAsyncExport(logs: LogEntry[], retryCount: number = 0): Promise<void> {
    try {
      const filename = `auto_export_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await this.exportToFile(logs, filename);
      this.exportedFileCount++;
    } catch (error) {
      console.error(`Export failed (attempt ${retryCount + 1}):`, error);
      
      // 재시도 로직
      if (retryCount < this.config.exportRetryAttempts) {
        // 지수 백오프로 재시도 (1초, 2초, 4초...)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.performAsyncExport(logs, retryCount + 1);
      } else {
        // 최종 실패 시 pending queue 맨 앞에 다시 추가 (데이터 손실 방지)
        this.pendingExportQueue.unshift(...logs);
        throw error;
      }
    }
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

  // 강제로 pending queue를 비우기 (수동 호출용)
  public async flushPendingExports(): Promise<void> {
    if (this.pendingExportQueue.length === 0) return;
    
    // 모든 pending 로그를 한 번에 export
    const logsToExport = [...this.pendingExportQueue];
    this.pendingExportQueue = [];
    
    try {
      await this.performAsyncExport(logsToExport);
    } catch (error) {
      console.error('Failed to flush pending exports:', error);
      throw error;
    }
  }

  // 수동 파일 저장
  public async exportAllLogs(filename?: string): Promise<void> {
    const allLogs = this.buffer.getAllLogs();
    if (allLogs.length === 0) {
      throw new Error('No logs to export');
    }

    const exportFilename = filename || `modbus_logs_${this.formatTimestamp(new Date())}`;
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

  // 로그 통계 (확장된 메모리 정보 포함)
  public getStats(): {
    memoryLogs: number;
    totalLogs: number;
    exportedFiles: number;
    memoryUsage: string;
    bufferUtilization: string;
    pendingExports: number;
    activeExports: number;
  } {
    const bufferStats = this.buffer.getStats();
    const allLogs = this.buffer.getAllLogs();
    const memoryUsage = (JSON.stringify(allLogs).length / 1024 / 1024).toFixed(2);
    
    return {
      memoryLogs: bufferStats.size || 0,
      totalLogs: (bufferStats.totalCount || 0) + (this.exportedFileCount * this.config.batchSize),
      exportedFiles: this.exportedFileCount || 0,
      memoryUsage: `${memoryUsage} MB`,
      bufferUtilization: `${(bufferStats.size / bufferStats.capacity * 100).toFixed(1)}%`,
      pendingExports: this.pendingExportQueue?.length || 0,
      activeExports: this.activeExports?.size || 0
    };
  }

  // 상세 메모리 통계
  public getDetailedMemoryStats() {
    return {
      buffer: this.buffer.getStats(),
      config: this.config,
      pendingExportQueue: this.pendingExportQueue.length,
      activeExports: this.activeExports.size,
      exportedFileCount: this.exportedFileCount
    };
  }

  // 로그 지우기
  public clearLogs(): void {
    this.buffer.clear();
    this.pendingExportQueue = [];
    this.exportedFileCount = 0;
    
    // 활성 export 작업들을 취소하지는 않음 (진행 중인 작업 보호)
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
    // 모든 pending exports를 완료
    await this.flushPendingExports();
    
    // 활성 export 작업들이 완료될 때까지 대기
    await Promise.allSettled(Array.from(this.activeExports));
    
    // 리소스 정리
    this.activeExports.clear();
    this.pendingExportQueue = [];
  }
}