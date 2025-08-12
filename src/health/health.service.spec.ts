import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { ProcessingLoggerService } from '../common/logging/processing-logger.service';
import { MetricsService } from '../common/metrics/metrics.service';

describe('HealthService', () => {
  let service: HealthService;
  let configService: ConfigService;
  let processingLogger: ProcessingLoggerService;
  let metricsService: MetricsService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockProcessingLogger = {
    getProcessingStats: jest.fn(),
  };

  const mockMetricsService = {
    getRequestMetrics: jest.fn(),
    getProcessingMetrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ProcessingLoggerService,
          useValue: mockProcessingLogger,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    configService = module.get<ConfigService>(ConfigService);
    processingLogger = module.get<ProcessingLoggerService>(
      ProcessingLoggerService,
    );
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return comprehensive health status', async () => {
      mockConfigService.get.mockReturnValue('test');
      mockMetricsService.getRequestMetrics.mockReturnValue({
        requestsPerMinute: 10,
        averageResponseTime: 100,
        peakConcurrentRequests: 5,
      });
      mockMetricsService.getProcessingMetrics.mockReturnValue({
        activeProcessingTasks: 2,
        completedProcessingTasks: 10,
        failedProcessingTasks: 1,
        averageProcessingTime: 2000,
        queueSize: 3,
      });

      const result = await service.getHealthStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('metrics');

      expect(result.checks).toHaveProperty('memory');
      expect(result.checks).toHaveProperty('filesystem');
      expect(result.checks).toHaveProperty('process');

      expect(result.metrics).toHaveProperty('processing');
      expect(result.metrics).toHaveProperty('requests');
      expect(result.metrics.processing.activeProcessingTasks).toBe(2);
      expect(result.metrics.requests.requestsPerMinute).toBe(10);
    });

    it('should return error status when checks fail', async () => {
      mockConfigService.get.mockReturnValue('test');
      mockMetricsService.getRequestMetrics.mockReturnValue({
        requestsPerMinute: 0,
        averageResponseTime: 0,
        peakConcurrentRequests: 0,
      });
      mockMetricsService.getProcessingMetrics.mockReturnValue({
        activeProcessingTasks: 0,
        completedProcessingTasks: 0,
        failedProcessingTasks: 0,
        averageProcessingTime: 0,
        queueSize: 0,
      });

      // Mock high memory usage to trigger error
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 1024 * 1024 * 1024 * 2, // 2GB
        heapTotal: 1024 * 1024 * 1024 * 2,
        heapUsed: 1024 * 1024 * 1024 * 2, // 2GB heap used (over 1GB threshold)
        external: 0,
        arrayBuffers: 0,
      });

      const result = await service.getHealthStatus();

      expect(result.status).toBe('error');
      expect(result.checks.memory.status).toBe('error');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('getReadinessStatus', () => {
    it('should return ready when all checks pass', async () => {
      mockMetricsService.getRequestMetrics.mockReturnValue({
        requestsPerMinute: 0,
        averageResponseTime: 0,
        peakConcurrentRequests: 0,
      });
      mockMetricsService.getProcessingMetrics.mockReturnValue({
        activeProcessingTasks: 0,
        completedProcessingTasks: 0,
        failedProcessingTasks: 0,
        averageProcessingTime: 0,
        queueSize: 0,
      });

      const result = await service.getReadinessStatus();

      expect(result.status).toBe('ready');
      expect(result.message).toBe('Service is ready to accept requests');
    });

    it('should return not ready when checks fail', async () => {
      // Mock filesystem error
      jest
        .spyOn(require('fs').promises, 'stat')
        .mockRejectedValue(new Error('Filesystem error'));

      const result = await service.getReadinessStatus();

      expect(result.status).toBe('not ready');
      expect(result.message).toBe('Service is not ready');
    });
  });

  describe('getLivenessStatus', () => {
    it('should return alive status', async () => {
      const result = await service.getLivenessStatus();

      expect(result.status).toBe('alive');
      expect(result.message).toBe('Service is alive and responding');
    });
  });

  describe('request tracking', () => {
    it('should track request count', () => {
      const initialCount = service['totalRequests'];
      service.incrementRequestCount();
      expect(service['totalRequests']).toBe(initialCount + 1);
    });

    it('should track active connections', () => {
      const initialConnections = service['activeConnections'];

      service.incrementActiveConnections();
      expect(service['activeConnections']).toBe(initialConnections + 1);

      service.decrementActiveConnections();
      expect(service['activeConnections']).toBe(initialConnections);
    });

    it('should not allow negative active connections', () => {
      service['activeConnections'] = 0;
      service.decrementActiveConnections();
      expect(service['activeConnections']).toBe(0);
    });
  });
});
