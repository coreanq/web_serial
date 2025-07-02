import { LogEntry } from '../types';

export class SimpleCircularBuffer {
  private buffer: LogEntry[];
  private head: number = 0;  // Next write position
  private tail: number = 0;  // Oldest item position
  private size: number = 0;  // Current number of items
  private capacity: number;
  private totalCount: number = 0; // Total logs added (never decreases)

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add a log entry to the buffer
   * @param log Log entry to add
   * @returns Evicted log if buffer was full, null otherwise
   */
  public add(log: LogEntry): LogEntry | null {
    let evictedLog: LogEntry | null = null;

    // If buffer is full, we'll evict the oldest item
    if (this.size === this.capacity) {
      evictedLog = this.buffer[this.tail];
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      this.size++;
    }

    // Add new log at head position
    this.buffer[this.head] = log;
    this.head = (this.head + 1) % this.capacity;
    this.totalCount++;

    return evictedLog;
  }

  /**
   * Get all logs in chronological order (oldest to newest)
   */
  public getAllLogs(): LogEntry[] {
    if (this.size === 0) return [];

    const result: LogEntry[] = [];
    
    for (let i = 0; i < this.size; i++) {
      const index = (this.tail + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    
    return result;
  }

  /**
   * Get the most recent N logs
   */
  public getRecentLogs(count: number): LogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(-count);
  }

  /**
   * Get logs in a specific range (for virtual scrolling)
   */
  public getLogsInRange(startIndex: number, count: number): LogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(startIndex, startIndex + count);
  }

  /**
   * Clear all logs from the buffer
   */
  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.totalCount = 0;
    // Don't need to clear the array, just reset pointers
  }

  /**
   * Resize the buffer capacity
   */
  public resize(newCapacity: number): void {
    if (newCapacity === this.capacity) return;

    const currentLogs = this.getAllLogs();
    
    // Create new buffer
    this.buffer = new Array(newCapacity);
    this.capacity = newCapacity;
    this.head = 0;
    this.tail = 0;
    this.size = 0;

    // Re-add logs, keeping the most recent ones if new capacity is smaller
    const logsToKeep = newCapacity < currentLogs.length 
      ? currentLogs.slice(-newCapacity) 
      : currentLogs;

    for (const log of logsToKeep) {
      this.add(log);
    }
  }

  /**
   * Get buffer statistics
   */
  public getStats(): {
    capacity: number;
    size: number;
    totalCount: number;
    memoryUsage: number; // Approximate memory usage in bytes
  } {
    // Rough estimate: each log entry ~200 bytes (JSON string + overhead)
    const estimatedLogSize = 200;
    
    return {
      capacity: this.capacity,
      size: this.size,
      totalCount: this.totalCount,
      memoryUsage: this.capacity * estimatedLogSize
    };
  }

  /**
   * Check if buffer is full
   */
  public isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Get current buffer utilization (0-1)
   */
  public getUtilization(): number {
    return this.size / this.capacity;
  }
}