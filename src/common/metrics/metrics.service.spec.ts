import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    service.resetMetrics();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('request tracking', () => {
    it('should track request start', () => {
      const requestId = 'test-request-1';
      service.startRequest(requestId);

      const metrics = service.getRequestMetrics();
      expect(metrics.activeRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should track request completion', () => {
      const requestId = 'test-request-1';
      service.startRequest(requestId);
      service.completeRequest(requestId);

      const metrics = service.getRequestMetrics();
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.completedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should track request failure', () => {
      const requestId = 'test-request-1';
      service.startRequest(requestId);
      service.failRequest(requestId);

      const metrics = service.getRequestMetrics();
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should track peak concurrent requests', () => {
      service.startRequest('req1');
      service.startRequest('req2');
      service.startRequest('req3');

      const metrics = service.getRequestMetrics();
      expect(metrics.peakConcurrentRequests).toBe(3);

      service.completeRequest('req1');
      const metricsAfter = service.getRequestMetrics();
      expect(metricsAfter.peakConcurrentRequests).toBe(3); // Peak should remain
    });

    it('should calculate average response time', () => {
      const requestId1 = 'test-request-1';
      const requestId2 = 'test-request-2';

      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      service.startRequest(requestId1);
      currentTime += 100; // 100ms later
      service.completeRequest(requestId1);

      service.startRequest(requestId2);
      currentTime += 200; // 200ms later
      service.completeRequest(requestId2);

      const metrics = service.getRequestMetrics();
      expect(metrics.averageResponseTime).toBe(150); // (100 + 200) / 2

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('processing tracking', () => {
    it('should track processing task start', () => {
      service.startProcessingTask();

      const metrics = service.getProcessingMetrics();
      expect(metrics.activeProcessingTasks).toBe(1);
    });

    it('should track processing task completion', () => {
      service.startProcessingTask();
      service.completeProcessingTask(2000);

      const metrics = service.getProcessingMetrics();
      expect(metrics.activeProcessingTasks).toBe(0);
      expect(metrics.completedProcessingTasks).toBe(1);
      expect(metrics.averageProcessingTime).toBe(2000);
    });

    it('should track processing task failure', () => {
      service.startProcessingTask();
      service.failProcessingTask(1500);

      const metrics = service.getProcessingMetrics();
      expect(metrics.activeProcessingTasks).toBe(0);
      expect(metrics.failedProcessingTasks).toBe(1);
      expect(metrics.averageProcessingTime).toBe(1500);
    });

    it('should track queue size and peak', () => {
      service.updateQueueSize(5);
      let metrics = service.getProcessingMetrics();
      expect(metrics.queueSize).toBe(5);
      expect(metrics.peakQueueSize).toBe(5);

      service.updateQueueSize(10);
      metrics = service.getProcessingMetrics();
      expect(metrics.queueSize).toBe(10);
      expect(metrics.peakQueueSize).toBe(10);

      service.updateQueueSize(3);
      metrics = service.getProcessingMetrics();
      expect(metrics.queueSize).toBe(3);
      expect(metrics.peakQueueSize).toBe(10); // Peak should remain
    });

    it('should calculate average processing time', () => {
      service.completeProcessingTask(1000);
      service.completeProcessingTask(2000);
      service.completeProcessingTask(3000);

      const metrics = service.getProcessingMetrics();
      expect(metrics.averageProcessingTime).toBe(2000); // (1000 + 2000 + 3000) / 3
    });
  });

  describe('requests per minute calculation', () => {
    it('should calculate requests per minute', () => {
      const originalDateNow = Date.now;
      let currentTime = 60000; // Start at 1 minute
      Date.now = jest.fn(() => currentTime);

      // Add some requests in the current minute
      service.startRequest('req1');
      service.completeRequest('req1');

      service.startRequest('req2');
      service.completeRequest('req2');

      const metrics = service.getRequestMetrics();
      expect(metrics.requestsPerMinute).toBe(2);

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('getAllMetrics', () => {
    it('should return comprehensive metrics', () => {
      service.startRequest('req1');
      service.startProcessingTask();
      service.updateQueueSize(3);

      const allMetrics = service.getAllMetrics();

      expect(allMetrics).toHaveProperty('requests');
      expect(allMetrics).toHaveProperty('processing');
      expect(allMetrics).toHaveProperty('system');

      expect(allMetrics.requests.activeRequests).toBe(1);
      expect(allMetrics.processing.activeProcessingTasks).toBe(1);
      expect(allMetrics.processing.queueSize).toBe(3);
      expect(allMetrics.system).toHaveProperty('uptime');
      expect(allMetrics.system).toHaveProperty('memoryUsage');
      expect(allMetrics.system).toHaveProperty('cpuUsage');
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Add some data
      service.startRequest('req1');
      service.startProcessingTask();
      service.updateQueueSize(5);

      // Reset
      service.resetMetrics();

      const requestMetrics = service.getRequestMetrics();
      const processingMetrics = service.getProcessingMetrics();

      expect(requestMetrics.activeRequests).toBe(0);
      expect(requestMetrics.totalRequests).toBe(0);
      expect(requestMetrics.peakConcurrentRequests).toBe(0);

      expect(processingMetrics.activeProcessingTasks).toBe(0);
      expect(processingMetrics.queueSize).toBe(0);
      expect(processingMetrics.peakQueueSize).toBe(0);
    });
  });
});
