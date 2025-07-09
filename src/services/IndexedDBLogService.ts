import { LogEntry } from '../types';

export interface IndexedDBStats {
  totalLogs: number;
  dbSize: string;
  lastUpdated: Date | null;
}

export class IndexedDBLogService {
  private dbName = 'ModbusLogsDB';
  private version = 1;
  private storeName = 'overflowLogs';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  // IndexedDB 초기화
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Object store 생성
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id',
            autoIncrement: false 
          });
          
          // 인덱스 생성 (timestamp 기준 정렬용)
          store.createIndex('timestamp', 'timestamp', { unique: false });
          
        }
      };
    });
  }

  // DB 연결 확인 및 재연결
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    
    return this.db;
  }

  // 오버플로우 로그 추가
  public async addOverflowLog(log: LogEntry): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add(log);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to add overflow log:', error);
      throw error;
    }
  }

  // 여러 오버플로우 로그 일괄 추가
  public async addOverflowLogs(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;
    
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        let completed = 0;
        let hasError = false;
        
        for (const log of logs) {
          const request = store.add(log);
          
          request.onsuccess = () => {
            completed++;
            if (completed === logs.length && !hasError) {
              resolve();
            }
          };
          
          request.onerror = () => {
            if (!hasError) {
              hasError = true;
              reject(request.error);
            }
          };
        }
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to add overflow logs:', error);
      throw error;
    }
  }

  // 모든 오버플로우 로그 가져오기 (시간순 정렬)
  public async getAllOverflowLogs(): Promise<LogEntry[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      return new Promise<LogEntry[]>((resolve, reject) => {
        const request = index.getAll();
        
        request.onsuccess = () => {
          const logs = request.result as LogEntry[];
          // timestamp 기준으로 정렬 (오래된 것부터)
          logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(logs);
        };
        
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to get overflow logs:', error);
      return [];
    }
  }

  // 페이지네이션으로 로그 가져오기
  public async getOverflowLogsPaginated(offset: number = 0, limit: number = 1000): Promise<LogEntry[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      return new Promise<LogEntry[]>((resolve, reject) => {
        const logs: LogEntry[] = [];
        let currentOffset = 0;
        
        const request = index.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            if (currentOffset >= offset) {
              logs.push(cursor.value as LogEntry);
              
              if (logs.length >= limit) {
                resolve(logs);
                return;
              }
            }
            
            currentOffset++;
            cursor.continue();
          } else {
            resolve(logs);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to get paginated overflow logs:', error);
      return [];
    }
  }

  // 오버플로우 로그 개수 조회
  public async getOverflowLogCount(): Promise<number> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise<number>((resolve, reject) => {
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to get overflow log count:', error);
      return 0;
    }
  }

  // IndexedDB 통계 정보
  public async getStats(): Promise<IndexedDBStats> {
    try {
      const totalLogs = await this.getOverflowLogCount();
      
      // DB 크기 추정 (정확하지 않지만 대략적인 크기)
      const sampleLogs = await this.getOverflowLogsPaginated(0, 10);
      const avgLogSize = sampleLogs.length > 0 
        ? JSON.stringify(sampleLogs).length / sampleLogs.length 
        : 200; // 기본 추정 크기
      
      const estimatedSize = (totalLogs * avgLogSize) / 1024 / 1024; // MB
      
      return {
        totalLogs,
        dbSize: `${estimatedSize.toFixed(2)} MB`,
        lastUpdated: totalLogs > 0 ? new Date() : null
      };
      
    } catch (error) {
      console.error('[IndexedDB] Failed to get stats:', error);
      return {
        totalLogs: 0,
        dbSize: '0 MB',
        lastUpdated: null
      };
    }
  }

  // 모든 오버플로우 로그 삭제 (초기화)
  public async clearAllOverflowLogs(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to clear overflow logs:', error);
      throw error;
    }
  }

  // 특정 기간 이전의 로그 삭제 (선택적 정리)
  public async clearLogsBefore(date: Date): Promise<number> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      let deletedCount = 0;
      
      return new Promise<number>((resolve, reject) => {
        const range = IDBKeyRange.upperBound(date.toISOString());
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('[IndexedDB] Failed to clear old logs:', error);
      return 0;
    }
  }

  // 리소스 정리
  public destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}