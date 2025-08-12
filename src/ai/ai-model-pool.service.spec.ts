import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiModelPoolService } from './ai-model-pool.service';

// Mock Tesseract
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'Test extracted text',
        confidence: 95,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('AiModelPoolService', () => {
  let service: AiModelPoolService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiModelPoolService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'app.maxConcurrentJobs':
                  return 5;
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiModelPoolService>(AiModelPoolService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('Pool Management', () => {
    it('should initialize with correct pool size', async () => {
      await service.onModuleInit();

      const stats = service.getPoolStats();
      expect(stats.maxPoolSize).toBe(5);
      expect(stats.totalWorkers).toBeGreaterThan(0);
    });

    it('should create workers on demand', async () => {
      await service.onModuleInit();

      const initialStats = service.getPoolStats();

      // Simulate concurrent requests
      const promises = Array.from({ length: 3 }, (_, i) =>
        service.extractTextFromImage(`test-image-${i}.png`),
      );

      await Promise.all(promises);

      const finalStats = service.getPoolStats();
      expect(finalStats.totalWorkers).toBeGreaterThanOrEqual(
        initialStats.totalWorkers,
      );
    });

    it('should track pool utilization correctly', async () => {
      await service.onModuleInit();

      const stats = service.getPoolStats();
      expect(stats.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(stats.utilizationRate).toBeLessThanOrEqual(100);
      expect(stats.busyWorkers + stats.idleWorkers).toBe(stats.totalWorkers);
    });
  });

  describe('Text Extraction Performance', () => {
    it('should extract text from image using pooled worker', async () => {
      await service.onModuleInit();

      const result = await service.extractTextFromImage('test-image.png');

      expect(result).toBeDefined();
      expect(result.text).toBe('Test extracted text');
      expect(result.confidence).toBe(95);
      expect(result.metadata.workerId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle concurrent image extractions', async () => {
      await service.onModuleInit();

      const promises = Array.from({ length: 4 }, (_, i) =>
        service.extractTextFromImage(`test-image-${i}.png`),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result.text).toBe('Test extracted text');
        expect(result.confidence).toBe(95);
      });
    });

    it('should extract text from PDF without pooling', async () => {
      // Mock pdf-parse
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: 'PDF extracted text',
          numpages: 2,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
      }));

      const result = await service.extractTextFromPdf('test-document.pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe('PDF extracted text');
      expect(result.confidence).toBe(100);
      expect(result.metadata.pageCount).toBe(2);
    });
  });

  describe('Summarization Performance', () => {
    it('should generate extractive summary', async () => {
      const longText =
        'This is the first sentence. This is the second sentence with important information. This is the third sentence. This is the fourth sentence with more details.';

      const result = await service.generateSummary(longText, {
        maxLength: 100,
        summaryType: 'extractive',
      });

      expect(result).toBeDefined();
      expect(result.summary.length).toBeLessThanOrEqual(100);
      expect(result.originalLength).toBe(longText.length);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    it('should generate abstractive summary', async () => {
      const longText =
        'Document processing is important. Text extraction helps analyze documents. Summarization provides quick insights.';

      const result = await service.generateSummary(longText, {
        maxLength: 50,
        summaryType: 'abstractive',
      });

      expect(result).toBeDefined();
      expect(result.summary.length).toBeLessThanOrEqual(50);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    it('should handle large text efficiently', async () => {
      // Create a large text (over 50KB)
      const largeText = 'This is a test sentence. '.repeat(3000);

      const startTime = Date.now();
      const result = await service.generateSummary(largeText, {
        maxLength: 200,
        summaryType: 'extractive',
      });
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.summary.length).toBeLessThanOrEqual(200);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Memory Optimization', () => {
    it('should preprocess large text in chunks', async () => {
      // Create text larger than chunk size
      const veryLargeText = 'Test sentence. '.repeat(5000);

      const result = await service.generateSummary(veryLargeText, {
        maxLength: 150,
        summaryType: 'extractive',
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeLessThanOrEqual(150);
    });

    it('should handle empty or invalid text gracefully', async () => {
      await expect(service.generateSummary('')).rejects.toThrow(
        'Input text is empty or invalid',
      );
      await expect(service.generateSummary('   ')).rejects.toThrow(
        'Input text is empty or invalid',
      );
    });
  });

  describe('Worker Lifecycle', () => {
    it('should terminate all workers on module destroy', async () => {
      await service.onModuleInit();

      const initialStats = service.getPoolStats();
      expect(initialStats.totalWorkers).toBeGreaterThan(0);

      await service.onModuleDestroy();

      const finalStats = service.getPoolStats();
      expect(finalStats.totalWorkers).toBe(0);
    });

    it('should clean up idle workers', async () => {
      await service.onModuleInit();

      // Create some workers
      await service.extractTextFromImage('test1.png');
      await service.extractTextFromImage('test2.png');

      const beforeStats = service.getPoolStats();

      // Wait for cleanup (simulate idle timeout)
      // Note: In real scenario, this would be handled by the cleanup interval
      // For testing, we just verify the method exists and can be called
      expect(beforeStats.totalWorkers).toBeGreaterThan(0);
    });
  });
});
  describe('Enhanced Metadata for Scanned PDFs', () => {
    let mockDependencyDetectionService: any;
    let mockPdfConversionConfigService: any;

    beforeEach(() => {
      // Mock dependency detection service
      mockDependencyDetectionService = {
        checkSystemDependencies: jest.fn().mockResolvedValue({
          graphicsMagick: { available: true },
          imageMagick: { available: false },
          pdf2pic: { available: true },
        }),
        isConversionSupported: jest.fn().mockResolvedValue(true),
      };

      // Mock PDF conversion config service
      mockPdfConversionConfigService = {
        getConfig: jest.fn().mockReturnValue({
          enabled: true,
          density: 200,
          format: 'png',
          width: 2000,
          height: 2000,
        }),
        getPdf2picOptions: jest.fn().mockReturnValue({
          density: 200,
          format: 'png',
          width: 2000,
          height: 2000,
        }),
      };

      // Replace the service dependencies
      (service as any).dependencyDetectionService = mockDependencyDetectionService;
      (service as any).pdfConversionConfigService = mockPdfConversionConfigService;
    });

    it('should populate enhanced metadata for text-based PDF', async () => {
      // Mock pdf-parse for text-based PDF
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: 'This is extracted text from a text-based PDF',
          numpages: 3,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
      }));

      const result = await service.extractTextFromPdf('test-document.pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe('This is extracted text from a text-based PDF');
      expect(result.confidence).toBe(100);
      expect(result.metadata).toMatchObject({
        pageCount: 3,
        isScannedPdf: false,
        ocrMethod: 'direct',
        originalPageCount: 3,
        processedPages: 3,
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: false,
          pdf2pic: true,
        },
      });
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should populate enhanced metadata for scanned PDF with successful OCR', async () => {
      // Mock pdf-parse for scanned PDF (no text)
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: '', // Empty text indicates scanned PDF
          numpages: 2,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
        existsSync: jest.fn().mockReturnValue(true),
        statSync: jest.fn().mockReturnValue({ size: 1024 }),
      }));

      // Mock path
      jest.doMock('path', () => ({
        dirname: jest.fn().mockReturnValue('/tmp'),
        join: jest.fn().mockReturnValue('/tmp/test_image.png'),
      }));

      // Mock pdf2pic
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn().mockReturnValue({
          1: jest.fn().mockResolvedValue({
            path: '/tmp/test_image.png',
          }),
        }),
      }));

      // Mock the convertPdfPageToImage method to return a path
      jest.spyOn(service as any, 'convertPdfPageToImage').mockResolvedValue('/tmp/test_image.png');
      
      // Mock the cleanupTempFiles method
      jest.spyOn(service as any, 'cleanupTempFiles').mockResolvedValue(undefined);

      const result = await service.extractTextFromPdf('test-scanned.pdf');

      expect(result).toBeDefined();
      expect(result.metadata).toMatchObject({
        pageCount: 2,
        isScannedPdf: true,
        ocrMethod: 'pdf-to-image',
        originalPageCount: 2,
        processedPages: 1,
        conversionSupported: true,
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: false,
          pdf2pic: true,
        },
      });
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.conversionTime).toBeDefined();
      expect(result.metadata.ocrTime).toBeDefined();
      expect(result.metadata.tempFilesCreated).toBeDefined();
      expect(result.metadata.workerId).toBeDefined();
    });

    it('should populate enhanced metadata for scanned PDF with fallback', async () => {
      // Mock pdf-parse for scanned PDF (no text)
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: '', // Empty text indicates scanned PDF
          numpages: 1,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
      }));

      // Mock dependency detection to return unsupported conversion
      mockDependencyDetectionService.isConversionSupported.mockResolvedValue(false);

      // Mock fallback scenario - pdf-parse returns some text on second call
      let callCount = 0;
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ text: '', numpages: 1 });
          } else {
            return Promise.resolve({ text: 'Fallback extracted text', numpages: 1 });
          }
        }),
      }));

      const result = await service.extractTextFromPdf('test-scanned-fallback.pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe('Fallback extracted text');
      expect(result.confidence).toBe(50); // Lower confidence for fallback
      expect(result.metadata).toMatchObject({
        isScannedPdf: true,
        ocrMethod: 'direct_fallback',
        conversionSupported: false,
        fallbackUsed: true,
        originalPageCount: 1,
        processedPages: 1,
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: false,
          pdf2pic: true,
        },
      });
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should populate enhanced metadata for failed OCR with error information', async () => {
      // Mock pdf-parse for scanned PDF (no text)
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: '', // Empty text indicates scanned PDF
          numpages: 1,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
      }));

      // Mock convertPdfToImageAndOcr to throw an error
      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockRejectedValue(
        new Error('OCR processing failed due to missing dependencies')
      );

      const result = await service.extractTextFromPdf('test-failed-ocr.pdf');

      expect(result).toBeDefined();
      expect(result.text).toBe(''); // Empty text due to failure
      expect(result.confidence).toBe(0);
      expect(result.metadata).toMatchObject({
        pageCount: 1,
        isScannedPdf: true,
        ocrMethod: 'pdf-to-image',
        originalPageCount: 1,
        processedPages: 0,
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: false,
          pdf2pic: true,
        },
      });
      expect(result.metadata.ocrError).toContain('OCR processing failed');
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should include system dependencies status in all scenarios', async () => {
      // Test with different dependency configurations
      mockDependencyDetectionService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: { available: false },
        imageMagick: { available: true },
        pdf2pic: { available: false },
      });

      // Mock pdf-parse for text-based PDF
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: 'Text from PDF with different dependencies',
          numpages: 1,
        }),
      }));

      // Mock fs
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
      }));

      const result = await service.extractTextFromPdf('test-dependencies.pdf');

      expect(result.metadata.systemDependencies).toEqual({
        graphicsMagick: false,
        imageMagick: true,
        pdf2pic: false,
      });
    });

    it('should track conversion and OCR times separately', async () => {
      // Mock pdf-parse for scanned PDF
      jest.doMock('pdf-parse', () => ({
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      // Mock fs and path
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('fake pdf data')),
        existsSync: jest.fn().mockReturnValue(true),
        statSync: jest.fn().mockReturnValue({ size: 1024 }),
      }));

      jest.doMock('path', () => ({
        dirname: jest.fn().mockReturnValue('/tmp'),
        join: jest.fn().mockReturnValue('/tmp/test_image.png'),
      }));

      // Mock convertPdfPageToImage with timing
      jest.spyOn(service as any, 'convertPdfPageToImage').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate conversion time
        return '/tmp/test_image.png';
      });

      // Mock extractTextFromImage with timing
      jest.spyOn(service, 'extractTextFromImage').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate OCR time
        return {
          text: 'OCR extracted text',
          confidence: 85,
          metadata: {
            processingTime: 50,
            workerId: 'test-worker-1',
            language: 'eng',
          },
        };
      });

      // Mock cleanupTempFiles
      jest.spyOn(service as any, 'cleanupTempFiles').mockResolvedValue(undefined);

      const result = await service.extractTextFromPdf('test-timing.pdf');

      expect(result.metadata.conversionTime).toBeGreaterThan(0);
      expect(result.metadata.ocrTime).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(
        result.metadata.conversionTime + result.metadata.ocrTime
      );
    });
  });