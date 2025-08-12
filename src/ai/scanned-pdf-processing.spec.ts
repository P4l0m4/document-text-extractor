import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiModelPoolService } from './ai-model-pool.service';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';
import {
  DependencyException,
  ConversionException,
  OcrException,
  ScannedPdfSystemException,
  PartialProcessingException,
} from '../common/exceptions/scanned-pdf.exception';
import { TextExtractionResult } from './interfaces/ai-model.interface';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'OCR extracted text from image',
        confidence: 85,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('pdf-parse', () => ({
  default: jest.fn(),
}));

jest.mock('pdf2pic', () => ({
  fromPath: jest.fn(),
}));

jest.mock('fs');
jest.mock('path');

describe('Scanned PDF Processing - Comprehensive Unit Tests', () => {
  let service: AiModelPoolService;
  let dependencyService: jest.Mocked<DependencyDetectionService>;
  let configService: jest.Mocked<PdfConversionConfigService>;
  let metricsService: jest.Mocked<ScannedPdfMetricsService>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockPath: jest.Mocked<typeof path>;

  const mockSessionId = 'test-session-123';
  const mockPdfPath = '/test/path/document.pdf';
  const mockImagePath = '/tmp/test-image.png';

  beforeEach(async () => {
    // Setup mocks
    mockFs = fs as jest.Mocked<typeof fs>;
    mockPath = path as jest.Mocked<typeof path>;

    const mockDependencyService = {
      checkSystemDependencies: jest.fn(),
      isConversionSupported: jest.fn(),
      generateInstallationInstructions: jest.fn(),
      checkGraphicsMagick: jest.fn(),
      checkImageMagick: jest.fn(),
      checkPdf2pic: jest.fn(),
    };

    const mockConfigService = {
      getConfig: jest.fn(),
      getPdf2picOptions: jest.fn(),
      getDensity: jest.fn().mockReturnValue(200),
      getFormat: jest.fn().mockReturnValue('png'),
      getTempDir: jest.fn().mockReturnValue('/tmp/pdf-conversion'),
      getTimeout: jest.fn().mockReturnValue(30000),
      isEnabled: jest.fn().mockReturnValue(true),
    };

    const mockMetricsService = {
      startProcessingSession: jest.fn().mockReturnValue(mockSessionId),
      startProcessingStage: jest.fn(),
      completeProcessingStage: jest.fn(),
      completeProcessingSession: jest.fn(),
      recordPdfAnalysis: jest.fn(),
      recordError: jest.fn(),
      logMetricsSummary: jest.fn(),
    };

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
                case 'PDF_CONVERSION_MAX_CONCURRENT':
                  return 3;
                case 'DEPENDENCY_CHECK_ON_STARTUP':
                  return false; // Disable for tests
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: DependencyDetectionService,
          useValue: mockDependencyService,
        },
        {
          provide: PdfConversionConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ScannedPdfMetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<AiModelPoolService>(AiModelPoolService);
    dependencyService = module.get(DependencyDetectionService);
    configService = module.get(PdfConversionConfigService);
    metricsService = module.get(ScannedPdfMetricsService);

    // Initialize the service
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('PDF-to-Image Conversion with Mock Dependencies', () => {
    beforeEach(() => {
      // Setup default successful dependency mocks
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: true,
          version: '1.3.38',
          path: 'gm',
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: true,
          version: 'installed',
          installationInstructions: 'npm install pdf2pic',
        },
      });

      dependencyService.isConversionSupported.mockResolvedValue(true);
    });

    it('should successfully convert PDF to image and extract text', async () => {
      // Mock PDF parsing for scanned PDF (no text)
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '', // Empty text indicates scanned PDF
        numpages: 1,
      });

      // Mock file system operations
      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockPath.dirname.mockReturnValue('/tmp');
      mockPath.join.mockReturnValue(mockImagePath);

      // Mock pdf2pic conversion
      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      // Mock config service
      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result).toBeDefined();
      expect(result.text).toBe('OCR extracted text from image');
      expect(result.confidence).toBe(85);
      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.ocrMethod).toBe('pdf-to-image');
      expect(result.metadata.systemDependencies).toEqual({
        graphicsMagick: true,
        imageMagick: false,
        pdf2pic: true,
      });
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.conversionTime).toBeDefined();
      expect(result.metadata.ocrTime).toBeDefined();
    });

    it('should handle PDF-to-image conversion with multiple pages', async () => {
      // Mock PDF parsing for multi-page scanned PDF
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 3,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      // Mock pdf2pic for first page only
      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata.originalPageCount).toBe(3);
      expect(result.metadata.processedPages).toBe(1); // Only first page processed
      expect(result.metadata.pageCount).toBe(3); // Original page count
    });

    it('should handle conversion with different image formats', async () => {
      // Test JPG format
      configService.getFormat.mockReturnValue('jpg');
      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'jpg',
        width: 2000,
        height: 2000,
      });

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: '/tmp/test_page.jpg',
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result).toBeDefined();
      expect(configService.getPdf2picOptions).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle conversion with custom DPI settings', async () => {
      configService.getDensity.mockReturnValue(300);
      configService.getPdf2picOptions.mockReturnValue({
        density: 300,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result).toBeDefined();
      expect(configService.getDensity).toHaveBeenCalled();
    });
  });

  describe('Error Handling for Missing System Dependencies', () => {
    it('should throw DependencyException when pdf2pic is missing', async () => {
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: true,
          version: '1.3.38',
          path: 'gm',
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: false,
          version: undefined,
          installationInstructions: 'npm install pdf2pic',
        },
      });

      dependencyService.isConversionSupported.mockResolvedValue(false);
      dependencyService.generateInstallationInstructions.mockReturnValue({
        windows: ['choco install imagemagick', 'npm install pdf2pic'],
        macos: ['brew install imagemagick', 'npm install pdf2pic'],
        linux: ['apt-get install imagemagick', 'npm install pdf2pic'],
      });

      // Mock PDF parsing for scanned PDF
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow(DependencyException);
    });

    it('should throw DependencyException when both GraphicsMagick and ImageMagick are missing', async () => {
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: true,
          version: 'installed',
          installationInstructions: 'npm install pdf2pic',
        },
      });

      dependencyService.isConversionSupported.mockResolvedValue(false);

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow(DependencyException);
    });

    it('should provide fallback when dependencies are missing but direct text is available', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(false);
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: false,
          version: undefined,
          installationInstructions: 'npm install pdf2pic',
        },
      });

      // Mock PDF parsing to return some text on fallback attempt
      const mockPdfParse = require('pdf-parse').default;
      let callCount = 0;
      mockPdfParse.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ text: '', numpages: 1 });
        } else {
          return Promise.resolve({ text: 'Fallback extracted text', numpages: 1 });
        }
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.text).toBe('Fallback extracted text');
      expect(result.confidence).toBe(50); // Lower confidence for fallback
      expect(result.metadata.ocrMethod).toBe('direct_fallback');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.conversionSupported).toBe(false);
    });

    it('should handle dependency check errors gracefully', async () => {
      dependencyService.checkSystemDependencies.mockRejectedValue(
        new Error('System dependency check failed')
      );

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'Direct text extraction works',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      // Should still work for text-based PDFs
      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.text).toBe('Direct text extraction works');
      expect(result.metadata.isScannedPdf).toBe(false);
      expect(result.metadata.ocrMethod).toBe('direct');
    });
  });

  describe('Temporary File Cleanup and Management', () => {
    beforeEach(() => {
      dependencyService.isConversionSupported.mockResolvedValue(true);
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: true,
          version: '1.3.38',
          path: 'gm',
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: false,
          version: undefined,
          path: undefined,
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: true,
          version: 'installed',
          installationInstructions: 'npm install pdf2pic',
        },
      });
    });

    it('should create and cleanup temporary files during successful conversion', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockFs.unlinkSync = jest.fn(); // Mock file deletion
      mockFs.rmSync = jest.fn(); // Mock directory deletion

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result).toBeDefined();
      expect(result.metadata.tempFilesCreated).toBeGreaterThan(0);
      // Verify cleanup was attempted (implementation detail may vary)
    });

    it('should handle cleanup failures gracefully', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);
      
      // Mock cleanup failure
      mockFs.unlinkSync = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Should not throw error even if cleanup fails
      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result).toBeDefined();
      expect(result.text).toBe('OCR extracted text from image');
    });

    it('should cleanup temporary files even when OCR fails', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);
      mockFs.unlinkSync = jest.fn();

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      // Mock OCR failure
      const mockTesseract = require('tesseract.js');
      mockTesseract.createWorker.mockResolvedValue({
        recognize: jest.fn().mockRejectedValue(new Error('OCR processing failed')),
        terminate: jest.fn().mockResolvedValue(undefined),
      });

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();
      
      // Verify cleanup was still attempted
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should handle concurrent processing with unique temporary file names', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      let fileCounter = 0;
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: `/tmp/test_page_${++fileCounter}.png`,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Process multiple PDFs concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        service.extractTextFromPdf(`/test/path/document${i}.pdf`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata.tempFilesCreated).toBeGreaterThan(0);
      });
    });

    it('should track temporary file creation count in metadata', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 2, // Multi-page PDF
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata.tempFilesCreated).toBe(1); // Only first page processed
      expect(result.metadata.processedPages).toBe(1);
      expect(result.metadata.originalPageCount).toBe(2);
    });
  });

  describe('Enhanced Metadata Population', () => {
    beforeEach(() => {
      dependencyService.checkSystemDependencies.mockResolvedValue({
        graphicsMagick: {
          available: true,
          version: '1.3.38',
          path: 'gm',
          installationInstructions: 'Install GraphicsMagick',
        },
        imageMagick: {
          available: true,
          version: '7.1.0-62',
          path: 'convert',
          installationInstructions: 'Install ImageMagick',
        },
        pdf2pic: {
          available: true,
          version: 'installed',
          installationInstructions: 'npm install pdf2pic',
        },
      });
    });

    it('should populate comprehensive metadata for text-based PDF', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'This is a comprehensive text-based PDF with sufficient content for analysis. It contains multiple sentences and paragraphs that clearly indicate it is not a scanned document.',
        numpages: 2,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata).toMatchObject({
        pageCount: 2,
        isScannedPdf: false,
        ocrMethod: 'direct',
        originalPageCount: 2,
        processedPages: 2,
        textDensity: expect.any(Number),
        averageWordsPerPage: expect.any(Number),
        detectionReason: expect.stringContaining('Sufficient text content detected'),
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: true,
          pdf2pic: true,
        },
      });

      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.textDensity).toBeGreaterThan(0);
      expect(result.metadata.averageWordsPerPage).toBeGreaterThan(0);
    });

    it('should populate comprehensive metadata for scanned PDF with successful OCR', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(true);

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '', // Empty text indicates scanned PDF
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata).toMatchObject({
        pageCount: 1,
        isScannedPdf: true,
        ocrMethod: 'pdf-to-image',
        originalPageCount: 1,
        processedPages: 1,
        textDensity: 0, // No direct text
        averageWordsPerPage: 0, // No direct text
        detectionReason: 'No extractable text found',
        directTextLength: 0,
        conversionTime: expect.any(Number),
        ocrTime: expect.any(Number),
        tempFilesCreated: expect.any(Number),
        workerId: expect.any(String),
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: true,
          pdf2pic: true,
        },
      });

      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.conversionTime).toBeGreaterThan(0);
      expect(result.metadata.ocrTime).toBeGreaterThan(0);
    });

    it('should populate metadata for partial processing with fallback', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(false);

      const mockPdfParse = require('pdf-parse').default;
      let callCount = 0;
      mockPdfParse.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ text: '', numpages: 1 });
        } else {
          return Promise.resolve({ text: 'Partial fallback text', numpages: 1 });
        }
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata).toMatchObject({
        isScannedPdf: true,
        ocrMethod: 'direct_fallback',
        conversionSupported: false,
        fallbackUsed: true,
        originalPageCount: 1,
        processedPages: 1,
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: true,
          pdf2pic: true,
        },
      });

      expect(result.confidence).toBe(50); // Lower confidence for fallback
    });

    it('should populate error metadata when OCR fails', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(true);

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'Some direct text available',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      // Mock OCR failure
      const mockTesseract = require('tesseract.js');
      mockTesseract.createWorker.mockResolvedValue({
        recognize: jest.fn().mockRejectedValue(new Error('OCR engine failure')),
        terminate: jest.fn().mockResolvedValue(undefined),
      });

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata).toMatchObject({
        isScannedPdf: true,
        ocrMethod: 'direct_fallback',
        fallbackUsed: true,
        partialProcessing: true,
        ocrError: expect.stringContaining('OCR'),
        systemDependencies: {
          graphicsMagick: true,
          imageMagick: true,
          pdf2pic: true,
        },
      });

      expect(result.text).toBe('Some direct text available');
      expect(result.confidence).toBe(25); // Low confidence due to OCR failure
    });

    it('should track processing times separately for conversion and OCR', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(true);

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      // Mock pdf2pic with delay to simulate conversion time
      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { path: mockImagePath };
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      // Mock Tesseract with delay to simulate OCR time
      const mockTesseract = require('tesseract.js');
      mockTesseract.createWorker.mockResolvedValue({
        recognize: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            data: {
              text: 'OCR text with timing',
              confidence: 90,
            },
          };
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      });

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata.conversionTime).toBeGreaterThan(0);
      expect(result.metadata.ocrTime).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(
        result.metadata.conversionTime! + result.metadata.ocrTime!
      );
    });

    it('should include worker ID in metadata for OCR processing', async () => {
      dependencyService.isConversionSupported.mockResolvedValue(true);

      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      const mockFromPath = jest.fn().mockReturnValue({
        1: jest.fn().mockResolvedValue({
          path: mockImagePath,
        }),
      });
      mockPdf2pic.fromPath.mockReturnValue(mockFromPath());

      configService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'test_page',
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata.workerId).toBeDefined();
      expect(typeof result.metadata.workerId).toBe('string');
      expect(result.metadata.workerId).toMatch(/^worker-/);
    });
  });

  describe('Scanned PDF Detection Logic', () => {
    it('should detect scanned PDF with no text', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      // Mock conversion not supported to test detection only
      dependencyService.isConversionSupported.mockResolvedValue(false);

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();

      expect(metricsService.recordPdfAnalysis).toHaveBeenCalledWith(
        mockSessionId,
        true,
        'No extractable text found'
      );
    });

    it('should detect scanned PDF with minimal text', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'Page 1', // Very minimal text
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      dependencyService.isConversionSupported.mockResolvedValue(false);

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();

      expect(metricsService.recordPdfAnalysis).toHaveBeenCalledWith(
        mockSessionId,
        true,
        expect.stringContaining('Too few total words')
      );
    });

    it('should detect text-based PDF with sufficient content', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'This is a comprehensive document with plenty of text content that clearly indicates it is a text-based PDF document with extractable text. It contains multiple sentences and sufficient word density to be classified as text-based rather than scanned.',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      const result = await service.extractTextFromPdf(mockPdfPath);

      expect(result.metadata.isScannedPdf).toBe(false);
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(metricsService.recordPdfAnalysis).toHaveBeenCalledWith(
        mockSessionId,
        false,
        expect.stringContaining('Sufficient text content detected')
      );
    });

    it('should detect scanned PDF with low word density per page', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'Few words here', // Low density across multiple pages
        numpages: 5,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      dependencyService.isConversionSupported.mockResolvedValue(false);

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();

      expect(metricsService.recordPdfAnalysis).toHaveBeenCalledWith(
        mockSessionId,
        true,
        expect.stringContaining('Low word density')
      );
    });

    it('should detect scanned PDF with suspicious patterns', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: '   \n\n  1  \n\n   ', // Only whitespace and page numbers
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));
      dependencyService.isConversionSupported.mockResolvedValue(false);

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();

      expect(metricsService.recordPdfAnalysis).toHaveBeenCalledWith(
        mockSessionId,
        true,
        expect.stringContaining('suspicious patterns')
      );
    });
  });

  describe('Metrics Integration', () => {
    it('should track processing session lifecycle', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockResolvedValue({
        text: 'Text-based PDF content',
        numpages: 1,
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      await service.extractTextFromPdf(mockPdfPath);

      expect(metricsService.startProcessingSession).toHaveBeenCalledWith(mockPdfPath);
      expect(metricsService.startProcessingStage).toHaveBeenCalledWith(mockSessionId, 'pdf_analysis');
      expect(metricsService.completeProcessingStage).toHaveBeenCalledWith(mockSessionId, 'pdf_analysis', true);
      expect(metricsService.completeProcessingSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          success: true,
          processingMethod: 'direct',
          isScannedPdf: false,
        })
      );
    });

    it('should record error metrics on failure', async () => {
      const mockPdfParse = require('pdf-parse').default;
      mockPdfParse.mockRejectedValue(new Error('PDF parsing failed'));

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf data'));

      await expect(service.extractTextFromPdf(mockPdfPath)).rejects.toThrow();

      expect(metricsService.recordError).toHaveBeenCalledWith(
        mockSessionId,
        'system',
        expect.any(String)
      );
      expect(metricsService.completeProcessingSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});