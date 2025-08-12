import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ScannedPdfPerformanceMonitorService } from './performance-monitor.service';

describe('ScannedPdfPerformanceMonitorService', () => {
  let service: ScannedPdfPerformanceMonitorService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScannedPdfPerformanceMonitorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'PERF_MEMORY_WARNING_MB': 256,
                'PERF_MEMORY_CRITICAL_MB': 512,
                'PERF_PROCESSING_WARNING_MS': 10000,
                'PERF_PROCESSING_CRITICAL_MS': 20000,
                'PERF_TEMP_FILES_WARNING': 25,
                'PERF_TEMP_FILES_CRITICAL': 50,
                'PERF_ERROR_RATE_WARNING': 5,
                'PERF_ERROR_RATE_CRITICAL': 15,
                'PERF_MEMORY_CHECK_INTERVAL_MS': 5000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ScannedPdfPerformanceMonitorService>(ScannedPdfPerformanceMonitorService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordProcessingTime', () => {
    it('should record processing time without alerts for normal duration', () => {
      const sessionId = 'test-session-1';
      const duration = 5000; // 5 seconds - normal

      service.recordProcessingTime(sessionId, duration);

      const stats = service.getProcessingTimeStats();
      expect(stats.count).toBe(1);
      expect(stats.average).toBe(duration);
      expect(stats.min).toBe(duration);
      expect(stats.max).toBe(duration);
    });

    it('should generate warning alert for high processing time', () => {
      const sessionId = 'test-session-2';
      const duration = 15000; // 15 seconds - warning threshold

      service.recordProcessingTime(sessionId, duration);

      const alerts = service.getRecentAlerts(1);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('processing_time');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].sessionId).toBe(sessionId);
    });

    it('should generate critical alert for very high processing time', () => {
      const sessionId = 'test-session-3';
      const duration = 25000; // 25 seconds - critical threshold

      service.recordProcessingTime(sessionId, duration);

      const alerts = service.getRecentAlerts(1);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('processing_time');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].value).toBe(duration);
    });
  });

  describe('recordTempFileOperation', () => {
    it('should track temp file creation', () => {
      service.recordTempFileOperation('create', 5);

      const dashboard = service.getPerformanceDashboard();
      expect(dashboard.tempFiles.createOperations).toBeGreaterThan(0);
    });

    it('should track temp file cleanup', () => {
      service.recordTempFileOperation('create', 10);
      service.recordTempFileOperation('cleanup', 5);

      const dashboard = service.getPerformanceDashboard();
      expect(dashboard.tempFiles.cleanupOperations).toBeGreaterThan(0);
    });

    it('should generate alert when temp file count exceeds threshold', () => {
      // Create many temp files to exceed warning threshold
      service.recordTempFileOperation('create', 30);

      const alerts = service.getAlertsByType('temp_files');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');
    });
  });

  describe('getCurrentMemoryUsage', () => {
    it('should return current memory usage', () => {
      const memoryUsage = service.getCurrentMemoryUsage();

      expect(memoryUsage).toHaveProperty('rss');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('arrayBuffers');
      expect(typeof memoryUsage.rss).toBe('number');
      expect(memoryUsage.rss).toBeGreaterThan(0);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', () => {
      const stats = service.getMemoryStats();

      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('peak');
      expect(stats).toHaveProperty('snapshots');
      expect(typeof stats.snapshots).toBe('number');
    });
  });

  describe('getProcessingTimeStats', () => {
    it('should return empty stats when no processing times recorded', () => {
      const stats = service.getProcessingTimeStats();

      expect(stats.count).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('should calculate correct statistics for multiple processing times', () => {
      const durations = [1000, 2000, 3000, 4000, 5000];
      durations.forEach((duration, index) => {
        service.recordProcessingTime(`session-${index}`, duration);
      });

      const stats = service.getProcessingTimeStats();
      expect(stats.count).toBe(5);
      expect(stats.average).toBe(3000);
      expect(stats.median).toBe(3000);
      expect(stats.min).toBe(1000);
      expect(stats.max).toBe(5000);
    });
  });

  describe('getRecentAlerts', () => {
    it('should return recent alerts in reverse chronological order', () => {
      // Generate multiple alerts
      service.recordProcessingTime('session-1', 15000); // Warning
      service.recordProcessingTime('session-2', 25000); // Critical
      service.recordTempFileOperation('create', 30); // Warning

      const alerts = service.getRecentAlerts(3);
      expect(alerts.length).toBeGreaterThan(0);
      
      // Should be in reverse chronological order (newest first)
      if (alerts.length > 1) {
        expect(alerts[0].timestamp.getTime()).toBeGreaterThanOrEqual(
          alerts[1].timestamp.getTime()
        );
      }
    });

    it('should limit results to requested count', () => {
      // Generate multiple alerts
      for (let i = 0; i < 5; i++) {
        service.recordProcessingTime(`session-${i}`, 15000);
      }

      const alerts = service.getRecentAlerts(3);
      expect(alerts.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getAlertsByType', () => {
    it('should filter alerts by type', () => {
      service.recordProcessingTime('session-1', 15000); // processing_time alert
      service.recordTempFileOperation('create', 30); // temp_files alert

      const processingAlerts = service.getAlertsByType('processing_time');
      const tempFileAlerts = service.getAlertsByType('temp_files');

      expect(processingAlerts.every(alert => alert.type === 'processing_time')).toBe(true);
      expect(tempFileAlerts.every(alert => alert.type === 'temp_files')).toBe(true);
    });

    it('should filter alerts by severity', () => {
      service.recordProcessingTime('session-1', 15000); // Warning
      service.recordProcessingTime('session-2', 25000); // Critical

      const criticalAlerts = service.getAlertsByType(undefined, 'critical');
      const warningAlerts = service.getAlertsByType(undefined, 'warning');

      expect(criticalAlerts.every(alert => alert.severity === 'critical')).toBe(true);
      expect(warningAlerts.every(alert => alert.severity === 'warning')).toBe(true);
    });
  });

  describe('getPerformanceDashboard', () => {
    it('should return comprehensive dashboard data', () => {
      // Generate some test data
      service.recordProcessingTime('session-1', 5000);
      service.recordTempFileOperation('create', 5);

      const dashboard = service.getPerformanceDashboard();

      expect(dashboard).toHaveProperty('memory');
      expect(dashboard).toHaveProperty('processingTimes');
      expect(dashboard).toHaveProperty('tempFiles');
      expect(dashboard).toHaveProperty('alerts');
      expect(dashboard).toHaveProperty('thresholds');

      expect(dashboard.memory).toHaveProperty('current');
      expect(dashboard.memory).toHaveProperty('average');
      expect(dashboard.memory).toHaveProperty('peak');

      expect(dashboard.processingTimes).toHaveProperty('count');
      expect(dashboard.processingTimes).toHaveProperty('average');

      expect(dashboard.tempFiles).toHaveProperty('current');
      expect(dashboard.tempFiles).toHaveProperty('recentOperations');

      expect(dashboard.alerts).toHaveProperty('total');
      expect(dashboard.alerts).toHaveProperty('critical');
      expect(dashboard.alerts).toHaveProperty('warnings');
    });
  });

  describe('forceGarbageCollection', () => {
    it('should return false when gc is not available', () => {
      // Ensure global.gc is not available
      const originalGc = global.gc;
      delete global.gc;

      const result = service.forceGarbageCollection();
      expect(result).toBe(false);

      // Restore original gc if it existed
      if (originalGc) {
        global.gc = originalGc;
      }
    });

    it('should return true when gc is available', () => {
      // Mock global.gc
      global.gc = jest.fn();

      const result = service.forceGarbageCollection();
      expect(result).toBe(true);
      expect(global.gc).toHaveBeenCalled();
    });
  });
});