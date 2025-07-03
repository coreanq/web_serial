import { LogEntry } from '../types';

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number; // Number of items to render outside viewport
}

export interface VirtualScrollState {
  scrollTop: number;
  startIndex: number;
  endIndex: number;
  visibleItems: LogEntry[];
  totalHeight: number;
}

export class VirtualScrollManager {
  private config: VirtualScrollConfig;
  private data: LogEntry[] = [];
  private state: VirtualScrollState;
  private onStateChange?: (state: VirtualScrollState) => void;

  constructor(config: VirtualScrollConfig) {
    this.config = config;
    this.state = {
      scrollTop: 0,
      startIndex: 0,
      endIndex: 0,
      visibleItems: [],
      totalHeight: 0
    };
  }

  setData(data: LogEntry[]): void {
    this.data = data;
    this.updateState();
  }

  setScrollTop(scrollTop: number): void {
    this.state.scrollTop = scrollTop;
    this.updateState();
  }

  private updateState(): void {
    const { itemHeight, containerHeight, overscan } = this.config;
    const totalHeight = this.data.length * itemHeight;
    
    // Calculate visible range
    const startIndex = Math.max(
      0,
      Math.floor(this.state.scrollTop / itemHeight) - overscan
    );
    
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(this.data.length, startIndex + visibleCount);
    
    // Get visible items
    const visibleItems = this.data.slice(startIndex, endIndex);
    
    this.state = {
      ...this.state,
      startIndex,
      endIndex,
      visibleItems,
      totalHeight
    };
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  getState(): VirtualScrollState {
    return { ...this.state };
  }

  onStateUpdate(callback: (state: VirtualScrollState) => void): void {
    this.onStateChange = callback;
  }

  scrollToBottom(): number {
    const maxScrollTop = Math.max(0, this.state.totalHeight - this.config.containerHeight);
    this.setScrollTop(maxScrollTop);
    return maxScrollTop;
  }

  scrollToIndex(index: number): void {
    const scrollTop = index * this.config.itemHeight;
    this.setScrollTop(scrollTop);
  }

  updateConfig(config: Partial<VirtualScrollConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateState();
  }

  getConfig(): VirtualScrollConfig {
    return { ...this.config };
  }
}