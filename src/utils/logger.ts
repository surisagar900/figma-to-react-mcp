export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  meta?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  private readonly bufferSize = 100;
  private logBuffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly enableBuffering: boolean;

  private constructor(logLevel: LogLevel = "info", enableBuffering = false) {
    this.logLevel = logLevel;
    this.enableBuffering = enableBuffering;
  }

  static getInstance(logLevel?: LogLevel, enableBuffering = false): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(logLevel, enableBuffering);
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : "";
    return `[${timestamp}] [${entry.level.toUpperCase()}] ${
      entry.message
    }${metaStr}`;
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      meta,
    };

    if (this.enableBuffering) {
      this.logBuffer.push(entry);
      if (this.logBuffer.length >= this.bufferSize) {
        this.flush();
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), 1000);
      }
    } else {
      this.writeLog(entry);
    }
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.formatMessage(entry);
    switch (entry.level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
    }
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.logBuffer.forEach((entry) => this.writeLog(entry));
    this.logBuffer = [];
  }

  debug(message: string, meta?: any): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: any): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: any): void {
    this.log("error", message, meta);
  }

  success(message: string, meta?: any): void {
    if (this.shouldLog("info")) {
      const entry: LogEntry = {
        level: "info",
        message: `✅ ${message}`,
        timestamp: Date.now(),
        meta,
      };
      this.writeLog(entry);
    }
  }

  // Force flush remaining logs (useful for shutdown)
  forceFlush(): void {
    if (this.enableBuffering && this.logBuffer.length > 0) {
      this.flush();
    }
  }
}
