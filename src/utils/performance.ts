import { Logger } from "./logger.js";

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart?: NodeJS.MemoryUsage;
  memoryEnd?: NodeJS.MemoryUsage;
  metadata?: Record<string, any>;
}

interface AggregatedMetrics {
  totalExecutions: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastExecution: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = new Map<string, PerformanceMetric>();
  private aggregatedMetrics = new Map<string, AggregatedMetrics>();
  private logger: Logger;
  private readonly maxMetrics = 1000; // Prevent memory leaks

  private constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(name: string, metadata?: Record<string, any>): string {
    const id = `${name}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.metrics.set(id, {
      name,
      startTime: performance.now(),
      memoryStart: process.memoryUsage(),
      metadata,
    });

    return id;
  }

  endTiming(id: string): PerformanceMetric | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      this.logger.warn(`Performance metric not found: ${id}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    const memoryEnd = process.memoryUsage();

    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration,
      memoryEnd,
    };

    this.metrics.set(id, completedMetric);
    this.updateAggregatedMetrics(metric.name, duration);

    // Clean up old metrics to prevent memory leaks
    if (this.metrics.size > this.maxMetrics) {
      this.cleanupOldMetrics();
    }

    return completedMetric;
  }

  measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const id = this.startTiming(name, metadata);

      try {
        const result = await fn();
        const metric = this.endTiming(id);

        if (metric && metric.duration) {
          this.logger.debug(
            `${name} completed in ${metric.duration.toFixed(2)}ms`
          );
        }

        resolve(result);
      } catch (error) {
        this.endTiming(id);
        this.logger.error(`${name} failed`, error);
        reject(error);
      }
    });
  }

  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.startTiming(name, metadata);

    try {
      const result = fn();
      const metric = this.endTiming(id);

      if (metric && metric.duration) {
        this.logger.debug(
          `${name} completed in ${metric.duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      this.endTiming(id);
      this.logger.error(`${name} failed`, error);
      throw error;
    }
  }

  getMetric(id: string): PerformanceMetric | undefined {
    return this.metrics.get(id);
  }

  getAggregatedMetrics(
    name?: string
  ): Map<string, AggregatedMetrics> | AggregatedMetrics | undefined {
    if (name) {
      return this.aggregatedMetrics.get(name);
    }
    return this.aggregatedMetrics;
  }

  getTopSlowOperations(
    limit = 10
  ): Array<{ name: string; metrics: AggregatedMetrics }> {
    return Array.from(this.aggregatedMetrics.entries())
      .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
      .slice(0, limit)
      .map(([name, metrics]) => ({ name, metrics }));
  }

  logPerformanceSummary(): void {
    const summary = this.generatePerformanceSummary();
    this.logger.info("Performance Summary", summary);
  }

  private updateAggregatedMetrics(name: string, duration: number): void {
    const existing = this.aggregatedMetrics.get(name);

    if (existing) {
      existing.totalExecutions++;
      existing.totalDuration += duration;
      existing.averageDuration =
        existing.totalDuration / existing.totalExecutions;
      existing.minDuration = Math.min(existing.minDuration, duration);
      existing.maxDuration = Math.max(existing.maxDuration, duration);
      existing.lastExecution = Date.now();
    } else {
      this.aggregatedMetrics.set(name, {
        totalExecutions: 1,
        averageDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        totalDuration: duration,
        lastExecution: Date.now(),
      });
    }
  }

  private cleanupOldMetrics(): void {
    const now = performance.now();
    const oneHourAgo = now - 60 * 60 * 1000; // 1 hour in milliseconds

    for (const [id, metric] of this.metrics.entries()) {
      if (metric.startTime < oneHourAgo) {
        this.metrics.delete(id);
      }
    }
  }

  private generatePerformanceSummary(): Record<string, any> {
    const totalOperations = Array.from(this.aggregatedMetrics.values()).reduce(
      (sum, metrics) => sum + metrics.totalExecutions,
      0
    );

    const slowestOperations = this.getTopSlowOperations(5);

    return {
      totalOperations,
      uniqueOperations: this.aggregatedMetrics.size,
      slowestOperations: slowestOperations.map(({ name, metrics }) => ({
        name,
        averageDuration: `${metrics.averageDuration.toFixed(2)}ms`,
        totalExecutions: metrics.totalExecutions,
      })),
      memoryUsage: this.getMemoryUsage(),
    };
  }

  private getMemoryUsage(): Record<string, string> {
    const usage = process.memoryUsage();
    return {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  clear(): void {
    this.metrics.clear();
    this.aggregatedMetrics.clear();
  }
}

// Decorator for measuring method performance
export function measurePerformance(name?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const monitor = PerformanceMonitor.getInstance();
    const metricName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      if (method.constructor.name === "AsyncFunction") {
        return monitor.measureAsync(metricName, () => method.apply(this, args));
      } else {
        return monitor.measureSync(metricName, () => method.apply(this, args));
      }
    };

    return descriptor;
  };
}
