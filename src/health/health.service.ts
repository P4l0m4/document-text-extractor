import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessingLoggerService } from '../common/logging/processing-logger.service';
import { MetricsService } from '../common/metrics/metrics.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
  };
  metrics: {
    activeConnections: number;
    totalRequests: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    cpuUsage: NodeJS.CpuUsage;
    processing: {
      activeProcessingTasks: number;
      completedProcessingTasks: number;
      failedProcessingTasks: number;
      averageProcessingTime: number;
      queueSize: number;
    };
    requests: {
      requestsPerMinute: number;
      averageResponseTime: number;
      peakConcurrentRequests: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private startTime = Date.now();
  private totalRequests = 0;
  private activeConnections = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly processingLogger: ProcessingLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  incrementRequestCount(): void {
    this.totalRequests++;
  }

  incrementActiveConnections(): void {
    this.activeConnections++;
  }

  decrementActiveConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const checks = await this.performHealthChecks();
      const metrics = this.getMetrics();

      const overallStatus = Object.values(checks).every(
        (check) => check.status === 'ok',
      )
        ? 'ok'
        : 'error';

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0',
        environment: this.configService.get<string>('NODE_ENV', 'development'),
        checks,
        metrics,
      };

      this.logger.log(
        `Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus}`,
      );

      return healthStatus;
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  async getReadinessStatus(): Promise<{ status: string; message: string }> {
    try {
      const checks = await this.performHealthChecks();
      const isReady = Object.values(checks).every(
        (check) => check.status === 'ok',
      );

      return {
        status: isReady ? 'ready' : 'not ready',
        message: isReady
          ? 'Service is ready to accept requests'
          : 'Service is not ready',
      };
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      return {
        status: 'not ready',
        message: 'Readiness check failed',
      };
    }
  }

  async getLivenessStatus(): Promise<{ status: string; message: string }> {
    try {
      // Basic liveness check - if we can respond, we're alive
      return {
        status: 'alive',
        message: 'Service is alive and responding',
      };
    } catch (error) {
      this.logger.error('Liveness check failed', error);
      return {
        status: 'dead',
        message: 'Service is not responding',
      };
    }
  }

  private async performHealthChecks(): Promise<HealthStatus['checks']> {
    const checks: HealthStatus['checks'] = {};

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB threshold
    checks.memory = {
      status: memoryUsage.heapUsed < memoryThreshold ? 'ok' : 'error',
      message: `Heap used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      responseTime: 0,
    };

    // Disk space check (basic)
    try {
      const stats = await import('fs').then((fs) =>
        fs.promises.stat(process.cwd()),
      );
      checks.filesystem = {
        status: 'ok',
        message: 'Filesystem accessible',
        responseTime: 0,
      };
    } catch (error) {
      checks.filesystem = {
        status: 'error',
        message: 'Filesystem check failed',
        responseTime: 0,
      };
    }

    // Process check
    checks.process = {
      status: 'ok',
      message: `PID: ${process.pid}, Uptime: ${Math.round(process.uptime())}s`,
      responseTime: 0,
    };

    return checks;
  }

  private getMetrics() {
    const requestMetrics = this.metricsService.getRequestMetrics();
    const processingMetrics = this.metricsService.getProcessingMetrics();

    return {
      activeConnections: this.activeConnections,
      totalRequests: this.totalRequests,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      processing: {
        activeProcessingTasks: processingMetrics.activeProcessingTasks,
        completedProcessingTasks: processingMetrics.completedProcessingTasks,
        failedProcessingTasks: processingMetrics.failedProcessingTasks,
        averageProcessingTime: processingMetrics.averageProcessingTime,
        queueSize: processingMetrics.queueSize,
      },
      requests: {
        requestsPerMinute: requestMetrics.requestsPerMinute,
        averageResponseTime: requestMetrics.averageResponseTime,
        peakConcurrentRequests: requestMetrics.peakConcurrentRequests,
      },
    };
  }
}
