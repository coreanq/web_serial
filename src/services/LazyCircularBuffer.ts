import { LogEntry } from '../types';

interface BufferSegment {
  data: LogEntry[] | null; // null = 아직 할당되지 않음
  capacity: number;
  size: number;
  startIndex: number;
}

export class LazyCircularBuffer {
  private segments: BufferSegment[] = [];
  private maxTotalCapacity: number;
  private segmentSize: number;
  private totalSize = 0;
  private totalCount = 0;
  private currentSegment = 0;

  constructor(maxCapacity: number = 1000, segmentSize: number = 100) {
    this.maxTotalCapacity = maxCapacity;
    this.segmentSize = segmentSize;
    this.initializeSegments();
  }

  private initializeSegments(): void {
    const segmentCount = Math.ceil(this.maxTotalCapacity / this.segmentSize);
    
    this.segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const capacity = Math.min(this.segmentSize, this.maxTotalCapacity - (i * this.segmentSize));
      this.segments.push({
        data: null, // 지연 할당
        capacity,
        size: 0,
        startIndex: 0
      });
    }
  }

  // 세그먼트 지연 할당
  private allocateSegment(segmentIndex: number): void {
    const segment = this.segments[segmentIndex];
    if (!segment.data) {
      segment.data = new Array(segment.capacity);
      console.log(`📦 Segment ${segmentIndex} allocated: ${segment.capacity} slots`);
    }
  }

  public add(log: LogEntry): LogEntry | null {
    let evictedLog: LogEntry | null = null;
    
    // 현재 세그먼트 할당
    this.allocateSegment(this.currentSegment);
    const segment = this.segments[this.currentSegment];

    // 세그먼트가 가득 찬 경우
    if (segment.size >= segment.capacity) {
      // 다음 세그먼트로 이동
      this.currentSegment = (this.currentSegment + 1) % this.segments.length;
      this.allocateSegment(this.currentSegment);
      
      // 전체 버퍼가 가득 찬 경우 순환
      if (this.totalSize >= this.maxTotalCapacity) {
        evictedLog = this.removeOldestFromCurrentSegment();
      }
    }

    const insertIndex = (segment.startIndex + segment.size) % segment.capacity;
    
    if (segment.size >= segment.capacity) {
      // 순환 버퍼 동작
      evictedLog = segment.data![segment.startIndex];
      segment.startIndex = (segment.startIndex + 1) % segment.capacity;
    } else {
      segment.size++;
      this.totalSize++;
    }

    segment.data![insertIndex] = log;
    this.totalCount++;

    return evictedLog;
  }

  private removeOldestFromCurrentSegment(): LogEntry | null {
    const segment = this.segments[this.currentSegment];
    
    if (segment.size === 0 || !segment.data) {
      return null;
    }

    const evictedLog = segment.data[segment.startIndex];
    segment.startIndex = (segment.startIndex + 1) % segment.capacity;
    segment.size--;
    this.totalSize--;

    return evictedLog;
  }

  // 효율적인 크기 조정 - 불필요한 복사 없음
  public resize(newMaxCapacity: number): void {
    const oldCapacity = this.maxTotalCapacity;
    this.maxTotalCapacity = newMaxCapacity;

    if (newMaxCapacity < oldCapacity) {
      // 크기 축소 - 일부 세그먼트 해제
      this.shrinkBuffer(newMaxCapacity);
    } else {
      // 크기 확장 - 새 세그먼트 예약 (실제 할당은 필요시)
      this.expandBuffer(newMaxCapacity);
    }
  }

  private shrinkBuffer(newCapacity: number): void {
    const newSegmentCount = Math.ceil(newCapacity / this.segmentSize);
    const excessLogs = this.totalSize - newCapacity;

    // 초과 로그 제거
    for (let i = 0; i < excessLogs; i++) {
      this.removeOldestFromAnySegment();
    }

    // 불필요한 세그먼트 해제
    if (newSegmentCount < this.segments.length) {
      for (let i = newSegmentCount; i < this.segments.length; i++) {
        this.segments[i].data = null; // 메모리 해제
      }
      this.segments = this.segments.slice(0, newSegmentCount);
      this.currentSegment = Math.min(this.currentSegment, this.segments.length - 1);
    }
  }

  private expandBuffer(newCapacity: number): void {
    const newSegmentCount = Math.ceil(newCapacity / this.segmentSize);
    
    // 새 세그먼트 추가 (지연 할당)
    while (this.segments.length < newSegmentCount) {
      const segmentIndex = this.segments.length;
      const capacity = Math.min(this.segmentSize, newCapacity - (segmentIndex * this.segmentSize));
      
      this.segments.push({
        data: null, // 지연 할당
        capacity,
        size: 0,
        startIndex: 0
      });
    }
  }

  private removeOldestFromAnySegment(): LogEntry | null {
    // 가장 오래된 로그를 가진 세그먼트 찾기
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (segment.size > 0 && segment.data) {
        const evictedLog = segment.data[segment.startIndex];
        segment.startIndex = (segment.startIndex + 1) % segment.capacity;
        segment.size--;
        this.totalSize--;
        return evictedLog;
      }
    }
    return null;
  }

  public getAllLogs(): LogEntry[] {
    const result: LogEntry[] = [];
    
    for (const segment of this.segments) {
      if (segment.data && segment.size > 0) {
        for (let i = 0; i < segment.size; i++) {
          const index = (segment.startIndex + i) % segment.capacity;
          result.push(segment.data[index]);
        }
      }
    }
    
    return result;
  }

  public getRecentLogs(count: number): LogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(-count);
  }

  // 메모리 사용량 통계
  public getMemoryStats(): {
    allocatedSegments: number;
    totalSegments: number;
    allocatedMemory: number;
    reservedMemory: number;
    memoryEfficiency: number;
    totalSize: number;
    totalCount: number;
  } {
    const allocatedSegments = this.segments.filter(s => s.data !== null).length;
    const allocatedMemory = allocatedSegments * this.segmentSize;
    const reservedMemory = this.segments.length * this.segmentSize;
    const efficiency = this.totalSize / Math.max(allocatedMemory, 1);

    return {
      allocatedSegments: allocatedSegments || 0,
      totalSegments: this.segments.length || 0,
      allocatedMemory: allocatedMemory || 0,
      reservedMemory: reservedMemory || 0,
      memoryEfficiency: efficiency || 0,
      totalSize: this.totalSize || 0,
      totalCount: this.totalCount || 0
    };
  }

  // 메모리 최적화 - 빈 세그먼트 해제
  public defragment(): void {
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      
      // 빈 세그먼트 해제 (현재 사용 중인 세그먼트 제외)
      if (segment.size === 0 && segment.data && i !== this.currentSegment) {
        segment.data = null;
        console.log(`🧹 Segment ${i} deallocated`);
      }
    }
  }

  public clear(): void {
    for (const segment of this.segments) {
      segment.data = null;
      segment.size = 0;
      segment.startIndex = 0;
    }
    this.totalSize = 0;
    this.totalCount = 0;
    this.currentSegment = 0;
  }

  // 설정 변경시 점진적 적용
  public setSegmentSize(newSegmentSize: number): void {
    this.segmentSize = newSegmentSize;
    // 다음 할당부터 새 크기 적용
  }
}