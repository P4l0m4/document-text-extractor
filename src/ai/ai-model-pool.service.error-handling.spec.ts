import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AiModelPoolService } from './ai-model-pool.service';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import {
  ScannedPdfException,
  DependencyException,
  ConversionException,
  OcrException,
  ScannedPdfSystemException,
  PartialProcessingException,
} from '../common/exceptions';

describe('AiModelPoolService - Error Handling', () => {
  let service: AiModelPoolService;
  let dependencyDetectionService: jest.Mocked<DependencyDetectionService>;
  let pdfConversionConfigService: jest.Mocked<PdfConversionConfigService>;
  let configService: jest.Mocked<ConfigService>;

  const mockDependencyStatus = {
    pdf2pic: {
      available: true,
      version: '1.0.0',
      installationInstructions: 'npm install pdf2pic',
    },
    graphicsMagick: {
      available: true,
      version: '1.3.36',
      path: '/usr/local/bin/gm',
      installationInstructions: 'brew install graphicsmagick',
    },
    imageMagick: {
      available: false,
      installationInstructions: 'brew install imagemagick',
    },
  };

  const mockInstallationInstructions = {
    windows: ['choco install imagemagick', 'npm install pdf2pic'],
    macos: ['brew install imagemagick', 'npm install pdf2pic'],
    linux: ['sudo apt-get install imagemagick', 'npm install pdf2pic'],
  };

  beforeEach(async () => {
    const mockDependencyDetectionService = {
      checkSystemDependencies: jest.fn(),
      isConversionSupported: jest.fn(),
      generateInstallationInstructions: jest.fn(),
    };

    const mockPdfConversionConfigService = {
      getConfig: jest.fn(),
      getPdf2picOptions: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiModelPoolService,
        {
          provide: DependencyDetectionService,
          useValue: mockDependencyDetectionService,
        },
        {
          provide: PdfConversionConfigService,
          useValue: mockPdfConversionConfigService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiModelPoolService>(AiModelPoolService);
    dependencyDetectionService = module.get(DependencyDetectionService);
    pdfConversionConfigService = module.get(PdfConversionConfigService);
    configService = module.get(ConfigService);

    // Setup default mocks
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'app.maxConcurrentJobs':
          return 10;
        case 'DEPENDENCY_CHECK_ON_STARTUP':
          return false; // Disable startup check for tests
        default:
          return undefined;
      }
    });

    dependencyDetectionService.checkSystemDependencies.mockResolvedValue(mockDependencyStatus);
    dependencyDetectionService.isConversionSupported.mockResolvedValue(true);
    dependencyDetectionService.generateInstallationInstructions.mockReturnValue(mockInstallationInstructions);

    pdfConversionConfigService.getConfig.mockReturnValue({
      enabled: true,
      density: 200,
      format: 'png' as const,
      width: 2000,
      height: 2000,
      maxPages: 1,
      tempDir: '/tmp',
    });

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Dependency Error Handling', () => {
    it('should throw DependencyException when pdf2pic is not available', async () => {
      // Arrange
      const missingPdf2picStatus = {
        ...mockDependencyStatus,
        pdf2pic: {
          available: false,
          installationInstructions: 'npm install pdf2pic',
        },
      };

      dependencyDetectionService.checkSystemDependencies.mockResolvedValue(missingPdf2picStatus);
      dependencyDetectionService.isConversionSupported.mockResolvedValue(false);

      // Mock pdf-parse to return minimal text (triggering scanned PDF detection)
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '', // Empty text triggers scanned PDF processing
          numpages: 1,
        }),
      }));

      // Mock fs.readFileSync
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Act & Assert
      await expect(service.extractTextFromPdf('/test/document.pdf')).rejects.toThrow(DependencyException);

      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(DependencyException);
      expect(error.details.errorType).toBe('dependency');
      expect(error.details.dependencyStatus.pdf2pic.available).toBe(false);
      expect(error.getUserFriendlyMessage()).toContain('pdf2pic library');
    });

    it('should throw DependencyException when image processors are not available', async () => {
      // Arrange
      const missingImageProcessorStatus = {
        ...mockDependencyStatus,
        graphicsMagick: {
          available: false,
          installationInstructions: 'brew install graphicsmagick',
        },
        imageMagick: {
          available: false,
          installationInstructions: 'brew install imagemagick',
        },
      };

      dependencyDetectionService.checkSystemDependencies.mockResolvedValue(missingImageProcessorStatus);
      dependencyDetectionService.isConversionSupported.mockResolvedValue(false);

      // Mock pdf-parse to return minimal text
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(DependencyException);
      expect(error.details.dependencyStatus.graphicsMagick.available).toBe(false);
      expect(error.details.dependencyStatus.imageMagick.available).toBe(false);
      expect(error.getUserFriendlyMessage()).toContain('GraphicsMagick or ImageMagick');
    });

    it('should include platform-specific installation instructions', async () => {
      // Arrange
      const missingDependenciesStatus = {
        pdf2pic: {
          available: false,
          installationInstructions: 'npm install pdf2pic',
        },
        graphicsMagick: {
          available: false,
          installationInstructions: 'brew install graphicsmagick',
        },
        imageMagick: {
          available: false,
          installationInstructions: 'brew install imagemagick',
        },
      };

      dependencyDetectionService.checkSystemDependencies.mockResolvedValue(missingDependenciesStatus);
      dependencyDetectionService.isConversionSupported.mockResolvedValue(false);

      // Mock process.platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      // Mock pdf-parse
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      try {
        // Act & Assert
        const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
        expect(error).toBeInstanceOf(DependencyException);
        expect(error.details.installationHelp.platform).toBe('darwin');
        expect(error.details.installationHelp.instructions).toEqual(mockInstallationInstructions.macos);
        expect(error.getUserFriendlyMessage()).toContain('For darwin:');
        expect(error.getUserFriendlyMessage()).toContain('brew install imagemagick');
      } finally {
        // Restore original platform
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
        });
      }
    });
  });

  describe('Conversion Error Handling', () => {
    it('should throw ConversionException when PDF conversion is disabled', async () => {
      // Arrange
      pdfConversionConfigService.getConfig.mockReturnValue({
        enabled: false, // Disabled
        density: 200,
        format: 'png' as const,
        width: 2000,
        height: 2000,
        maxPages: 1,
        tempDir: '/tmp',
      });

      // Mock pdf-parse to return minimal text (triggering scanned PDF processing)
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(ConversionException);
      expect(error.details.errorType).toBe('conversion');
      expect(error.message).toContain('PDF-to-image conversion is disabled');
    });

    it('should throw ConversionException when pdf2pic fails', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
      }));

      jest.doMock('path', () => ({
        dirname: jest.fn().mockReturnValue('/tmp'),
        join: jest.fn().mockReturnValue('/tmp/test'),
      }));

      // Mock pdf2pic to throw an error
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn().mockReturnValue({
          __call: jest.fn().mockRejectedValue(new Error('pdf2pic conversion failed')),
        }),
      }));

      pdfConversionConfigService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'page_1',
        savePath: '/tmp/test',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(ConversionException);
      expect(error.details.errorType).toBe('conversion');
      expect(error.message).toContain('pdf2pic');
    });

    it('should include conversion details in ConversionException', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 3,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
        existsSync: jest.fn().mockReturnValue(false), // File doesn't exist - triggers error
      }));

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/nonexistent.pdf').catch(e => e);
      expect(error).toBeInstanceOf(ScannedPdfSystemException);
      expect(error.details.pdfPath).toBe('/test/nonexistent.pdf');
      expect(error.details.conversionDetails).toBeDefined();
    });
  });

  describe('OCR Error Handling', () => {
    it('should throw OcrException when OCR processing fails', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        statSync: jest.fn().mockReturnValue({ size: 1024 }),
      }));

      jest.doMock('path', () => ({
        dirname: jest.fn().mockReturnValue('/tmp'),
        join: jest.fn().mockReturnValue('/tmp/test'),
      }));

      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn().mockReturnValue(jest.fn().mockResolvedValue({
          path: '/tmp/converted.png',
        })),
      }));

      pdfConversionConfigService.getPdf2picOptions.mockReturnValue({
        density: 200,
        saveFilename: 'page_1',
        savePath: '/tmp/test',
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Mock the service's extractTextFromImage method to throw an error
      jest.spyOn(service, 'extractTextFromImage').mockRejectedValue(
        new Error('OCR processing failed')
      );

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(OcrException);
      expect(error.details.errorType).toBe('ocr');
      expect(error.details.failedAt).toBe('PDF-to-image OCR processing');
    });
  });

  describe('Partial Processing and Fallback Logic', () => {
    it('should return partial results when OCR fails but direct text is available', async () => {
      // Arrange
      const directText = 'Some extracted text from PDF metadata';
      
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: directText,
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Mock the private convertPdfToImageAndOcr method to throw an error
      const originalMethod = service['convertPdfToImageAndOcr'];
      service['convertPdfToImageAndOcr'] = jest.fn().mockRejectedValue(
        new Error('OCR conversion failed')
      );

      // Act
      const result = await service.extractTextFromPdf('/test/document.pdf');

      // Assert
      expect(result.text).toBe(directText);
      expect(result.confidence).toBe(25); // Low confidence due to OCR failure
      expect(result.metadata.ocrMethod).toBe('direct_fallback');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.partialProcessing).toBe(true);
      expect(result.metadata.ocrError).toContain('OCR conversion failed');

      // Restore original method
      service['convertPdfToImageAndOcr'] = originalMethod;
    });

    it('should throw OcrException when no fallback text is available', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '', // No direct text available
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Mock the private convertPdfToImageAndOcr method to throw an OCR error
      const originalMethod = service['convertPdfToImageAndOcr'];
      service['convertPdfToImageAndOcr'] = jest.fn().mockRejectedValue(
        new OcrException('OCR processing completely failed', '/test/document.pdf', 1, 1, 'tesseract')
      );

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(OcrException);
      expect(error.details.errorType).toBe('ocr');
      expect(error.details.attemptedPages).toBe(1);

      // Restore original method
      service['convertPdfToImageAndOcr'] = originalMethod;
    });

    it('should create PartialProcessingException with comprehensive details', async () => {
      // Arrange
      const partialText = 'Partial text from PDF';
      
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: partialText,
          numpages: 5,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Mock the private convertPdfToImageAndOcr method to throw a detailed OCR error
      const originalMethod = service['convertPdfToImageAndOcr'];
      const ocrError = new OcrException(
        'Tesseract failed to process image',
        '/test/complex.pdf',
        5,
        1,
        'tesseract recognition'
      );
      service['convertPdfToImageAndOcr'] = jest.fn().mockRejectedValue(ocrError);

      // Act
      const result = await service.extractTextFromPdf('/test/complex.pdf');

      // Assert
      expect(result.text).toBe(partialText);
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.partialProcessing).toBe(true);
      expect(result.metadata.originalPageCount).toBe(5);
      expect(result.metadata.ocrError).toContain('Tesseract failed to process image');

      // Restore original method
      service['convertPdfToImageAndOcr'] = originalMethod;
    });
  });

  describe('System Error Handling', () => {
    it('should throw ScannedPdfSystemException for file system errors', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
        existsSync: jest.fn().mockReturnValue(false), // File doesn't exist
      }));

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/nonexistent.pdf').catch(e => e);
      expect(error).toBeInstanceOf(ScannedPdfSystemException);
      expect(error.details.errorType).toBe('system');
      expect(error.message).toContain('does not exist');
    });

    it('should handle permission errors appropriately', async () => {
      // Arrange
      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn().mockImplementation(() => {
          const error = new Error('EACCES: permission denied');
          error.message = 'EACCES: permission denied, mkdir \'/restricted/path\'';
          throw error;
        }),
      }));

      jest.doMock('path', () => ({
        dirname: jest.fn().mockReturnValue('/restricted'),
        join: jest.fn().mockReturnValue('/restricted/test'),
      }));

      // Act & Assert
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);
      expect(error).toBeInstanceOf(ScannedPdfSystemException);
      expect(error.details.errorType).toBe('system');
      expect(error.message).toContain('permission');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable error messages for dependency issues', async () => {
      // Arrange
      const missingDependenciesStatus = {
        pdf2pic: {
          available: false,
          installationInstructions: 'npm install pdf2pic',
        },
        graphicsMagick: {
          available: false,
          installationInstructions: 'brew install graphicsmagick',
        },
        imageMagick: {
          available: false,
          installationInstructions: 'brew install imagemagick',
        },
      };

      dependencyDetectionService.checkSystemDependencies.mockResolvedValue(missingDependenciesStatus);
      dependencyDetectionService.isConversionSupported.mockResolvedValue(false);

      jest.doMock('pdf-parse', () => ({
        __esModule: true,
        default: jest.fn().mockResolvedValue({
          text: '',
          numpages: 1,
        }),
      }));

      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(Buffer.from('mock pdf data')),
      }));

      // Act
      const error = await service.extractTextFromPdf('/test/document.pdf').catch(e => e);

      // Assert
      expect(error).toBeInstanceOf(DependencyException);
      const userMessage = error.getUserFriendlyMessage();
      expect(userMessage).toContain('PDF-to-image conversion is not available');
      expect(userMessage).toContain('npm install pdf2pic');
      expect(userMessage).toContain('brew install');
      expect(userMessage).toMatch(/\d+\./); // Should contain numbered instructions
    });

    it('should provide helpful context for conversion failures', () => {
      const error = new ConversionException(
        'PDF appears to be corrupted',
        '/uploads/bad_file.pdf',
        1,
        {
          conversionTime: 5000,
          tempFilesCreated: ['/tmp/temp_image.png'],
          cleanupAttempted: true,
          cleanupSuccessful: false,
        }
      );

      const userMessage = error.getUserFriendlyMessage();
      expect(userMessage).toContain('corrupted PDF file');
      expect(userMessage).toContain('system resources');
      expect(userMessage).toContain('configuration issues');
    });
  });
});