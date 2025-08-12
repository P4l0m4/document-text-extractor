import {
  ScannedPdfException,
  DependencyException,
  ConversionException,
  OcrException,
  ScannedPdfSystemException,
  PartialProcessingException,
  ScannedPdfErrorDetails,
} from './scanned-pdf.exception';

describe('ScannedPdfException', () => {
  describe('ScannedPdfException', () => {
    it('should create exception with basic details', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'conversion',
        pdfPath: '/test/path.pdf',
        pageCount: 5,
      };

      const exception = new ScannedPdfException('Test error', details, 'task-123');

      expect(exception.message).toBe('Scanned PDF processing failed: Test error');
      expect(exception.details).toEqual(details);
      expect(exception.details.errorType).toBe('conversion');
    });

    it('should generate user-friendly message for dependency errors', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'dependency',
        dependencyStatus: {
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
        },
        installationHelp: {
          platform: 'darwin',
          instructions: ['brew install imagemagick', 'brew install graphicsmagick'],
          downloadLinks: ['https://imagemagick.org'],
        },
      };

      const exception = new ScannedPdfException('Missing dependencies', details);
      const userMessage = exception.getUserFriendlyMessage();

      expect(userMessage).toContain('PDF-to-image conversion is not available');
      expect(userMessage).toContain('pdf2pic library');
      expect(userMessage).toContain('GraphicsMagick or ImageMagick');
      expect(userMessage).toContain('For darwin:');
      expect(userMessage).toContain('brew install imagemagick');
    });

    it('should generate user-friendly message for conversion errors', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'conversion',
        pdfPath: '/test/corrupted.pdf',
      };

      const exception = new ScannedPdfException('Conversion failed', details);
      const userMessage = exception.getUserFriendlyMessage();

      expect(userMessage).toContain('PDF-to-image conversion failed');
      expect(userMessage).toContain('corrupted PDF file');
      expect(userMessage).toContain('system resources');
    });

    it('should generate user-friendly message for OCR errors', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        pdfPath: '/test/lowquality.pdf',
      };

      const exception = new ScannedPdfException('OCR failed', details);
      const userMessage = exception.getUserFriendlyMessage();

      expect(userMessage).toContain('OCR processing failed');
      expect(userMessage).toContain('successful PDF-to-image conversion');
      expect(userMessage).toContain('poor image quality');
    });

    it('should generate user-friendly message for system errors', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'system',
        pdfPath: '/test/permission.pdf',
      };

      const exception = new ScannedPdfException('System error', details);
      const userMessage = exception.getUserFriendlyMessage();

      expect(userMessage).toContain('System error during scanned PDF processing');
      expect(userMessage).toContain('file system permissions');
      expect(userMessage).toContain('memory constraints');
    });

    it('should check for partial results availability', () => {
      const detailsWithPartial: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        partialResults: {
          directTextAvailable: true,
          directTextLength: 150,
          fallbackUsed: true,
        },
      };

      const detailsWithoutPartial: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        partialResults: {
          directTextAvailable: false,
          directTextLength: 0,
          fallbackUsed: false,
        },
      };

      const exceptionWithPartial = new ScannedPdfException('Test', detailsWithPartial);
      const exceptionWithoutPartial = new ScannedPdfException('Test', detailsWithoutPartial);

      expect(exceptionWithPartial.hasPartialResults()).toBe(true);
      expect(exceptionWithoutPartial.hasPartialResults()).toBe(false);
    });

    it('should return partial results when available', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        partialResults: {
          directTextAvailable: true,
          directTextLength: 150,
          fallbackUsed: true,
        },
      };

      const exception = new ScannedPdfException('Test', details);
      const partialResults = exception.getPartialResults();

      expect(partialResults).toEqual({
        directTextLength: 150,
        fallbackUsed: true,
      });
    });

    it('should return null for partial results when not available', () => {
      const details: ScannedPdfErrorDetails = {
        errorType: 'ocr',
      };

      const exception = new ScannedPdfException('Test', details);
      const partialResults = exception.getPartialResults();

      expect(partialResults).toBeNull();
    });
  });

  describe('DependencyException', () => {
    it('should create dependency exception with proper details', () => {
      const missingDependencies = ['pdf2pic', 'GraphicsMagick'];
      const dependencyStatus = {
        pdf2pic: {
          available: false,
          installationInstructions: 'npm install pdf2pic',
        },
        graphicsMagick: {
          available: false,
          installationInstructions: 'brew install graphicsmagick',
        },
        imageMagick: {
          available: true,
          version: '7.1.0',
          path: '/usr/local/bin/convert',
          installationInstructions: 'brew install imagemagick',
        },
      };
      const installationHelp = {
        platform: 'darwin',
        instructions: ['brew install graphicsmagick'],
        downloadLinks: ['https://graphicsmagick.org'],
      };

      const exception = new DependencyException(
        missingDependencies,
        dependencyStatus,
        installationHelp,
        'task-456',
      );

      expect(exception.message).toContain('Missing required dependencies');
      expect(exception.message).toContain('pdf2pic, GraphicsMagick');
      expect(exception.details.errorType).toBe('dependency');
      expect(exception.details.dependencyStatus).toEqual(dependencyStatus);
      expect(exception.details.installationHelp).toEqual(installationHelp);
    });
  });

  describe('ConversionException', () => {
    it('should create conversion exception with proper details', () => {
      const conversionDetails = {
        conversionTime: 5000,
        tempFilesCreated: ['/tmp/page1.png'],
        cleanupAttempted: true,
        cleanupSuccessful: false,
      };

      const exception = new ConversionException(
        'PDF conversion failed',
        '/test/document.pdf',
        3,
        conversionDetails,
        'task-789',
      );

      expect(exception.message).toContain('PDF conversion failed');
      expect(exception.details.errorType).toBe('conversion');
      expect(exception.details.pdfPath).toBe('/test/document.pdf');
      expect(exception.details.pageCount).toBe(3);
      expect(exception.details.conversionDetails).toEqual(conversionDetails);
    });
  });

  describe('OcrException', () => {
    it('should create OCR exception with proper details', () => {
      const exception = new OcrException(
        'OCR processing failed',
        '/test/scanned.pdf',
        5,
        2,
        'tesseract recognition',
        'task-101',
      );

      expect(exception.message).toContain('OCR processing failed');
      expect(exception.details.errorType).toBe('ocr');
      expect(exception.details.pdfPath).toBe('/test/scanned.pdf');
      expect(exception.details.pageCount).toBe(5);
      expect(exception.details.attemptedPages).toBe(2);
      expect(exception.details.failedAt).toBe('tesseract recognition');
    });
  });

  describe('ScannedPdfSystemException', () => {
    it('should create system exception with proper details', () => {
      const conversionDetails = {
        conversionTime: 2000,
        tempFilesCreated: ['/tmp/temp_dir'],
        cleanupAttempted: false,
        cleanupSuccessful: false,
      };

      const exception = new ScannedPdfSystemException(
        'File system error',
        '/test/protected.pdf',
        conversionDetails,
        'task-202',
      );

      expect(exception.message).toContain('File system error');
      expect(exception.details.errorType).toBe('system');
      expect(exception.details.pdfPath).toBe('/test/protected.pdf');
      expect(exception.details.conversionDetails).toEqual(conversionDetails);
    });
  });

  describe('PartialProcessingException', () => {
    it('should create partial processing exception with fallback results', () => {
      const partialResults = {
        directTextAvailable: true,
        directTextLength: 250,
        fallbackUsed: true,
      };

      const originalError: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        pdfPath: '/test/partial.pdf',
        pageCount: 4,
        attemptedPages: 1,
        failedAt: 'OCR processing',
      };

      const exception = new PartialProcessingException(
        'Partial processing with fallback',
        '/test/partial.pdf',
        partialResults,
        originalError,
        'task-303',
      );

      expect(exception.message).toContain('Partial processing with fallback');
      expect(exception.details.errorType).toBe('ocr');
      expect(exception.details.pdfPath).toBe('/test/partial.pdf');
      expect(exception.details.partialResults).toEqual(partialResults);
      expect(exception.hasPartialResults()).toBe(true);

      const retrievedPartialResults = exception.getPartialResults();
      expect(retrievedPartialResults).toEqual({
        directTextLength: 250,
        fallbackUsed: true,
      });
    });
  });

  describe('Error Type Validation', () => {
    it('should handle all error types correctly', () => {
      const errorTypes: Array<ScannedPdfErrorDetails['errorType']> = [
        'dependency',
        'conversion',
        'ocr',
        'system',
      ];

      errorTypes.forEach((errorType) => {
        const details: ScannedPdfErrorDetails = {
          errorType,
          pdfPath: '/test/test.pdf',
        };

        const exception = new ScannedPdfException(`Test ${errorType} error`, details);
        expect(exception.details.errorType).toBe(errorType);

        const userMessage = exception.getUserFriendlyMessage();
        expect(userMessage).toBeTruthy();
        expect(userMessage.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle dependency exception with all missing dependencies', () => {
      const missingDependencies = ['pdf2pic', 'GraphicsMagick or ImageMagick'];
      const dependencyStatus = {
        pdf2pic: {
          available: false,
          installationInstructions: 'npm install pdf2pic',
        },
        graphicsMagick: {
          available: false,
          installationInstructions: 'sudo apt-get install graphicsmagick',
        },
        imageMagick: {
          available: false,
          installationInstructions: 'sudo apt-get install imagemagick',
        },
      };
      const installationHelp = {
        platform: 'linux',
        instructions: [
          'sudo apt-get update',
          'sudo apt-get install imagemagick',
          'npm install pdf2pic',
        ],
        downloadLinks: [
          'https://imagemagick.org/script/download.php',
          'http://www.graphicsmagick.org/download.html',
        ],
      };

      const exception = new DependencyException(
        missingDependencies,
        dependencyStatus,
        installationHelp,
      );

      const userMessage = exception.getUserFriendlyMessage();
      expect(userMessage).toContain('PDF-to-image conversion is not available');
      expect(userMessage).toContain('pdf2pic library');
      expect(userMessage).toContain('GraphicsMagick or ImageMagick');
      expect(userMessage).toContain('For linux:');
      expect(userMessage).toContain('sudo apt-get install imagemagick');
    });

    it('should handle conversion exception with detailed conversion info', () => {
      const conversionDetails = {
        conversionTime: 15000,
        tempFilesCreated: ['/tmp/pdf_images_123/page_1.png', '/tmp/pdf_images_123'],
        cleanupAttempted: true,
        cleanupSuccessful: false,
      };

      const exception = new ConversionException(
        'PDF file appears to be corrupted',
        '/uploads/corrupted_document.pdf',
        10,
        conversionDetails,
      );

      expect(exception.details.conversionDetails?.conversionTime).toBe(15000);
      expect(exception.details.conversionDetails?.tempFilesCreated).toHaveLength(2);
      expect(exception.details.conversionDetails?.cleanupAttempted).toBe(true);
      expect(exception.details.conversionDetails?.cleanupSuccessful).toBe(false);

      const userMessage = exception.getUserFriendlyMessage();
      expect(userMessage).toContain('corrupted PDF file');
    });

    it('should handle partial processing with comprehensive error details', () => {
      const partialResults = {
        directTextAvailable: true,
        directTextLength: 75,
        fallbackUsed: true,
      };

      const originalError: ScannedPdfErrorDetails = {
        errorType: 'ocr',
        pdfPath: '/uploads/low_quality_scan.pdf',
        pageCount: 8,
        attemptedPages: 1,
        failedAt: 'tesseract OCR processing',
        conversionDetails: {
          conversionTime: 3000,
          tempFilesCreated: ['/tmp/converted_image.png'],
          cleanupAttempted: true,
          cleanupSuccessful: true,
        },
      };

      const exception = new PartialProcessingException(
        'OCR failed but extracted some direct text',
        '/uploads/low_quality_scan.pdf',
        partialResults,
        originalError,
      );

      expect(exception.hasPartialResults()).toBe(true);
      expect(exception.getPartialResults()?.directTextLength).toBe(75);
      expect(exception.getPartialResults()?.fallbackUsed).toBe(true);
      expect(exception.details.conversionDetails?.cleanupSuccessful).toBe(true);
    });
  });
});