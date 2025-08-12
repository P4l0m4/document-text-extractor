import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerformanceMonitorService } from '../src/ai/performance-monitor.service';
import { OptimizedTempFileService } from '../src/ai/optimized-temp-file.service';
import { MemoryOptimizerService } from '../src/ai/memory-optimizer.service';
import { MetricsDashboardService } from '../src/ai/metrics-dashboard.service';
import { ScannedPdfMetricsService } from '../src/ai/scanned-pdf-metrics.service';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Scanned PDF Performance Optimization (e2e)', () => {
  let app: INestApplication;
  let performanceMonitor: PerformanceMonitorService;
  let tempFileService: OptimizedTempFileService;
  let memoryOptimizer: MemoryOptimizerService;
  let metricsService: ScannedPdfMetricsService;
  let dashboardService: MetricsDashboardService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitorService,
        OptimizedTempFileService,
        MemoryOptimizerService,
        ScannedPdfMetricsService,
        MetricsDashboardService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                // Performance monitoring config
                'PERF_MEMORY_WARNING_MB': 128,
                'PERF_MEMORY_CRITICAL_MB': 256,
                'PERF_PROCESSING_WARNING_MS': 5000,
                'PERF_PROCESSING_CRITICAL_MS': 10000,
                'PERF_TEMP_FILES_WARNING': 10,
                'PERF_TEMP_FILES_CRITICAL': 20,
                'PERF_ERROR_RATE_WARNING': 5,
                'PERF_ERROR_RATE_CRITICAL': 15,
                'PERF_MEMORY_CHECK_INTERVAL_MS': 1000,

                // Temp file management config
                'TEMP_FILE_MAX_COUNT': 25,
                'TEMP_FILE_MAX_AGE_MS': 300000, // 5 minutes
                'TEMP_FILE_MAX_SIZE_MB': 50 * 1024 * 1024, // 50MB
                'TEMP_FILE_CLEANUP_INTERVAL_MS': 5000, // 5 seconds
                'TEMP_FILE_BATCH_CLEANUP_SIZE': 5,
                'TEMP_DIR': '/tmp/test-processing',

                // Memory optimization config
                'MEMORY_ENABLE_GC': true,
                'MEMORY_GC_THRESHOLD_MB': 64,
                'MEMORY_GC_INTERVAL_MS': 10000,
                'MEMORY_ENABLE_PRESSURE_DETECTION': true,
                'MEMORY_PRESSURE_THRESHOLD_MB': 128,
                'MEMORY_ENABLE_BUFFER_OPTIMIZATION': true,
                'MEMORY_MAX_BUFFER_SIZE_MB': 10,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    performanceMonitor = moduleFixture.get<PerformanceMonitorService>(PerformanceMonitorService);
    tempFileService = moduleFixture.get<OptimizedTempFileService>(OptimizedTempFileService);
    memoryOptimizer = moduleFixture.get<MemoryOptimizerService>(MemoryOptimizerService);
    metricsService = moduleFixture.get<ScannedPdfMetricsService>(ScannedPdfMetricsService);
    dashboardService = moduleFixture.get<MetricsDashboardService>(MetricsDashboardService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Performance Optimization Workflow', () => {
    it('should demonstrate end-to-end performance optimization for PDF processing', async () => {
      const sessionId = 'e2e-test-session';
      const testPdfPath = '/tmp/test-document.pdf';

      // Step 1: Start processing session
      const processingSessionId = metricsService.startProcessingSession(testPdfPath);
      expect(processingSessionId).toBeDefined();

      // Step 2: Pre-optimize memory for PDF processing
      const preOptimizationResult = await memoryOptimizer.optimizeForPdfConversion(sessionId);
      expect(preOptimizationResult.optimizationsApplied).toContain('image_buffers_preallocated');

      // Step 3: Simulate PDF-to-image conversion with temp file management
      const tempImagePath = tempFileService.createTempFilePath('.png', sessionId);
      expect(tempImagePath).toContain('.png');

      // Create a mock temp file
      await fs.mkdir(path.dirname(tempImagePath), { recursive: true });
      await fs.writeFile(tempImagePath, Buffer.alloc(1024 * 1024)); // 1MB mock image

      // Register temp file for tracking
      const tempFileId = await tempFileService.registerTempFile(tempImagePath, 'image', sessionId);
      expect(tempFileId).toBeDefined();

      // Record temp file creation
      performanceMonitor.recordTempFileOperation('create', 1, tempImagePath);

      // Step 4: Simulate OCR processing with optimized buffers
      const ocrBuffer = memoryOptimizer.getOptimizedBuffer(5 * 1024 * 1024, `ocr_${sessionId}`);
      expect(ocrBuffer).toBeInstanceOf(Buffer);
      expect(ocrBuffer.length).toBe(5 * 1024 * 1024);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Release OCR buffer
      memoryOptimizer.releaseBuffer(`ocr_${sessionId}`);

      // Step 5: Record processing metrics
      const processingTime = 3000; // 3 seconds
      performanceMonitor.recordProcessingTime(sessionId, processingTime);

      // Step 6: Complete processing session
      metricsService.completeProcessingSession(processingSessionId, {
        success: true,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 1500,
        confidence: 85,
        tempFilesCreated: 1,
      });

      // Step 7: Schedule temp file cleanup
      tempFileService.scheduleCleanup(tempFileId);

      // Step 8: Post-processing memory optimization
      const postOptimizationResult = await memoryOptimizer.optimizeAfterPdfConversion(sessionId);
      expect(postOptimizationResult.optimizationsApplied).toContain('image_cache_cleared');

      // Step 9: Verify performance metrics
      const performanceDashboard = performanceMonitor.getPerformanceDashboard();
      expect(performanceDashboard.processingTimes.count).toBeGreaterThan(0);
      expect(performanceDashboard.tempFiles.current).toBeGreaterThanOrEqual(0);

      // Step 10: Verify temp file stats
      const tempFileStats = tempFileService.getTempFileStats();
      expect(tempFileStats.scheduledForCleanup).toBeGreaterThan(0);

      // Step 11: Verify memory status
      const memoryStatus = memoryOptimizer.getMemoryStatus();
      expect(memoryStatus.usage).toHaveProperty('heapUsed');
      expect(memoryStatus.bufferPoolSize).toBeGreaterThanOrEqual(0);

      // Step 12: Get comprehensive dashboard
      const dashboard = dashboardService.getCurrentDashboard();
      expect(dashboard.overview.totalProcessingAttempts).toBeGreaterThan(0);
      expect(dashboard.performance.memory.current.heapUsedMB).toBeGreaterThan(0);
      expect(dashboard.scannedPdfProcessing.processingMethods.pdfToImageConversions).toBeGreaterThan(0);

      // Step 13: Cleanup temp files by session
      const cleanedFiles = await tempFileService.cleanupBySession(sessionId);
      expect(cleanedFiles).toBeGreaterThanOrEqual(0);

      // Record cleanup operation
      performanceMonitor.recordTempFileOperation('cleanup', cleanedFiles);

      // Clean up test file
      try {
        await fs.unlink(tempImagePath);
      } catch (error) {
        // Ignore if already cleaned up
      }
    }, 30000); // 30 second timeout

    it('should handle memory pressure scenarios', async () => {
      const sessionId = 'memory-pressure-test';

      // Simulate memory pressure by creating large buffers
      const largeBuffers: Buffer[] = [];
      for (let i = 0; i < 5; i++) {
        const buffer = memoryOptimizer.getOptimizedBuffer(2 * 1024 * 1024, `large_buffer_${i}`);
        largeBuffers.push(buffer);
      }

      // Check memory status
      const memoryStatusBefore = memoryOptimizer.getMemoryStatus();
      expect(memoryStatusBefore.bufferPoolSize).toBeGreaterThan(0);

      // Trigger memory optimization
      const optimizationResult = await memoryOptimizer.optimizeMemory(sessionId);
      expect(optimizationResult.optimizationsApplied.length).toBeGreaterThan(0);

      // Verify memory was optimized
      const memoryStatusAfter = memoryOptimizer.getMemoryStatus();
      expect(memoryStatusAfter.bufferPoolSize).toBeLessThanOrEqual(memoryStatusBefore.bufferPoolSize);

      // Clean up buffers
      for (let i = 0; i < 5; i++) {
        memoryOptimizer.releaseBuffer(`large_buffer_${i}`);
      }
    });

    it('should handle high temp file count scenarios', async () => {
      const sessionId = 'temp-file-stress-test';
      const tempFileIds: string[] = [];

      // Create many temp files to test cleanup mechanisms
      for (let i = 0; i < 15; i++) {
        const tempPath = tempFileService.createTempFilePath('.tmp', sessionId);
        
        // Create actual temp file
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, Buffer.alloc(1024)); // 1KB file

        const fileId = await tempFileService.registerTempFile(tempPath, 'image', sessionId);
        tempFileIds.push(fileId);
        
        performanceMonitor.recordTempFileOperation('create', 1);
      }

      // Check temp file stats
      const statsBefore = tempFileService.getTempFileStats();
      expect(statsBefore.totalFiles).toBeGreaterThan(10);

      // Should trigger alerts for high temp file count
      const alerts = performanceMonitor.getAlertsByType('temp_files');
      expect(alerts.length).toBeGreaterThan(0);

      // Cleanup all temp files for the session
      const cleanedCount = await tempFileService.cleanupBySession(sessionId);
      expect(cleanedCount).toBeGreaterThan(0);

      performanceMonitor.recordTempFileOperation('cleanup', cleanedCount);

      // Verify cleanup
      const statsAfter = tempFileService.getTempFileStats();
      expect(statsAfter.totalFiles).toBeLessThan(statsBefore.totalFiles);
    });

    it('should generate comprehensive performance reports', async () => {
      // Generate some test data
      const sessionId = 'reporting-test';
      
      // Simulate various processing scenarios
      performanceMonitor.recordProcessingTime('session-1', 2000); // Normal
      performanceMonitor.recordProcessingTime('session-2', 8000); // Warning
      performanceMonitor.recordProcessingTime('session-3', 12000); // Critical

      performanceMonitor.recordTempFileOperation('create', 5);
      performanceMonitor.recordTempFileOperation('cleanup', 3);

      // Get performance summary
      const summary = dashboardService.getPerformanceSummary();
      expect(summary.overview).toContain('attempts');
      expect(summary.performance).toContain('Memory');
      expect(summary.resources).toContain('Temp Files');
      expect(Array.isArray(summary.recommendations)).toBe(true);

      // Export metrics for external monitoring
      const exportedMetrics = dashboardService.exportMetrics();
      expect(exportedMetrics.timestamp).toBeDefined();
      expect(exportedMetrics.metrics).toHaveProperty('processing_attempts_total');
      expect(exportedMetrics.metrics).toHaveProperty('memory_heap_used_mb');
      expect(exportedMetrics.metrics).toHaveProperty('temp_files_current');
      expect(exportedMetrics.labels).toHaveProperty('service');
      expect(exportedMetrics.labels.service).toBe('document-processing-api');

      // Get dashboard with history
      const dashboardWithHistory = dashboardService.getDashboardWithHistory();
      expect(dashboardWithHistory.current).toBeDefined();
      expect(dashboardWithHistory.history).toBeDefined();
      expect(dashboardWithHistory.trends).toBeDefined();
    });

    it('should demonstrate alert system functionality', async () => {
      const sessionId = 'alert-test';

      // Generate processing time alert
      performanceMonitor.recordProcessingTime(sessionId, 15000); // Should trigger warning

      // Generate memory pressure (mock high memory usage)
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 300 * 1024 * 1024, // 300MB
        heapTotal: 200 * 1024 * 1024,
        heapUsed: 180 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      });

      // Trigger memory optimization to generate alerts
      await memoryOptimizer.optimizeMemory(sessionId);

      // Restore original memory usage function
      process.memoryUsage = originalMemoryUsage;

      // Check alerts
      const recentAlerts = performanceMonitor.getRecentAlerts(5);
      expect(recentAlerts.length).toBeGreaterThan(0);

      const processingTimeAlerts = performanceMonitor.getAlertsByType('processing_time');
      expect(processingTimeAlerts.length).toBeGreaterThan(0);
      expect(processingTimeAlerts[0].severity).toBe('warning');

      // Verify alert contains proper information
      const alert = recentAlerts[0];
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('timestamp');
      expect(alert).toHaveProperty('value');
      expect(alert).toHaveProperty('threshold');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for memory optimization', async () => {
      const sessionId = 'benchmark-memory';
      const startTime = Date.now();

      const result = await memoryOptimizer.optimizeMemory(sessionId);

      const optimizationTime = Date.now() - startTime;
      
      // Memory optimization should complete within 1 second
      expect(optimizationTime).toBeLessThan(1000);
      expect(result.optimizationTime).toBeLessThan(1000);
      expect(result.optimizationsApplied.length).toBeGreaterThan(0);
    });

    it('should meet performance benchmarks for temp file operations', async () => {
      const sessionId = 'benchmark-tempfile';
      const startTime = Date.now();

      // Create temp file path (should be very fast)
      const tempPath = tempFileService.createTempFilePath('.png', sessionId);
      const pathCreationTime = Date.now() - startTime;
      
      expect(pathCreationTime).toBeLessThan(10); // Should be under 10ms
      expect(tempPath).toBeDefined();

      // Create actual file for registration test
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.writeFile(tempPath, Buffer.alloc(1024));

      const registrationStart = Date.now();
      const fileId = await tempFileService.registerTempFile(tempPath, 'image', sessionId);
      const registrationTime = Date.now() - registrationStart;

      expect(registrationTime).toBeLessThan(100); // Should be under 100ms
      expect(fileId).toBeDefined();

      // Cleanup
      const cleanupStart = Date.now();
      const cleaned = await tempFileService.cleanupTempFile(fileId);
      const cleanupTime = Date.now() - cleanupStart;

      expect(cleanupTime).toBeLessThan(100); // Should be under 100ms
      expect(cleaned).toBe(true);
    });

    it('should meet performance benchmarks for metrics collection', async () => {
      const startTime = Date.now();

      // Get comprehensive dashboard (should be fast)
      const dashboard = dashboardService.getCurrentDashboard();
      const dashboardTime = Date.now() - startTime;

      expect(dashboardTime).toBeLessThan(500); // Should be under 500ms
      expect(dashboard).toBeDefined();
      expect(dashboard.timestamp).toBeInstanceOf(Date);

      // Export metrics (should be very fast)
      const exportStart = Date.now();
      const exportedMetrics = dashboardService.exportMetrics();
      const exportTime = Date.now() - exportStart;

      expect(exportTime).toBeLessThan(50); // Should be under 50ms
      expect(exportedMetrics).toBeDefined();
      expect(exportedMetrics.metrics).toBeDefined();
    });
  });
});