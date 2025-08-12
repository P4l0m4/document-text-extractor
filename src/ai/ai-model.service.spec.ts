import { Test, TestingModule } from '@nestjs/testing';
import { AiModelService } from './ai-model.service';
import {
  TextExtractionResult,
  SummarizationResult,
} from './interfaces/ai-model.interface';

// Mock modules
jest.mock('tesseract.js', () => ({
  recognize: jest.fn(),
}));

jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

describe('AiModelService', () => {
  let service: AiModelService;
  let mockTesseract: any;
  let mockPdfParse: any;
  let mockFs: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiModelService],
    }).compile();

    service = module.get<AiModelService>(AiModelService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('extractTextFromImage', () => {
    beforeEach(() => {
      mockTesseract = require('tesseract.js');
    });

    it('should extract text from image successfully', async () => {
      const mockOcrResult = {
        data: {
          text: 'Sample extracted text from image',
          confidence: 95.5,
        },
      };

      mockTesseract.recognize.mockResolvedValue(mockOcrResult);

      const result: TextExtractionResult =
        await service.extractTextFromImage('/path/to/image.jpg');

      expect(result).toEqual({
        text: 'Sample extracted text from image',
        confidence: 95.5,
        metadata: {
          processingTime: expect.any(Number),
          language: 'eng',
        },
      });

      expect(mockTesseract.recognize).toHaveBeenCalledWith(
        '/path/to/image.jpg',
        'eng',
        expect.objectContaining({
          logger: expect.any(Function),
        }),
      );
    });

    it('should handle OCR errors gracefully', async () => {
      const mockError = new Error('OCR processing failed');
      mockTesseract.recognize.mockRejectedValue(mockError);

      await expect(
        service.extractTextFromImage('/path/to/image.jpg'),
      ).rejects.toThrow('OCR processing failed: OCR processing failed');
    });

    it('should trim whitespace from extracted text', async () => {
      const mockOcrResult = {
        data: {
          text: '  \n  Sample text with whitespace  \n  ',
          confidence: 90,
        },
      };

      mockTesseract.recognize.mockResolvedValue(mockOcrResult);

      const result = await service.extractTextFromImage('/path/to/image.jpg');

      expect(result.text).toBe('Sample text with whitespace');
    });
  });

  describe('extractTextFromPdf', () => {
    beforeEach(() => {
      mockPdfParse = require('pdf-parse').default;
      mockFs = require('fs');
    });

    it('should extract text from PDF successfully', async () => {
      const mockBuffer = Buffer.from('mock pdf content');
      const mockPdfData = {
        text: 'Sample extracted text from PDF',
        numpages: 3,
      };

      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData);

      const result: TextExtractionResult = await service.extractTextFromPdf(
        '/path/to/document.pdf',
      );

      expect(result).toEqual({
        text: 'Sample extracted text from PDF',
        confidence: 100,
        metadata: {
          pageCount: 3,
          processingTime: expect.any(Number),
        },
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/document.pdf');
      expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer);
    });

    it('should handle PDF parsing errors gracefully', async () => {
      const mockError = new Error('PDF parsing failed');
      mockFs.readFileSync.mockImplementation(() => {
        throw mockError;
      });

      await expect(
        service.extractTextFromPdf('/path/to/document.pdf'),
      ).rejects.toThrow('PDF processing failed: PDF parsing failed');
    });

    it('should trim whitespace from extracted PDF text', async () => {
      const mockBuffer = Buffer.from('mock pdf content');
      const mockPdfData = {
        text: '  \n  Sample PDF text with whitespace  \n  ',
        numpages: 1,
      };

      mockFs.readFileSync.mockReturnValue(mockBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData);

      const result = await service.extractTextFromPdf('/path/to/document.pdf');

      expect(result.text).toBe('Sample PDF text with whitespace');
    });
  });

  describe('generateSummary', () => {
    it('should generate extractive summary with default options', async () => {
      const inputText =
        'This is the first sentence. This is the second sentence. This is the third sentence with more content to test summarization.';

      const result: SummarizationResult =
        await service.generateSummary(inputText);

      expect(result).toEqual({
        summary: expect.any(String),
        originalLength: inputText.length,
        summaryLength: expect.any(Number),
        compressionRatio: expect.any(Number),
      });

      expect(result.summary.length).toBeLessThanOrEqual(200); // Default maxLength
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should generate extractive summary with custom maxLength', async () => {
      const inputText =
        'This is a long text that needs to be summarized. It contains multiple sentences and should be reduced to a shorter version.';
      const maxLength = 50;

      const result = await service.generateSummary(inputText, {
        maxLength,
        summaryType: 'extractive',
      });

      expect(result.summaryLength).toBeLessThanOrEqual(maxLength);
      expect(result.originalLength).toBe(inputText.length);
    });

    it('should generate abstractive summary', async () => {
      const inputText =
        'The document contains important information about financial reports. The quarterly earnings show significant growth. Revenue increased by twenty percent compared to last year.';

      const result = await service.generateSummary(inputText, {
        summaryType: 'abstractive',
        maxLength: 100,
        keywordCount: 3,
      });

      expect(result.summary).toBeDefined();
      expect(result.summaryLength).toBeLessThanOrEqual(100);
      expect(result.originalLength).toBe(inputText.length);
    });

    it('should handle empty text input', async () => {
      await expect(service.generateSummary('')).rejects.toThrow(
        'Summarization failed: Input text is empty or invalid',
      );

      await expect(service.generateSummary('   ')).rejects.toThrow(
        'Summarization failed: Input text is empty or invalid',
      );
    });

    it('should handle text shorter than maxLength', async () => {
      const shortText = 'Short text.';

      const result = await service.generateSummary(shortText, {
        maxLength: 100,
      });

      expect(result.summary).toBe('Short text.');
      expect(result.summaryLength).toBe(shortText.length);
      expect(result.compressionRatio).toBe(1);
    });

    it('should truncate text when no complete sentences fit', async () => {
      const longSentence =
        'This is a very long sentence without any punctuation that exceeds the maximum length limit and should be truncated';
      const maxLength = 50;

      const result = await service.generateSummary(longSentence, { maxLength });

      expect(result.summary).toContain('...');
      expect(result.summaryLength).toBeLessThanOrEqual(maxLength + 3); // +3 for '...'
    });

    it('should calculate compression ratio correctly', async () => {
      const inputText = 'A'.repeat(1000); // 1000 character string
      const maxLength = 100;

      const result = await service.generateSummary(inputText, { maxLength });

      expect(result.compressionRatio).toBeCloseTo(0.1, 1); // Should be around 10%
    });

    it('should prioritize sentences with higher scores in extractive summarization', async () => {
      const inputText =
        'This is a less important sentence at the end. The main topic discusses artificial intelligence and machine learning algorithms. These technologies are transforming various industries today.';

      const result = await service.generateSummary(inputText, {
        summaryType: 'extractive',
        maxLength: 150,
      });

      // Should prioritize sentences with more content and better positioning
      expect(result.summary).toContain('artificial intelligence');
    });

    it('should handle abstractive summarization with keyword extraction', async () => {
      const inputText =
        'Machine learning algorithms are becoming increasingly sophisticated. Deep learning models can process vast amounts of data. Neural networks enable pattern recognition in complex datasets. These technologies revolutionize data analysis.';

      const result = await service.generateSummary(inputText, {
        summaryType: 'abstractive',
        maxLength: 100,
        keywordCount: 4,
      });

      expect(result.summary).toBeDefined();
      expect(result.summaryLength).toBeLessThanOrEqual(100);
      // Should contain sentences with high keyword density
      expect(result.summary.toLowerCase()).toMatch(
        /learning|data|neural|algorithms/,
      );
    });

    it('should fallback gracefully when abstractive summarization finds no keywords', async () => {
      const inputText = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z.';

      const result = await service.generateSummary(inputText, {
        summaryType: 'abstractive',
        maxLength: 50,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle module import errors for Tesseract', async () => {
      // Mock dynamic import to fail
      const originalImport = global.import;
      global.import = jest
        .fn()
        .mockRejectedValue(new Error('Module not found'));

      await expect(
        service.extractTextFromImage('/path/to/image.jpg'),
      ).rejects.toThrow('OCR processing failed: Module not found');

      global.import = originalImport;
    });

    it('should handle module import errors for PDF parsing', async () => {
      // Mock dynamic import to fail
      const originalImport = global.import;
      global.import = jest
        .fn()
        .mockRejectedValue(new Error('PDF module not found'));

      await expect(
        service.extractTextFromPdf('/path/to/document.pdf'),
      ).rejects.toThrow('PDF processing failed: PDF module not found');

      global.import = originalImport;
    });
  });
});
