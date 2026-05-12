// Logger Utility for better debugging
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
}

const LOG_LEVEL: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Temporarily set to debug to trace the full Privy login flow.
// Change back to LOG_LEVEL.warn when done debugging.
const MIN_LOG_LEVEL = LOG_LEVEL.debug;

// 用於去重：同一模塊同一條消息在短時間內只記錄一次
const DEDUP_MAP = new Map<string, number>();
const DEDUP_TIMEOUT = 1000; // 1 秒內去重

// 過濾掉 base64 數据，只顯示前10個字符
function sanitizeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // 檢查是否為 base64 或長字符串
    if (data.startsWith('data:image/')) {
      return '[Image Base64 - hidden]';
    }
    // 如果是超過 100 個字符的 base64 字符串，只顯示前 10 個字符
    if (data.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(data.substring(0, 100))) {
      return `${data.substring(0, 10)}... (${data.length} chars)`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        
        // 對所有字符串值進行統一檢測
        if (typeof value === 'string') {
          // 檢查是否為 Image Base64
          if (value.startsWith('data:image/')) {
            sanitized[key] = '[Image Base64 - hidden]';
            continue;
          }
          // 檢查是否為長 Base64 字符串（不限於特定 key 名稱）
          if (value.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(value.substring(0, 100))) {
            sanitized[key] = `${value.substring(0, 10)}... (${value.length} chars)`;
            continue;
          }
        }
        
        // 遞歸處理複雜類型
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }

  return data;
}

class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 200;

  static isDuplicate(module: string, message: string): boolean {
    const key = `${module}:${message}`;
    const now = Date.now();
    const lastTime = DEDUP_MAP.get(key) || 0;

    if (now - lastTime < DEDUP_TIMEOUT) {
      return true;
    }

    DEDUP_MAP.set(key, now);
    return false;
  }

  static shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL[level] >= MIN_LOG_LEVEL;
  }

  static log(module: string, message: string, data?: any, level: LogLevel = 'info') {
    // 檢查日誌級別是否應顯示
    if (!this.shouldLog(level)) {
      return;
    }

    // 檢查是否重複
    if (this.isDuplicate(module, message)) {
      return;
    }

    // 過濾掉 base64 圖片數據
    const sanitizedData = sanitizeData(data);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data: sanitizedData,
    };

    this.logs.push(entry);

    // Keep logs size manageable
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console with styling
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${module}]`;
    const logArgs = [prefix, message];
    if (sanitizedData !== undefined) {
      logArgs.push(sanitizedData);
    }

    switch (level) {
      case 'error':
        console.error(...logArgs);
        break;
      case 'warn':
        console.warn(...logArgs);
        break;
      case 'debug':
        if (__DEV__) {
          console.debug(...logArgs);
        }
        break;
      default:
        console.log(...logArgs);
    }
  }

  static debug(module: string, message: string, data?: any) {
    this.log(module, message, data, 'debug');
  }

  static info(module: string, message: string, data?: any) {
    this.log(module, message, data, 'info');
  }

  static warn(module: string, message: string, data?: any) {
    this.log(module, message, data, 'warn');
  }

  static error(module: string, message: string, data?: any) {
    this.log(module, message, data, 'error');
  }

  static getLogs(filter?: { module?: string; level?: LogLevel; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.module) {
      filtered = filtered.filter((log) => log.module === filter.module);
    }

    if (filter?.level) {
      filtered = filtered.filter((log) => log.level === filter.level);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  static clearLogs() {
    this.logs = [];
    DEDUP_MAP.clear();
  }

  static exportLogs(): string {
    return this.logs
      .map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.module}: ${log.message} ${log.data ? JSON.stringify(log.data) : ''}`)
      .join('\n');
  }
}

export default Logger;
