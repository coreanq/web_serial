import { LogEntry } from '../types';

interface BufferChunk {
  data: LogEntry[];
  startIndex: number;
  size: number;
  maxSize: number;
}

export class DynamicCircularBuffer {
  private chunks: BufferChunk[] = [];
  private currentChunkIndex = 0;
  private totalSize = 0;
  private totalCount = 0;
  private maxTotalSize: number;
  private chunkSize: number;

  constructor(maxSize: number = 1000, chunkSize: number = 100) {
    this.maxTotalSize = maxSize;
    this.chunkSize = Math.min(chunkSize, maxSize);
    this.initializeFirstChunk();
  }

  private initializeFirstChunk(): void {
    this.chunks = [{
      data: new Array(this.chunkSize),
      startIndex: 0,
      size: 0,
      maxSize: this.chunkSize
    }];
    this.currentChunkIndex = 0;
  }

  // 로그 추가 - 메모리 재할당 최소화
  public add(log: LogEntry): LogEntry | null {
    let evictedLog: LogEntry | null = null;
    const currentChunk = this.chunks[this.currentChunkIndex];

    // 현재 청크가 가득 찬 경우
    if (currentChunk.size >= currentChunk.maxSize) {
      // 전체 버퍼가 가득 찬 경우 오래된 로그 제거
      if (this.totalSize >= this.maxTotalSize) {
        evictedLog = this.removeOldest();
      } else {
        // 새 청크 생성
        this.addNewChunk();
      }
    }

    // 로그 추가
    const insertIndex = (currentChunk.startIndex + currentChunk.size) % currentChunk.maxSize;
    
    if (currentChunk.size >= currentChunk.maxSize) {
      // 순환 버퍼 동작
      evictedLog = currentChunk.data[currentChunk.startIndex];
      currentChunk.startIndex = (currentChunk.startIndex + 1) % currentChunk.maxSize;
    } else {
      currentChunk.size++;
      this.totalSize++;
    }

    currentChunk.data[insertIndex] = log;
    this.totalCount++;

    return evictedLog;
  }

  private addNewChunk(): void {
    const newChunk: BufferChunk = {
      data: new Array(this.chunkSize),
      startIndex: 0,
      size: 0,
      maxSize: this.chunkSize
    };
    
    this.chunks.push(newChunk);
    this.currentChunkIndex = this.chunks.length - 1;
  }

  private removeOldest(): LogEntry | null {
    // 가장 오래된 청크에서 로그 제거
    const oldestChunk = this.chunks[0];
    
    if (oldestChunk.size === 0) {
      return null;
    }

    const evictedLog = oldestChunk.data[oldestChunk.startIndex];
    oldestChunk.startIndex = (oldestChunk.startIndex + 1) % oldestChunk.maxSize;
    oldestChunk.size--;
    this.totalSize--;

    // 청크가 비어있으면 제거 (첫 번째 청크가 아닌 경우만)
    if (oldestChunk.size === 0 && this.chunks.length > 1) {
      this.chunks.shift();
      this.currentChunkIndex--;
    }

    return evictedLog;
  }

  // 버퍼 크기 동적 조정 - 점진적 변경
  public resize(newMaxSize: number): void {
    const oldMaxSize = this.maxTotalSize;
    this.maxTotalSize = newMaxSize;

    // 크기가 줄어든 경우 - 점진적 제거
    if (newMaxSize < oldMaxSize) {
      const excessCount = this.totalSize - newMaxSize;
      for (let i = 0; i < excessCount; i++) {
        this.removeOldest();
      }
    }
    
    // 크기가 늘어난 경우 - 새 청크 예약 (실제 할당은 필요시)
    // 메모리는 필요할 때만 할당됨
  }

  // 전체 로그 반환 (시간순)
  public getAllLogs(): LogEntry[] {
    const result: LogEntry[] = [];
    
    for (const chunk of this.chunks) {
      for (let i = 0; i < chunk.size; i++) {
        const index = (chunk.startIndex + i) % chunk.maxSize;
        result.push(chunk.data[index]);
      }
    }
    
    return result;
  }

  // 최신 로그들 반환
  public getRecentLogs(count: number): LogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(-count);
  }

  // 범위로 로그 반환 (Virtual Scrolling용)
  public getLogsInRange(startIndex: number, count: number): LogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(startIndex, startIndex + count);
  }

  // 통계 정보
  public getStats(): {
    totalSize: number;
    totalCount: number;
    maxSize: number;
    chunkCount: number;
    memoryEfficiency: number;
  } {
    const allocatedSize = this.chunks.reduce((sum, chunk) => sum + chunk.maxSize, 0);
    const efficiency = this.totalSize / allocatedSize;
    
    return {
      totalSize: this.totalSize,
      totalCount: this.totalCount,
      maxSize: this.maxTotalSize,
      chunkCount: this.chunks.length,
      memoryEfficiency: efficiency
    };
  }

  // 메모리 최적화 - 사용하지 않는 청크 정리
  public compact(): void {
    // 빈 청크들 제거 (첫 번째 제외)
    this.chunks = this.chunks.filter((chunk, index) => 
      index === 0 || chunk.size > 0
    );
    
    // 현재 청크 인덱스 재조정
    this.currentChunkIndex = Math.min(this.currentChunkIndex, this.chunks.length - 1);
  }

  // 청크 크기 조정
  public setChunkSize(newChunkSize: number): void {
    this.chunkSize = Math.min(newChunkSize, this.maxTotalSize);
    // 새로운 청크는 새 크기로 생성됨
  }

  public clear(): void {
    this.initializeFirstChunk();
    this.totalSize = 0;
    this.totalCount = 0;
  }
}