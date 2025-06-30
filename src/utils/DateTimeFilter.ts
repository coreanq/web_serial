import { LogEntry } from '../types';

export interface DateTimeRange {
  startDate?: Date;
  endDate?: Date;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
}

export interface FilterPreset {
  id: string;
  name: string;
  range: DateTimeRange;
}

export class DateTimeFilter {
  private static readonly PRESETS: FilterPreset[] = [
    {
      id: 'last-hour',
      name: 'Last Hour',
      range: {
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date()
      }
    },
    {
      id: 'last-4-hours',
      name: 'Last 4 Hours',
      range: {
        startDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        endDate: new Date()
      }
    },
    {
      id: 'today',
      name: 'Today',
      range: {
        startDate: new Date(new Date().setHours(0, 0, 0, 0)),
        endDate: new Date()
      }
    },
    {
      id: 'yesterday',
      name: 'Yesterday',
      range: {
        startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
        endDate: new Date(new Date().setHours(0, 0, 0, 0))
      }
    },
    {
      id: 'last-7-days',
      name: 'Last 7 Days',
      range: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }
    }
  ];

  static getPresets(): FilterPreset[] {
    return [...this.PRESETS];
  }

  static filterLogs(logs: LogEntry[], range: DateTimeRange): LogEntry[] {
    return logs.filter(log => this.isLogInRange(log, range));
  }

  private static isLogInRange(log: LogEntry, range: DateTimeRange): boolean {
    const logTime = log.timestamp;

    // Check date range
    if (range.startDate && logTime < range.startDate) {
      return false;
    }
    if (range.endDate && logTime > range.endDate) {
      return false;
    }

    // Check time range (within the day)
    if (range.startTime || range.endTime) {
      const logTimeStr = this.formatTime(logTime);
      
      if (range.startTime && logTimeStr < range.startTime) {
        return false;
      }
      if (range.endTime && logTimeStr > range.endTime) {
        return false;
      }
    }

    return true;
  }

  private static formatTime(date: Date): string {
    return date.toTimeString().substring(0, 5); // HH:mm format
  }

  static createCustomRange(
    startDate?: Date,
    endDate?: Date,
    startTime?: string,
    endTime?: string
  ): DateTimeRange {
    return {
      startDate,
      endDate,
      startTime,
      endTime
    };
  }

  static validateRange(range: DateTimeRange): { valid: boolean; error?: string } {
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      return { valid: false, error: 'Start date must be before end date' };
    }

    if (range.startTime && range.endTime && range.startTime > range.endTime) {
      return { valid: false, error: 'Start time must be before end time' };
    }

    if (range.startTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(range.startTime)) {
      return { valid: false, error: 'Invalid start time format (use HH:mm)' };
    }

    if (range.endTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(range.endTime)) {
      return { valid: false, error: 'Invalid end time format (use HH:mm)' };
    }

    return { valid: true };
  }

  static formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static formatTimeForInput(date: Date): string {
    return date.toTimeString().substring(0, 5);
  }
}