import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceMonitorService } from '../common/monitoring/performance-monitor.service';
import { QueueService } from '../queue/queue.service';
import { AiModelPoolService } from '../ai/ai-model-pool.service';
import { OptimizedFileIOService } from '../common/services/optimized-file-io.service';

@Controller('api/monitoring')
export class MonitoringController {
  constructor(
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly queueService: QueueService,
    private readonly aiModelPool: AiModelPoolService,
    private readonly optimizedFileIO: OptimizedFileIOService,
  ) {}

  /**
   * Get overall performance metrics
   */
  @Get('performance')
  async getPerformanceMetrics(@Query('timeWindow') timeWindow?: string) {
    const timeWindowMs = timeWindow ? parseInt(timeWindow) : undefined;

    return {
      timestamp: Date.now(),
      summaries:
        this.performanceMonitor.getAllPerformanceSummaries(timeWindowMs),
      systemMetrics: this.performanceMonitor.getCurrentSystemMetrics(),
      queueMetrics:
        this.performanceMonitor.getQueuePerformanceMetrics(timeWindowMs),
    };
  }

  /**
   * Get specific operation performance
   */
  @Get('performance/:operation')
  async getOperationPerformance(
    @Query('operation') operation: string,
    @Query('timeWindow') timeWindow?: string,
    @Query('limit') limit?: string,
  ) {
    const timeWindowMs = timeWindow ? parseInt(timeWindow) : undefined;
    const limitNum = limit ? parseInt(limit) : undefined;

    return {
      timestamp: Date.now(),
      operation,
      summary: this.performanceMonitor.getPerformanceSummary(
        operation,
        timeWindowMs,
      ),
      metrics: this.performanceMonitor.getOperationMetrics(operation, limitNum),
    };
  }

  /**
   * Get queue statistics and performance
   */
  @Get('queue')
  async getQueueMetrics() {
    const queueStats = await this.queueService.getQueueStats();
    const queuePerformance =
      this.performanceMonitor.getQueuePerformanceMetrics();

    return {
      timestamp: Date.now(),
      statistics: queueStats,
      performance: queuePerformance,
    };
  }

  /**
   * Get AI model pool statistics
   */
  @Get('ai-pool')
  async getAiPoolMetrics() {
    return {
      timestamp: Date.now(),
      poolStats: this.aiModelPool.getPoolStats(),
    };
  }

  /**
   * Get PDF conversion concurrency statistics
   */
  @Get('concurrency-stats')
  async getConcurrencyStats() {
    return {
      timestamp: Date.now(),
      ...this.aiModelPool.getConcurrencyStats(),
    };
  }

  /**
   * Get PDF conversion queue information
   */
  @Get('queue-info')
  async getQueueInfo() {
    return {
      timestamp: Date.now(),
      ...this.aiModelPool.getQueueInfo(),
    };
  }

  /**
   * Get file I/O statistics
   */
  @Get('file-io')
  async getFileIOMetrics() {
    return {
      timestamp: Date.now(),
      ioStats: this.optimizedFileIO.getIOStats(),
    };
  }

  /**
   * Get comprehensive system health
   */
  @Get('health')
  async getSystemHealth() {
    const systemMetrics = this.performanceMonitor.getCurrentSystemMetrics();
    const queueStats = await this.queueService.getQueueStats();
    const poolStats = this.aiModelPool.getPoolStats();
    const ioStats = this.optimizedFileIO.getIOStats();

    // Calculate health scores
    const memoryHealth = 100 - systemMetrics.memory.heapUtilization;
    const queueHealth =
      queueStats.active < 8
        ? 100
        : Math.max(0, 100 - (queueStats.active - 8) * 10);
    const poolHealth =
      poolStats.utilizationRate < 80
        ? 100
        : Math.max(0, 100 - (poolStats.utilizationRate - 80));
    const ioHealth =
      ioStats.utilizationRate < 70
        ? 100
        : Math.max(0, 100 - (ioStats.utilizationRate - 70));

    const overallHealth = Math.round(
      (memoryHealth + queueHealth + poolHealth + ioHealth) / 4,
    );

    return {
      timestamp: Date.now(),
      overallHealth,
      status:
        overallHealth > 80
          ? 'healthy'
          : overallHealth > 60
            ? 'warning'
            : 'critical',
      components: {
        memory: {
          health: Math.round(memoryHealth),
          status:
            memoryHealth > 80
              ? 'healthy'
              : memoryHealth > 60
                ? 'warning'
                : 'critical',
          metrics: systemMetrics.memory,
        },
        queue: {
          health: Math.round(queueHealth),
          status:
            queueHealth > 80
              ? 'healthy'
              : queueHealth > 60
                ? 'warning'
                : 'critical',
          metrics: queueStats,
        },
        aiPool: {
          health: Math.round(poolHealth),
          status:
            poolHealth > 80
              ? 'healthy'
              : poolHealth > 60
                ? 'warning'
                : 'critical',
          metrics: poolStats,
        },
        fileIO: {
          health: Math.round(ioHealth),
          status:
            ioHealth > 80 ? 'healthy' : ioHealth > 60 ? 'warning' : 'critical',
          metrics: ioStats,
        },
      },
    };
  }

  /**
   * Reset performance metrics (for testing)
   */
  @Get('reset')
  async resetMetrics() {
    this.performanceMonitor.resetMetrics();
    return {
      timestamp: Date.now(),
      message: 'Performance metrics have been reset',
    };
  }
}
