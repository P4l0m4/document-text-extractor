import { Injectable, Logger } from '@nestjs/common';

export interface RequestMetrics {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  peakConcurrentRequests: number;
  requestsPerMinute: number;
  lastRequestTime: string | null;
}

export interface ProcessingMetrics {
  activeProcessingTasks: number;
  completedProcessingTasks: number;
  failedProcessingTasks: number;
  averageProcessingTime: number;
  queueSize: number;
  peakQueueSize: number;
}

interface RequestEntry {
  timestamp: number;
  duration?: number;
  status: 'active' | 'completed' | 'failed';
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // Request tracking
  private requests: Map<string, RequestEntry> = new Map();
  private completedRequests: RequestEntry[] = [];
  private readonly maxCompletedRequests = 1000;

  // Processing tracking
  private activeProcessingTasks = 0;
  private completedProcessingTasks = 0;
  private failedProcessingTasks = 0;
  private processingTimes: number[] = [];
  private currentQueueSize = 0;
  private peakQueueSize = 0;

  // Concurrent request tracking
  private peakConcurrentRequests = 0;

  // Request metrics methods
  startRequest(requestId: string): void {
    const entry: RequestEntry = {
      timestamp: Date.now(),
      status: 'active',
    };

    this.requests.set(requestId, entry);

    // Update peak concurrent requests
    const currentActive = this.getActiveRequestCount();
    if (currentActive > this.peakConcurrentRequests) {
      this.peakConcurrentRequests = currentActive;
      this.logger.log(
        `New peak concurrent requests: ${this.peakConcurrentRequests}`,
      );
    }
  }

  completeRequest(requestId: string): void {
    const entry = this.requests.get(requestId);
    if (entry) {
      const duration = Date.now() - entry.timestamp;
      entry.duration = duration;
      entry.status = 'completed';

      this.requests.delete(requestId);
      this.addCompletedRequest({ ...entry });
    }
  }

  failRequest(requestId: string): void {
    const entry = this.requests.get(requestId);
    if (entry) {
      const duration = Date.now() - entry.timestamp;
      entry.duration = duration;
      entry.status = 'failed';

      this.requests.delete(requestId);
      this.addCompletedRequest({ ...entry });
    }
  }

  // Processing metrics methods
  startProcessingTask(): void {
    this.activeProcessingTasks++;
  }

  completeProcessingTask(processingTime: number): void {
    this.activeProcessingTasks = Math.max(0, this.activeProcessingTasks - 1);
    this.completedProcessingTasks++;
    this.addProcessingTime(processingTime);
  }

  failProcessingTask(processingTime?: number): void {
    this.activeProcessingTasks = Math.max(0, this.activeProcessingTasks - 1);
    this.failedProcessingTasks++;
    if (processingTime) {
      this.addProcessingTime(processingTime);
    }
  }

  updateQueueSize(size: number): void {
    this.currentQueueSize = size;
    if (size > this.peakQueueSize) {
      this.peakQueueSize = size;
      this.logger.log(`New peak queue size: ${this.peakQueueSize}`);
    }
  }

  // Getter methods
  getRequestMetrics(): RequestMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentRequests = this.completedRequests.filter(
      (req) => req.timestamp > oneMinuteAgo,
    );

    const completedWithDuration = this.completedRequests.filter(
      (req) => req.duration !== undefined && req.status === 'completed',
    );

    const averageResponseTime =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce(
            (sum, req) => sum + (req.duration || 0),
            0,
          ) / completedWithDuration.length
        : 0;

    const lastRequest =
      this.completedRequests.length > 0
        ? this.completedRequests[this.completedRequests.length - 1]
        : null;

    return {
      totalRequests: this.completedRequests.length + this.requests.size,
      activeRequests: this.requests.size,
      completedRequests: this.completedRequests.filter(
        (req) => req.status === 'completed',
      ).length,
      failedRequests: this.completedRequests.filter(
        (req) => req.status === 'failed',
      ).length,
      averageResponseTime: Math.round(averageResponseTime),
      peakConcurrentRequests: this.peakConcurrentRequests,
      requestsPerMinute: recentRequests.length,
      lastRequestTime: lastRequest
        ? new Date(lastRequest.timestamp).toISOString()
        : null,
    };
  }

  getProcessingMetrics(): ProcessingMetrics {
    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) /
          this.processingTimes.length
        : 0;

    return {
      activeProcessingTasks: this.activeProcessingTasks,
      completedProcessingTasks: this.completedProcessingTasks,
      failedProcessingTasks: this.failedProcessingTasks,
      averageProcessingTime: Math.round(averageProcessingTime),
      queueSize: this.currentQueueSize,
      peakQueueSize: this.peakQueueSize,
    };
  }

  getAllMetrics() {
    return {
      requests: this.getRequestMetrics(),
      processing: this.getProcessingMetrics(),
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  resetMetrics(): void {
    this.requests.clear();
    this.completedRequests.length = 0;
    this.activeProcessingTasks = 0;
    this.completedProcessingTasks = 0;
    this.failedProcessingTasks = 0;
    this.processingTimes.length = 0;
    this.currentQueueSize = 0;
    this.peakQueueSize = 0;
    this.peakConcurrentRequests = 0;

    this.logger.log('Metrics reset');
  }

  private getActiveRequestCount(): number {
    return this.requests.size;
  }

  private addCompletedRequest(entry: RequestEntry): void {
    this.completedRequests.push(entry);

    // Keep only the most recent entries
    if (this.completedRequests.length > this.maxCompletedRequests) {
      this.completedRequests = this.completedRequests.slice(
        -this.maxCompletedRequests,
      );
    }
  }

  private addProcessingTime(time: number): void {
    this.processingTimes.push(time);

    // Keep only the most recent processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }
  }
}
