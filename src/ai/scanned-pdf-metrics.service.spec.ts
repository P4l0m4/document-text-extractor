import { Test, TestingModule } from '@nestjs/testing';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';

describe('ScannedPdfMetricsService', () => {
  let service: ScannedPdfMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScannedPdfMetricsService],
    }).compile();

    service = module.get<ScannedPdfMetricsService>(ScannedPdfMetricsService);
  });

  afterEach(() => {
    // Reset metrics after each test to ensure clean state
    service.resetMetrics();
  });

  describe('Processing Session Management', () => {
    it('should start and track processing sessions', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      
      const metrics = service.getMetrics();
      expect(metrics.totalProcessingAttempts).toBe(1);
    });

    it('should complete processing sessions with success', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      service.completeProcessingSession(sessionId, {
        success: true,
        processingMethod: 'direct',
        isScannedPdf: false,
        textLength: 1000,
        confidence: 95,
        tempFilesCreated: 0,
      });

      const metrics = service.getMetrics();
      expect(metrics.successfulProcessing).toBe(1);
      expect(metrics.directTextExtractions).toBe(1);
      expect(metrics.failedProcessing).toBe(0);
    });

    it('should complete processing sessions with failure', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      service.completeProcessingSession(sessionId, {
        success: false,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 0,
        confidence: 0,
        tempFilesCreated: 2,
        errorType: 'conversion',
      });

      const metrics = service.getMetrics();
      expect(metrics.failedProcessing).toBe(1);
      expect(metrics.successfulProcessing).toBe(0);
    });
  });

  describe('Processing Stage Tracking', () => {
    it('should track processing stages within sessions', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      // Start and complete PDF analysis stage
      service.startProcessingStage(sessionId, 'pdf_analysis');
      
      // Simulate some processing time
      setTimeout(() => {
        service.completeProcessingStage(sessionId, 'pdf_analysis', true);
      }, 10);

      // Complete the session
      service.completeProcessingSession(sessionId, {
        success: true,
        processingMethod: 'direct',
        isScannedPdf: false,
        textLength: 500,
        confidence: 90,
        tempFilesCreated: 0,
      });

      const recentStats = service.getRecentSessionStats(1);
      expect(recentStats.sessions).toHaveLength(1);
      expect(recentStats.sessions[0].stages).toHaveLength(1);
      expect(recentStats.sessions[0].stages[0].stage).toBe('pdf_analysis');
    });

    it('should handle multiple stages in sequence', () => {
      const sessionId = service.startProcessingSession('/test/scanned.pdf');
      
      // Simulate full PDF-to-image workflow
      service.startProcessingStage(sessionId, 'pdf_analysis');
      service.completeProcessingStage(sessionId, 'pdf_analysis', true);
      
      service.startProcessingStage(sessionId, 'dependency_check');
      service.completeProcessingStage(sessionId, 'dependency_check', true);
      
      service.startProcessingStage(sessionId, 'conversion');
      service.completeProcessingStage(sessionId, 'conversion', true);
      
      service.startProcessingStage(sessionId, 'ocr');
      service.completeProcessingStage(sessionId, 'ocr', true);
      
      service.startProcessingStage(sessionId, 'cleanup');
      service.completeProcessingStage(sessionId, 'cleanup', true);

      service.completeProcessingSession(sessionId, {
        success: true,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 800,
        confidence: 85,
        tempFilesCreated: 3,
      });

      const recentStats = service.getRecentSessionStats(1);
      expect(recentStats.sessions[0].stages).toHaveLength(5);
      expect(recentStats.sessions[0].stages.map(s => s.stage)).toEqual([
        'pdf_analysis', 'dependency_check', 'conversion', 'ocr', 'cleanup'
      ]);
    });

    it('should handle stage failures', () => {
      const sessionId = service.startProcessingSession('/test/broken.pdf');
      
      service.startProcessingStage(sessionId, 'conversion');
      service.completeProcessingStage(sessionId, 'conversion', false, 'Missing dependencies');

      service.completeProcessingSession(sessionId, {
        success: false,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 0,
        confidence: 0,
        tempFilesCreated: 1,
        errorType: 'dependency',
      });

      const recentStats = service.getRecentSessionStats(1);
      const conversionStage = recentStats.sessions[0].stages.find(s => s.stage === 'conversion');
      
      expect(conversionStage?.success).toBe(false);
      expect(conversionStage?.errorMessage).toBe('Missing dependencies');
    });
  });

  describe('PDF Analysis Recording', () => {
    it('should record scanned PDF detections', () => {
      const sessionId = service.startProcessingSession('/test/scanned.pdf');
      
      service.recordPdfAnalysis(sessionId, true, 'No extractable text found');

      const metrics = service.getMetrics();
      expect(metrics.scannedPdfDetections).toBe(1);
      expect(metrics.textBasedPdfDetections).toBe(0);
    });

    it('should record text-based PDF detections', () => {
      const sessionId = service.startProcessingSession('/test/text.pdf');
      
      service.recordPdfAnalysis(sessionId, false, 'Sufficient text content detected');

      const metrics = service.getMetrics();
      expect(metrics.scannedPdfDetections).toBe(0);
      expect(metrics.textBasedPdfDetections).toBe(1);
    });
  });

  describe('Temporary File Tracking', () => {
    it('should track temporary file creation and cleanup', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      service.recordTempFileOperation(sessionId, 'created', 3);
      service.recordTempFileOperation(sessionId, 'cleaned', 3);

      const metrics = service.getMetrics();
      expect(metrics.tempFilesCreated).toBe(3);
      expect(metrics.tempFilesCleanedUp).toBe(3);
    });

    it('should track partial cleanup scenarios', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      service.recordTempFileOperation(sessionId, 'created', 5);
      service.recordTempFileOperation(sessionId, 'cleaned', 3); // Partial cleanup

      const metrics = service.getMetrics();
      expect(metrics.tempFilesCreated).toBe(5);
      expect(metrics.tempFilesCleanedUp).toBe(3);
    });
  });

  describe('Error Recording', () => {
    it('should record different types of errors', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      service.recordError(sessionId, 'dependency', 'Missing GraphicsMagick');
      service.recordError(sessionId, 'conversion', 'PDF conversion failed');
      service.recordError(sessionId, 'ocr', 'OCR processing timeout');
      service.recordError(sessionId, 'system', 'Out of memory');

      const metrics = service.getMetrics();
      expect(metrics.dependencyErrors).toBe(1);
      expect(metrics.conversionErrors).toBe(1);
      expect(metrics.ocrErrors).toBe(1);
      expect(metrics.systemErrors).toBe(1);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate success rate correctly', () => {
      // Create successful session
      const sessionId1 = service.startProcessingSession('/test/doc1.pdf');
      service.completeProcessingSession(sessionId1, {
        success: true,
        processingMethod: 'direct',
        isScannedPdf: false,
        textLength: 1000,
        confidence: 95,
        tempFilesCreated: 0,
      });

      // Create failed session
      const sessionId2 = service.startProcessingSession('/test/doc2.pdf');
      service.completeProcessingSession(sessionId2, {
        success: false,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 0,
        confidence: 0,
        tempFilesCreated: 2,
        errorType: 'conversion',
      });

      const successRate = service.getSuccessRate();
      expect(successRate).toBe(50); // 1 success out of 2 attempts
    });

    it('should handle zero attempts for success rate', () => {
      const successRate = service.getSuccessRate();
      expect(successRate).toBe(0);
    });

    it('should calculate recent session statistics', () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const sessionId = service.startProcessingSession(`/test/doc${i}.pdf`);
        service.completeProcessingSession(sessionId, {
          success: i % 2 === 0, // Alternate success/failure
          processingMethod: i < 2 ? 'direct' : 'pdf-to-image',
          isScannedPdf: i >= 2,
          textLength: i * 100,
          confidence: 80 + i,
          tempFilesCreated: i >= 2 ? 2 : 0,
        });
      }

      const recentStats = service.getRecentSessionStats(3);
      expect(recentStats.sessions).toHaveLength(3);
      expect(recentStats.successRate).toBe(33.33333333333333); // 1 success out of 3 recent
      expect(recentStats.methodBreakdown).toHaveProperty('pdf-to-image');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics to initial state', () => {
      // Create some activity
      const sessionId = service.startProcessingSession('/test/document.pdf');
      service.recordPdfAnalysis(sessionId, true, 'Test');
      service.recordTempFileOperation(sessionId, 'created', 2);
      service.recordError(sessionId, 'dependency', 'Test error');
      service.completeProcessingSession(sessionId, {
        success: false,
        processingMethod: 'pdf-to-image',
        isScannedPdf: true,
        textLength: 0,
        confidence: 0,
        tempFilesCreated: 2,
        errorType: 'dependency',
      });

      // Verify activity was recorded
      let metrics = service.getMetrics();
      expect(metrics.totalProcessingAttempts).toBe(1);
      expect(metrics.scannedPdfDetections).toBe(1);
      expect(metrics.tempFilesCreated).toBe(2);
      expect(metrics.dependencyErrors).toBe(1);

      // Reset metrics
      service.resetMetrics();

      // Verify reset
      metrics = service.getMetrics();
      expect(metrics.totalProcessingAttempts).toBe(0);
      expect(metrics.successfulProcessing).toBe(0);
      expect(metrics.failedProcessing).toBe(0);
      expect(metrics.scannedPdfDetections).toBe(0);
      expect(metrics.tempFilesCreated).toBe(0);
      expect(metrics.dependencyErrors).toBe(0);
      expect(metrics.lastResetTime).toBeInstanceOf(Date);
    });
  });

  describe('Session Limit Management', () => {
    it('should maintain maximum number of completed sessions', () => {
      // Create more sessions than the limit (100)
      for (let i = 0; i < 105; i++) {
        const sessionId = service.startProcessingSession(`/test/doc${i}.pdf`);
        service.completeProcessingSession(sessionId, {
          success: true,
          processingMethod: 'direct',
          isScannedPdf: false,
          textLength: 100,
          confidence: 90,
          tempFilesCreated: 0,
        });
      }

      const recentStats = service.getRecentSessionStats(200); // Request more than available
      expect(recentStats.sessions.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations on unknown sessions gracefully', () => {
      const unknownSessionId = 'unknown_session_123';
      
      // These should not throw errors
      expect(() => {
        service.startProcessingStage(unknownSessionId, 'pdf_analysis');
        service.completeProcessingStage(unknownSessionId, 'pdf_analysis', true);
        service.completeProcessingSession(unknownSessionId, {
          success: true,
          processingMethod: 'direct',
          isScannedPdf: false,
          textLength: 100,
          confidence: 90,
          tempFilesCreated: 0,
        });
      }).not.toThrow();
    });

    it('should handle completing non-existent stages gracefully', () => {
      const sessionId = service.startProcessingSession('/test/document.pdf');
      
      // Try to complete a stage that was never started
      expect(() => {
        service.completeProcessingStage(sessionId, 'conversion', true);
      }).not.toThrow();
    });
  });
});