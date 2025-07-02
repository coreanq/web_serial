import { LogEntry } from '../types';
import { LazyCircularBuffer } from './LazyCircularBuffer';

export interface LogBufferConfig {
  // CircularBuffer 설정
  bufferSize: number;           // 메모리 버퍼 크기 (기본: 1000)
  segmentSize: number;          // 세그먼트 크기 (기본: 100)
  autoExportSize: number;       // 자동 파일 저장 임계값 (기본: 500)
  
  // 파일 저장 설정
  exportFormat: 'json' | 'csv' | 'txt';  // 파일 형식
  autoExportEnabled: boolean;   // 자동 저장 활성화
  exportPath?: string;          // 저장 경로 (브라우저에서는 다운로드)
  
  // 성능 설정
  batchSize: number;           // 일괄 처리 크기 (기본: 100)
  compressionEnabled: boolean;  // 압축 저장
  
  // 메모리 최적화 설정
  autoDefragmentEnabled: boolean;  // 자동 메모리 정리
  defragmentInterval: number;      // 정리 주기 (ms)
}

export class OptimizedLogService {
  private buffer: LazyCircularBuffer;
  private config: LogBufferConfig;
  private exportedFileCount: number = 0;
  private isExporting: boolean = false;
  private defragmentTimer?: NodeJS.Timeout;

  constructor(config?: Partial<LogBufferConfig>) {
    this.config = {
      bufferSize: 1000,
      segmentSize: 100,
      autoExportSize: 500,
      exportFormat: 'json',
      autoExportEnabled: true,
      batchSize: 100,
      compressionEnabled: false,
      autoDefragmentEnabled: true,
      defragmentInterval: 30000, // 30초
      ...config
    };

    this.buffer = new LazyCircularBuffer(
      this.config.bufferSize,
      this.config.segmentSize
    );

    this.loadSettings();
    this.startDefragmentTimer();
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
        this.buffer.setSegmentSize(this.config.segmentSize);
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
    const oldSegmentSize = this.config.segmentSize;
    const oldDefragmentEnabled = this.config.autoDefragmentEnabled;
    
    this.config = { ...this.config, ...newConfig };
    
    // 버퍼 크기 변경 - 지연 할당으로 즉시 적용
    if (newConfig.bufferSize && newConfig.bufferSize !== oldBufferSize) {
      this.buffer.resize(newConfig.bufferSize);
    }
    
    // 세그먼트 크기 변경
    if (newConfig.segmentSize && newConfig.segmentSize !== oldSegmentSize) {
      this.buffer.setSegmentSize(newConfig.segmentSize);
    }
    
    // 자동 정리 설정 변경
    if (newConfig.autoDefragmentEnabled !== undefined && 
        newConfig.autoDefragmentEnabled !== oldDefragmentEnabled) {
      if (newConfig.autoDefragmentEnabled) {
        this.startDefragmentTimer();
      } else {
        this.stopDefragmentTimer();
      }
    }
    
    this.saveSettings();
  }

  public getConfig(): LogBufferConfig {
    return { ...this.config };
  }

  // 자동 메모리 정리 타이머 시작
  private startDefragmentTimer(): void {
    if (!this.config.autoDefragmentEnabled) return;
    
    this.stopDefragmentTimer();
    this.defragmentTimer = setInterval(() => {
      this.buffer.defragment();
    }, this.config.defragmentInterval);
  }

  // 자동 메모리 정리 타이머 중지
  private stopDefragmentTimer(): void {
    if (this.defragmentTimer) {
      clearInterval(this.defragmentTimer);
      this.defragmentTimer = undefined;
    }
  }

  // 수동 메모리 정리
  public defragment(): void {
    this.buffer.defragment();
  }

