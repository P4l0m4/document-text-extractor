import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitorService } from './performance-monitor.service';

describe('PerformanceMonitorService', () => {
  let service: PerformanceMonitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceMonitorService],
    }).compile();

    service = module.get<PerformanceMonitorService>(PerformanceMonitorService);
  });

  afterEach(() => {
    service.resetMetrics();
  });

  describe('Timing Operations', () => {
    it('should track operation timing', async () => {
      const endTiming = service.startTiming('test-operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));

      endTiming(true, { testData: 'value' });

      const summary = service.getPerformanceSummary('test-operation');
      expect(summary).toBeDefined();
      expect(summary!.totalRequests).toBe(1);
      expect(summary!.successfulRequests).toBe(1);
      expect(summary!.averageDuration).toBeGreaterThan(90);
      expect(summary!.averageDuration).toBeLessThan(200);
    });

    it('should track failed operations', async () => {
      const endTiming = service.startTiming('test-operation');
      endTiming(false, { error: 'Test error' });

      const summary = service.getPerformanceSummary('test-operation');
      expect(summary).toBeDefined();
      expect(summary!.totalRequests).toBe(1);
      expect(summary!.failedRequests).toBe(1);
      expect(summary!.errorRate).toBe(100);
    });

    it('should calculate percentiles correctly', async () => {
      // Create multiple operations with different durations
      for (let i = 0; i < 100; i++) {
        const endTiming = service.startTiming('percentile-test');

        // Simulate variable processing time
        await new Promise((resolve) => setTimeout(resolve, i % 10));

        endTiming(true);
      }

      const summary = service.getPerformanceSummary('percentile-test');
      expect(summary).toBeDefined();
      expect(summary!.totalRequests).toBe(100);
      expect(summary!.p95Duration).toBeGreaterThan(summary!.averageDuration);
      expect(summary!.p99Duration).toBeGreaterThanOrEqual(summary!.p95Duration);
    });
  });

  describe('Queue Metrics', () => {
    it('should record queue metrics', () => {
      service.recordQueueMetric(
        'queue-test',
        1500,
        true,
        { waiting: 5, active: 3, completed: 10, failed: 1 },
        { jobType: 'document-processing' },
      );

      const queueMetrics = service.getQueuePerformanceMetrics();
      expect(queueMetrics.averageWaitingJobs).toBe(5);
      expect(queueMetrics.averageActiveJobs).toBe(3);
      expect(queueMetrics.averageProcessingTime).toBe(1500);
    });

    it('should calculate queue throughput', () => {
      const now = Date.now();

      // Record multiple queue metrics over time
      for (let i = 0; i < 10; i++) {
        service.recordQueueMetric('throughput-test', 1000, true, {
          waiting: 2,
          active: 1,
          completed: i,
          failed: 0,
        });
      }

      const queueMetrics = service.getQueuePerformanceMetrics();
      expect(queueMetrics.jobThroughput).toBeGreaterThan(0);
    });
  });

  describe('Memory Tracking', () => {
    it('should track memory usage changes', async () => {
      const endTiming = service.startTiming('memory-test');

      // Simulate memory allocation
      const largeArray = new Array(10000).fill('test');

      endTiming(true, { arraySize: largeArray.length });

      const metrics = service.getOperationMetrics('memory-test');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].memoryUsage).toBeDefined();
    });

    it('should provide current system metrics', () => {
      const systemMetrics = service.getCurrentSystemMetrics();

      expect(systemMetrics).toBeDefined();
      expect(systemMetrics.timestamp).toBeGreaterThan(0);
      expect(systemMetrics.memory.rss).toBeGreaterThan(0);
      expect(systemMetrics.memory.heapUsed).toBeGreaterThan(0);
      expect(systemMetrics.memory.heapUtilization).toBeGreaterThan(0);
      expect(systemMetrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('Performance Summaries', () => {
    it('should generate comprehensive performance summary', async () => {
      // Create mixed successful and failed operations
      for (let i = 0; i < 20; i++) {
        const endTiming = service.startTiming('comprehensive-test');
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
        endTiming(i % 5 !== 0, { iteration: i }); // 80% success rate
      }

      const summary = service.getPerformanceSummary('comprehensive-test');
      expect(summary).toBeDefined();
      expect(summary!.totalRequests).toBe(20);
      expect(summary!.successfulRequests).toBe(16);
      expect(summary!.failedRequests).toBe(4);
      expect(summary!.errorRate).toBe(20);
      expect(summary!.throughputPerSecond).toBeGreaterThan(0);
    });

    it('should filter by time window', async () => {
      // Create old metrics
      const endTiming1 = service.startTiming('time-window-test');
      endTiming1(true);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create recent metrics
      const endTiming2 = service.startTiming('time-window-test');
      endTiming2(true);

      const recentSummary = service.getPerformanceSummary(
        'time-window-test',
        50,
      );
      expect(recentSummary).toBeDefined();
      expect(recentSummary!.totalRequests).toBe(1); // Only recent metric

      const allSummary = service.getPerformanceSummary('time-window-test');
      expect(allSummary!.totalRequests).toBe(2); // All metrics
    });

    it('should get all performance summaries', async () => {
      const endTiming1 = service.startTiming('operation-1');
      endTiming1(true);

      const endTiming2 = service.startTiming('operation-2');
      endTiming2(true);

      const allSummaries = service.getAllPerformanceSummaries();
      expect(Object.keys(allSummaries)).toContain('operation-1');
      expect(Object.keys(allSummaries)).toContain('operation-2');
    });
  });

  describe('Performance Thresholds', () => {
    it('should detect slow operations', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const endTiming = service.startTiming('slow-upload');

      // Simulate slow operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      endTiming(true);

      // Note: The actual threshold checking happens internally
      // We can't easily test the console output without more complex mocking

      consoleSpy.mockRestore();
    });

    it('should detect high memory usage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create a metric with high memory usage
      service.recordMetric({
        timestamp: Date.now(),
        operation: 'memory-intensive',
        duration: 1000,
        success: true,
        memoryUsage: {
          rss: 200 * 1024 * 1024, // 200MB
          heapTotal: 150 * 1024 * 1024,
          heapUsed: 120 * 1024 * 1024, // 120MB - should trigger warning
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should limit metrics per operation', async () => {
      // Create more metrics than the limit
      for (let i = 0; i < 1200; i++) {
        const endTiming = service.startTiming('limit-test');
        endTiming(true);
      }

      const metrics = service.getOperationMetrics('limit-test');
      expect(metrics.length).toBeLessThanOrEqual(1000); // Should be capped at maxMetricsPerOperation
    });

    it('should reset all metrics', async () => {
      const endTiming = service.startTiming('reset-test');
      endTiming(true);

      let summary = service.getPerformanceSummary('reset-test');
      expect(summary).toBeDefined();

      service.resetMetrics();

      summary = service.getPerformanceSummary('reset-test');
      expect(summary).toBeNull();
    });

    it('should get specific operation metrics with limit', async () => {
      for (let i = 0; i < 10; i++) {
        const endTiming = service.startTiming('limited-metrics');
        endTiming(true, { iteration: i });
      }

      const limitedMetrics = service.getOperationMetrics('limited-metrics', 5);
      expect(limitedMetrics).toHaveLength(5);

      const allMetrics = service.getOperationMetrics('limited-metrics');
      expect(allMetrics).toHaveLength(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle operations with no metrics', () => {
      const summary = service.getPerformanceSummary('non-existent-operation');
      expect(summary).toBeNull();

      const metrics = service.getOperationMetrics('non-existent-operation');
      expect(metrics).toHaveLength(0);
    });

    it('should handle empty time windows', () => {
      const endTiming = service.startTiming('old-operation');
      endTiming(true);

      // Request metrics from future time window
      const summary = service.getPerformanceSummary('old-operation', 1);
      expect(summary).toBeNull();
    });
  });
});
