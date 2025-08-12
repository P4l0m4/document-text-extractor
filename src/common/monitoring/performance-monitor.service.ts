import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetrics {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  memoryUsage?: NodeJS.MemoryUsage;
  queueStats?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  additionalData?: Record<string, any>;
}

export interface PerformanceSummary {
  operation: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  throughputPerSecond: number;
  errorRate: number;
  memoryTrend: {
    averageHeapUsed: number;
    peakHeapUsed: number;
    averageExternal: number;
  };
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly metrics: Map<string, PerformanceMetrics[]> = new Map();
  private readonly maxMetricsPerOperation = 1000; // Keep last 1000 metrics per operation
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old metrics every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 600000);
  }

  /**
   * Start timing an operation
   */
  startTiming(operation: string): () => void {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return (success: boolean = true, additionalData?: Record<string, any>) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const endMemory = process.memoryUsage();

      const metric: PerformanceMetrics = {
        timestamp: endTime,
        operation,
        duration,
        success,
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        additionalData,
      };

      this.recordMetric(metric);
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    if (!this.metrics.has(metric.operation)) {
      this.metrics.set(metric.operation, []);
    }

    const operationMetrics = this.metrics.get(metric.operation)!;
    operationMetrics.push(metric);

    // Keep only the most recent metrics
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.splice(
        0,
        operationMetrics.length - this.maxMetricsPerOperation,
      );
    }

    // Log performance warnings
    this.checkPerformanceThresholds(metric);
  }

  /**
   * Record queue statistics with a metric
   */
  recordQueueMetric(
    operation: string,
    duration: number,
    success: boolean,
    queueStats: PerformanceMetrics['queueStats'],
    additionalData?: Record<string, any>,
  ): void {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      memoryUsage: process.memoryUsage(),
      queueStats,
      additionalData,
    };

    this.recordMetric(metric);
  }

  /**
   * Get performance summary for an operation
   */
  getPerformanceSummary(
    operation: string,
    timeWindowMs?: number,
  ): PerformanceSummary | null {
    const operationMetrics = this.metrics.get(operation);
    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    // Filter by time window if specified
    const cutoffTime = timeWindowMs ? Date.now() - timeWindowMs : 0;
    const filteredMetrics = operationMetrics.filter(
      (m) => m.timestamp >= cutoffTime,
    );

    if (filteredMetrics.length === 0) {
      return null;
    }

    const durations = filteredMetrics
      .map((m) => m.duration)
      .sort((a, b) => a - b);
    const successfulRequests = filteredMetrics.filter((m) => m.success).length;
    const totalRequests = filteredMetrics.length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Calculate throughput (requests per second)
    const timeSpanMs =
      filteredMetrics[filteredMetrics.length - 1].timestamp -
      filteredMetrics[0].timestamp;
    const throughputPerSecond =
      timeSpanMs > 0 ? (totalRequests / timeSpanMs) * 1000 : 0;

    // Calculate memory trends
    const memoryMetrics = filteredMetrics
      .filter((m) => m.memoryUsage)
      .map((m) => m.memoryUsage!);

    const memoryTrend = {
      averageHeapUsed:
        memoryMetrics.length > 0
          ? memoryMetrics.reduce((sum, m) => sum + m.heapUsed, 0) /
            memoryMetrics.length
          : 0,
      peakHeapUsed:
        memoryMetrics.length > 0
          ? Math.max(...memoryMetrics.map((m) => m.heapUsed))
          : 0,
      averageExternal:
        memoryMetrics.length > 0
          ? memoryMetrics.reduce((sum, m) => sum + m.external, 0) /
            memoryMetrics.length
          : 0,
    };

    return {
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
      throughputPerSecond,
      errorRate: (failedRequests / totalRequests) * 100,
      memoryTrend,
    };
  }

  /**
   * Get all performance summaries
   */
  getAllPerformanceSummaries(
    timeWindowMs?: number,
  ): Record<string, PerformanceSummary> {
    const summaries: Record<string, PerformanceSummary> = {};

    for (const operation of this.metrics.keys()) {
      const summary = this.getPerformanceSummary(operation, timeWindowMs);
      if (summary) {
        summaries[operation] = summary;
      }
    }

    return summaries;
  }

  /**
   * Get current system metrics
   */
  getCurrentSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Get queue performance metrics
   */
  getQueuePerformanceMetrics(timeWindowMs: number = 300000): {
    averageWaitingJobs: number;
    averageActiveJobs: number;
    averageProcessingTime: number;
    jobThroughput: number;
    errorRate: number;
  } {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const cutoffTime = Date.now() - timeWindowMs;
    const queueMetrics = allMetrics.filter(
      (m) =>
        m.timestamp >= cutoffTime &&
        m.queueStats &&
        m.operation.includes('queue'),
    );

    if (queueMetrics.length === 0) {
      return {
        averageWaitingJobs: 0,
        averageActiveJobs: 0,
        averageProcessingTime: 0,
        jobThroughput: 0,
        errorRate: 0,
      };
    }

    const totalWaiting = queueMetrics.reduce(
      (sum, m) => sum + (m.queueStats?.waiting || 0),
      0,
    );
    const totalActive = queueMetrics.reduce(
      (sum, m) => sum + (m.queueStats?.active || 0),
      0,
    );
    const totalDuration = queueMetrics.reduce((sum, m) => sum + m.duration, 0);
    const failedJobs = queueMetrics.filter((m) => !m.success).length;

    const timeSpanMs =
      queueMetrics[queueMetrics.length - 1].timestamp -
      queueMetrics[0].timestamp;
    const jobThroughput =
      timeSpanMs > 0 ? (queueMetrics.length / timeSpanMs) * 1000 : 0;

    return {
      averageWaitingJobs: totalWaiting / queueMetrics.length,
      averageActiveJobs: totalActive / queueMetrics.length,
      averageProcessingTime: totalDuration / queueMetrics.length,
      jobThroughput,
      errorRate: (failedJobs / queueMetrics.length) * 100,
    };
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(metric: PerformanceMetrics): void {
    // Memory usage warnings
    if (metric.memoryUsage) {
      const heapUsedMB = metric.memoryUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 100) {
        // 100MB threshold
        this.logger.warn(
          `High memory usage detected for ${metric.operation}: ${heapUsedMB.toFixed(2)}MB heap used`,
        );
      }
    }

    // Duration warnings
    const thresholds = {
      upload: 5000, // 5 seconds
      processing: 30000, // 30 seconds
      queue: 1000, // 1 second
      'ai-extraction': 15000, // 15 seconds
      summarization: 10000, // 10 seconds
    };

    const threshold =
      Object.entries(thresholds).find(([key]) =>
        metric.operation.toLowerCase().includes(key),
      )?.[1] || 5000;

    if (metric.duration > threshold) {
      this.logger.warn(
        `Slow operation detected: ${metric.operation} took ${metric.duration}ms (threshold: ${threshold}ms)`,
      );
    }

    // Error rate warnings
    if (!metric.success) {
      this.logger.error(
        `Operation failed: ${metric.operation}`,
        metric.additionalData,
      );
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const [operation, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter((m) => m.timestamp >= cutoffTime);

      if (filteredMetrics.length === 0) {
        this.metrics.delete(operation);
      } else {
        this.metrics.set(operation, filteredMetrics);
      }
    }

    this.logger.debug('Cleaned up old performance metrics');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.logger.log('All performance metrics have been reset');
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string, limit?: number): PerformanceMetrics[] {
    const operationMetrics = this.metrics.get(operation) || [];
    return limit ? operationMetrics.slice(-limit) : operationMetrics;
  }

  /**
   * Cleanup on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