  // 로그 추가
  public async addLog(log: LogEntry): Promise<void> {
    // LazyCircularBuffer에 로그 추가
    const evictedLog = this.buffer.add(log);
    
    // 제거된 로그가 있고 자동 저장이 활성화된 경우 저장
    if (evictedLog && this.config.autoExportEnabled && !this.isExporting) {
      // 제거된 로그들을 일괄 저장을 위해 임시 저장
      this.queueForExport(evictedLog);
    }

    // 자동 저장 임계값 체크
    const stats = this.buffer.getMemoryStats();
    if (this.config.autoExportEnabled && 
        stats.allocatedMemory >= this.config.autoExportSize && 
        !this.isExporting) {
      setTimeout(() => this.exportOldLogs(), 0); // 비동기 실행
    }
  }

  // 제거된 로그들을 일괄 저장을 위해 큐에 추가
  private exportQueue: LogEntry[] = [];
  
  private queueForExport(log: LogEntry): void {
    this.exportQueue.push(log);
    
    // 배치 크기에 도달하면 저장
    if (this.exportQueue.length >= this.config.batchSize) {
      setTimeout(() => this.flushExportQueue(), 0);
    }
  }

  private async flushExportQueue(): Promise<void> {
    if (this.exportQueue.length === 0 || this.isExporting) return;
    
    const logsToExport = [...this.exportQueue];
    this.exportQueue = [];
    
    try {
      await this.exportToFile(logsToExport, `evicted_logs_${Date.now()}`);
      this.exportedFileCount++;
    } catch (error) {
      console.error('Failed to export evicted logs:', error);
      // 실패한 로그들을 다시 큐에 추가
      this.exportQueue.unshift(...logsToExport);
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
    const memoryStats = this.buffer.getMemoryStats();
    return memoryStats.totalCount + (this.exportedFileCount * this.config.autoExportSize);
  }

  // 현재 메모리 로그 수 반환
  public getMemoryCount(): number {
    return this.buffer.getMemoryStats().totalSize;
  }

  // 오래된 로그들을 파일로 저장
  private async exportOldLogs(): Promise<void> {
    const memoryStats = this.buffer.getMemoryStats();
    if (this.isExporting || memoryStats.totalSize < this.config.autoExportSize) {
      return;
    }

    this.isExporting = true;
    
    try {
      // 저장할 로그들 선택 (오래된 것부터)
      const allLogs = this.buffer.getAllLogs();
      const logsToExport = allLogs.slice(0, this.config.autoExportSize);
      
      if (logsToExport.length > 0) {
        await this.exportToFile(logsToExport, `auto_export_${this.exportedFileCount + 1}`);
        this.exportedFileCount++;
        
        // LazyCircularBuffer는 자동으로 오래된 로그를 제거하므로 
        // 별도 제거 로직 불필요
      }
    } catch (error) {
      console.error('Failed to export old logs:', error);
    } finally {
      this.isExporting = false;
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
    allocatedSegments: number;
    totalSegments: number;
    memoryEfficiency: string;
    queuedForExport: number;
  } {
    const memoryStats = this.buffer.getMemoryStats();
    const allLogs = this.buffer.getAllLogs();
    const memoryUsage = (JSON.stringify(allLogs).length / 1024 / 1024).toFixed(2);
    
    return {
      memoryLogs: memoryStats.totalSize || 0,
      totalLogs: (memoryStats.totalCount || 0) + (this.exportedFileCount * this.config.autoExportSize),
      exportedFiles: this.exportedFileCount || 0,
      memoryUsage: `${memoryUsage} MB`,
      allocatedSegments: memoryStats.allocatedSegments || 0,
      totalSegments: memoryStats.totalSegments || 0,
      memoryEfficiency: `${((memoryStats.memoryEfficiency || 0) * 100).toFixed(1)}%`,
      queuedForExport: this.exportQueue?.length || 0
    };
  }

  // 상세 메모리 통계
  public getDetailedMemoryStats() {
    return {
      buffer: this.buffer.getMemoryStats(),
      config: this.config,
      exportQueue: this.exportQueue.length,
      isExporting: this.isExporting,
      defragmentTimer: !!this.defragmentTimer
    };
  }

  // 로그 지우기
  public clearLogs(): void {
    this.buffer.clear();
    this.exportQueue = [];
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
  public destroy(): void {
    this.stopDefragmentTimer();
    this.flushExportQueue();
  }
}