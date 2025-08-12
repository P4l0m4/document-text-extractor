import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiModelPoolService } from './ai-model-pool.service';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { TextExtractionResult } from './interfaces/ai-model.interface';

// Mock pdf-parse module
const mockPdfParse = jest.fn();
jest.mock('pdf-parse', () => mockPdfParse);

// Mock fs module
const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

describe('AiModelPoolService - Scanned PDF Detection', () => {
  let service: AiModelPoolService;
  let dependencyService: DependencyDetectionService;
  let configService: ConfigService;
  let pdfConfigService: PdfConversionConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiModelPoolService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'app.maxConcurrentJobs':
                  return 10;
                case 'DEPENDENCY_CHECK_ON_STARTUP':
                  return false; // Disable startup checks for tests
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: DependencyDetectionService,
          useValue: {
            checkSystemDependencies: jest.fn().mockResolvedValue({
              graphicsMagick: { available: true },
              imageMagick: { available: true },
              pdf2pic: { available: true },
            }),
            isConversionSupported: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PdfConversionConfigService,
          useValue: {
            getConfig: jest.fn().mockReturnValue({
              enabled: true,
              density: 200,
              format: 'png',
              width: 2000,
              height: 2000,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiModelPoolService>(AiModelPoolService);
    dependencyService = module.get<DependencyDetectionService>(DependencyDetectionService);
    configService = module.get<ConfigService>(ConfigService);
    pdfConfigService = module.get<PdfConversionConfigService>(PdfConversionConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('analyzeScannedPdfContent', () => {
    it('should detect completely empty PDF as scanned', () => {
      // Access private method for testing
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      const result = analyzeMethod('', 1);
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toBe('No extractable text found');
      expect(result.textDensity).toBe(0);
      expect(result.averageWordsPerPage).toBe(0);
    });

    it('should detect PDF with minimal text as scanned', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // Only 3 words, below the 20-word threshold
      const result = analyzeMethod('Page 1 only', 1);
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toContain('Too few total words');
      expect(result.averageWordsPerPage).toBe(3);
    });

    it('should detect PDF with low word density per page as scanned', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // 30 words across 2 pages = 15 words/page (below 50 threshold)
      const text = 'This is a short document with minimal text content spread across multiple pages for testing purposes.';
      const result = analyzeMethod(text, 2);
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toContain('Low word density');
      expect(result.averageWordsPerPage).toBeLessThan(50);
    });

    it('should detect PDF with low character density as scanned', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // Short text across many pages
      const text = 'Short text here with some words but not enough characters per page.';
      const result = analyzeMethod(text, 5); // Spread across 5 pages
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toContain('Low character density');
      expect(result.textDensity).toBeLessThan(200);
    });

    it('should detect PDF with only page numbers as scanned', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      const result = analyzeMethod('1', 1);
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toContain('suspicious patterns');
    });

    it('should detect PDF with only whitespace as scanned', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      const result = analyzeMethod('   \n\n\r\r   ', 1);
      
      expect(result.isScannedPdf).toBe(true);
      expect(result.reason).toContain('suspicious patterns');
    });

    it('should identify text-based PDF with sufficient content', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // Rich text content with good density
      const text = `
        This is a comprehensive document with substantial text content that clearly indicates
        it is a text-based PDF rather than a scanned document. The document contains multiple
        paragraphs with meaningful content, proper sentence structure, and sufficient word
        density per page to be considered a digitally created document. This type of content
        would typically be found in documents created directly in word processors or other
        digital authoring tools rather than scanned from physical documents.
      `;
      
      const result = analyzeMethod(text, 1);
      
      expect(result.isScannedPdf).toBe(false);
      expect(result.reason).toContain('Sufficient text content detected');
      expect(result.averageWordsPerPage).toBeGreaterThan(50);
      expect(result.textDensity).toBeGreaterThan(200);
    });

    it('should handle multi-page documents correctly', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // Moderate text across multiple pages
      const text = `
        This document has moderate text content spread across multiple pages.
        Each page contains a reasonable amount of text that should be sufficient
        to identify this as a text-based document rather than a scanned one.
        The word density and character density should be above the thresholds.
      `;
      
      const result = analyzeMethod(text, 2);
      
      expect(result.isScannedPdf).toBe(false);
      expect(result.averageWordsPerPage).toBeGreaterThan(25);
      expect(result.textDensity).toBeGreaterThan(100);
    });

    it('should calculate metrics correctly for edge cases', () => {
      const analyzeMethod = (service as any).analyzeScannedPdfContent.bind(service);
      
      // Test with zero pages (edge case)
      const result = analyzeMethod('Some text', 0);
      
      expect(result.textDensity).toBe(0);
      expect(result.averageWordsPerPage).toBe(0);
      expect(result.isScannedPdf).toBe(true);
    });
  });

  describe('extractTextFromPdf - Integration with Detection Logic', () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.readFileSync.mockReturnValue(Buffer.from('mock pdf data'));
    });

    it('should prioritize direct text extraction for text-based PDFs', async () => {
      // Mock pdf-parse to return substantial text content
      mockPdfParse.mockResolvedValue({
        text: `
          This is a comprehensive text-based PDF document with substantial content.
          It contains multiple paragraphs and sufficient text density to be clearly
          identified as a digitally created document rather than a scanned one.
          The robust detection logic should identify this as text-based and prioritize
          direct text extraction over PDF-to-image conversion.
        `,
        numpages: 1,
      });

      const result = await service.extractTextFromPdf('/mock/path.pdf');

      expect(result.metadata.isScannedPdf).toBe(false);
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(result.metadata.detectionReason).toContain('Sufficient text content detected');
      expect(result.metadata.textDensity).toBeGreaterThan(200);
      expect(result.metadata.averageWordsPerPage).toBeGreaterThan(50);
      expect(result.confidence).toBe(100);
    });

    it('should detect scanned PDF with no text and attempt OCR', async () => {
      // Mock pdf-parse to return no text
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      // Mock the OCR conversion method to avoid actual conversion
      const mockOcrResult: TextExtractionResult = {
        text: 'OCR extracted text from scanned PDF',
        confidence: 85,
        metadata: {
          processingTime: 1000,
          ocrMethod: 'pdf-to-image',
          isScannedPdf: true,
        },
      };

      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockResolvedValue(mockOcrResult);

      const result = await service.extractTextFromPdf('/mock/scanned.pdf');

      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.detectionReason).toBe('No extractable text found');
      expect(result.metadata.textDensity).toBe(0);
      expect(result.metadata.averageWordsPerPage).toBe(0);
      expect(result.text).toBe('OCR extracted text from scanned PDF');
    });

    it('should detect scanned PDF with minimal text and attempt OCR', async () => {
      // Mock pdf-parse to return minimal text (just page numbers)
      mockPdfParse.mockResolvedValue({
        text: '1 2 3',
        numpages: 3,
      });

      const mockOcrResult: TextExtractionResult = {
        text: 'Full OCR text extracted from scanned pages',
        confidence: 78,
        metadata: {
          processingTime: 2000,
          ocrMethod: 'pdf-to-image',
          isScannedPdf: true,
        },
      };

      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockResolvedValue(mockOcrResult);

      const result = await service.extractTextFromPdf('/mock/minimal.pdf');

      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.detectionReason).toContain('Too few total words');
      expect(result.metadata.directTextLength).toBe(5); // Length of '1 2 3'
      expect(result.text).toBe('Full OCR text extracted from scanned pages');
    });

    it('should handle OCR failure gracefully with fallback to direct text', async () => {
      // Mock pdf-parse to return minimal but some text
      mockPdfParse.mockResolvedValue({
        text: 'Page 1 Header Some minimal content here',
        numpages: 1,
      });

      // Mock OCR conversion to fail
      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockRejectedValue(
        new Error('OCR conversion failed - missing dependencies')
      );

      const result = await service.extractTextFromPdf('/mock/ocr-fail.pdf');

      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.ocrMethod).toBe('direct_fallback');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.ocrError).toContain('OCR conversion failed');
      expect(result.text).toBe('Page 1 Header Some minimal content here');
      expect(result.confidence).toBe(25); // Low confidence due to OCR failure
    });

    it('should return empty result when OCR fails and no direct text available', async () => {
      // Mock pdf-parse to return no text
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
      });

      // Mock OCR conversion to fail
      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockRejectedValue(
        new Error('OCR conversion failed')
      );

      const result = await service.extractTextFromPdf('/mock/empty-ocr-fail.pdf');

      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.ocrError).toContain('OCR conversion failed');
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should handle mixed content PDFs correctly', async () => {
      // Mock pdf-parse to return text that's borderline (some text but low density)
      mockPdfParse.mockResolvedValue({
        text: 'Chapter 1 Introduction Brief overview of the topic.',
        numpages: 5, // Low density across many pages
      });

      const mockOcrResult: TextExtractionResult = {
        text: 'Enhanced OCR text with more complete content from scanned pages',
        confidence: 82,
        metadata: {
          processingTime: 1500,
          ocrMethod: 'pdf-to-image',
          isScannedPdf: true,
        },
      };

      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockResolvedValue(mockOcrResult);

      const result = await service.extractTextFromPdf('/mock/mixed.pdf');

      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.detectionReason).toContain('Low word density');
      expect(result.metadata.averageWordsPerPage).toBeLessThan(50);
      expect(result.text).toBe('Enhanced OCR text with more complete content from scanned pages');
    });

    it('should include comprehensive metadata in results', async () => {
      mockPdfParse.mockResolvedValue({
        text: 'Minimal text content for testing',
        numpages: 2,
      });

      const mockOcrResult: TextExtractionResult = {
        text: 'OCR result text',
        confidence: 75,
        metadata: {
          processingTime: 1200,
          ocrMethod: 'pdf-to-image',
          isScannedPdf: true,
          conversionTime: 500,
          ocrTime: 700,
        },
      };

      jest.spyOn(service as any, 'convertPdfToImageAndOcr').mockResolvedValue(mockOcrResult);

      const result = await service.extractTextFromPdf('/mock/metadata.pdf');

      // Verify all new metadata fields are present
      expect(result.metadata.textDensity).toBeDefined();
      expect(result.metadata.averageWordsPerPage).toBeDefined();
      expect(result.metadata.detectionReason).toBeDefined();
      expect(result.metadata.directTextLength).toBeDefined();
      expect(result.metadata.isScannedPdf).toBe(true);
      expect(result.metadata.pageCount).toBe(2);
      expect(result.metadata.originalPageCount).toBe(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle PDF parsing errors gracefully', async () => {
      mockFs.readFileSync.mockReturnValue(Buffer.from('invalid pdf data'));
      mockPdfParse.mockRejectedValue(new Error('Invalid PDF format'));

      await expect(service.extractTextFromPdf('/mock/invalid.pdf')).rejects.toThrow(
        'PDF processing failed: Invalid PDF format'
      );
    });

    it('should handle file system errors', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(service.extractTextFromPdf('/mock/missing.pdf')).rejects.toThrow(
        'PDF processing failed: File not found'
      );
    });
  });
});