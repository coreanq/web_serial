import { LogEntry, LogStorageConfig, LogStorageMode } from '../types';

export class LogService {
  private allLogs: LogEntry[] = [];
  private config: LogStorageConfig;
  private currentLogFile: string = '';
  private currentFileSize: number = 0;
  private isWriting: boolean = false;

  constructor(config?: LogStorageConfig) {
    this.config = config || this.getDefaultConfig();
    this.initializeLogFile();
  }

  private getDefaultConfig(): LogStorageConfig {
    return {
      mode: 'continuous',
      continuous: {
        maxFileSize: 10, // 10MB
        fileNameFormat: 'YYYY-MM-DD_HH-mm-ss'
      },
      rotation: {
        maxFileSize: 5, // 5MB
        maxFiles: 10,
        maxAge: 30, // 30 days
        compressionEnabled: true
      }
    };
  }

  private initializeLogFile(): void {
    const timestamp = this.formatTimestamp(new Date());
    this.currentLogFile = `modbus_debug_${timestamp}.log`;
    this.currentFileSize = 0;
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  private formatLogEntry(log: LogEntry): string {
    const timestamp = log.timestamp.toISOString();
    const direction = log.direction.toUpperCase();
    const data = log.data.replace(/\s+/g, ' ').trim();
    const responseTime = log.responseTime ? ` (${log.responseTime}ms)` : '';
    const error = log.error ? ` [ERROR: ${log.error}]` : '';
    
    return `[${timestamp}] ${direction}: ${data}${responseTime}${error}\n`;
  }

  private async writeToFile(content: string): Promise<void> {
    if (this.isWriting) return;
    
    try {
      this.isWriting = true;
      
      // Browser environment - just accumulate in memory without auto-download
      if (typeof window !== 'undefined') {
        this.currentFileSize += content.length;
      }
      
      // Note: Auto file rotation disabled in browser environment to prevent unwanted downloads
      // Users can manually export logs when needed
      
    } finally {
      this.isWriting = false;
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (this.config.mode === 'continuous') {
      // Continuous mode: create new file, keep all old files
      await this.createNewLogFile();
    } else {
      // Rotation mode: create new file and manage old files
      await this.createNewLogFile();
      await this.cleanupOldFiles();
    }
  }

  private async createNewLogFile(): Promise<void> {
    // Save current log file if it has content
    if (this.currentFileSize > 0) {
      await this.saveCurrentLogFile();
    }
    
    // Initialize new log file
    this.initializeLogFile();
  }

  private async saveCurrentLogFile(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    // Generate file content from all logs for this file
    const fileContent = this.generateFileContent();
    
    // Create and download file
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = this.currentLogFile;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  private generateFileContent(): string {
    return this.allLogs
      .map(log => this.formatLogEntry(log))
      .join('');
  }

  private async cleanupOldFiles(): Promise<void> {
    if (this.config.mode !== 'rotation' || !this.config.rotation) return;
    
    // In a browser environment, we can't directly manage files
    // This would be implemented with File System Access API or server-side storage
  }

  // Public methods
  async addLog(log: LogEntry): Promise<void> {
    // Add to complete log history
    this.allLogs.push(log);
    
    // Write to file
    const logLine = this.formatLogEntry(log);
    await this.writeToFile(logLine);
  }

  async addLogs(logs: LogEntry[]): Promise<void> {
    // Add all logs to complete history
    this.allLogs.push(...logs);
    
    // Write all logs to file
    const content = logs.map(log => this.formatLogEntry(log)).join('');
    await this.writeToFile(content);
  }

  getDisplayLogs(maxCount: number = 1000): LogEntry[] {
    // Return only the latest logs for UI display
    return this.allLogs.slice(-maxCount);
  }

  getAllLogs(): LogEntry[] {
    return [...this.allLogs];
  }

  getLogCount(): number {
    return this.allLogs.length;
  }

  updateConfig(config: LogStorageConfig): void {
    this.config = config;
  }

  getConfig(): LogStorageConfig {
    return { ...this.config };
  }

  clearLogs(): void {
    this.allLogs = [];
    this.initializeLogFile();
  }

  // Export methods
  async exportLogsAsText(): Promise<void> {
    const content = this.generateFileContent();
    const timestamp = this.formatTimestamp(new Date());
    const filename = `modbus_export_${timestamp}.txt`;
    
    this.downloadFile(content, filename, 'text/plain');
  }

  async exportLogsAsCSV(): Promise<void> {
    const csvHeader = 'Timestamp,Direction,Data,Response Time (ms),Error\n';
    const csvContent = this.allLogs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const direction = log.direction;
      const data = `"${log.data.replace(/"/g, '""')}"`;
      const responseTime = log.responseTime || '';
      const error = log.error ? `"${log.error.replace(/"/g, '""')}"` : '';
      
      return `${timestamp},${direction},${data},${responseTime},${error}`;
    }).join('\n');
    
    const content = csvHeader + csvContent;
    const timestamp = this.formatTimestamp(new Date());
    const filename = `modbus_export_${timestamp}.csv`;
    
    this.downloadFile(content, filename, 'text/csv');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}