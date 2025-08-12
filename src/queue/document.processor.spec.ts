import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DocumentProcessor } from './document.processor';
import { TaskService } from '../task/task.service';
import { ProcessingService } from '../processing/processing.service';
import { ProcessingResult } from '../common/interfaces/task.interface';
import { DocumentProcessingJobData } from './queue.service';
import {
  ProcessingException,
  AIModelException,
  TextExtractionException,
  SummarizationException,
  DocumentCorruptedException,
  UnsupportedDocumentException,
  FileSystemException,
  SystemException,
} from '../common/exceptions';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockTaskService: jest.Mocked<TaskService>;
  let mockProcessingService: jest.Mocked<ProcessingService>;

  const mockJobData: DocumentProcessingJobData = {
    taskId: 'task-123',
    filePath: '/tmp/test.pdf',
    fileName: 'test.pdf',
    fileType: 'application/pdf',
  };

  const mockJob: Partial<Job<DocumentProcessingJobData>> = {
    id: 'job-123',
    data: mockJobData,
    timestamp: Date.now(),
    progress: jest.fn(),
  };

  const mockProcessingResult: ProcessingResult = {
    extractedText: 'Extracted text from test.pdf',
    summary: 'Summary of test.pdf',
    metadata: {
      fileSize: 1024,
      processingTime: 1500,
      confidence: 95,
    },
  };

  beforeEach(async () => {
    const mockTaskServiceMethods = {
      updateTaskStatus: jest.fn(),
      updateTaskResult: jest.fn(),
      updateTaskError: jest.fn(),
    };

    const mockProcessingServiceMethods = {
      processDocument: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentProcessor,
        {
          provide: TaskService,
          useValue: mockTaskServiceMethods,
        },
        {
          provide: ProcessingService,
          useValue: mockProcessingServiceMethods,
        },
      ],
    }).compile();

    processor = module.get<DocumentProcessor>(DocumentProcessor);
    mockTaskService = module.get(TaskService);
    mockProcessingService = module.get(ProcessingService);

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('processDocument', () => {
    it('should successfully process a document using ProcessingService', async () => {
      // Arrange
      mockProcessingService.processDocument.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      const result = await processor.processDocument(
        mockJob as Job<DocumentProcessingJobData>,
      );

      // Assert
      expect(mockProcessingService.processDocument).toHaveBeenCalledWith(
        mockJobData.taskId,
        mockJobData.filePath,
        {
          generateSummary: true,
          maxSummaryLength: 200,
          summaryType: 'extractive',
        },
      );

      expect(result).toEqual(mockProcessingResult);
    });

    it('should handle processing errors from ProcessingService', async () => {
      // Arrange
      const error = new Error('Processing failed');
      mockProcessingService.processDocument.mockRejectedValue(error);

      // Act & Assert
      await expect(
        processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
      ).rejects.toThrow('Processing failed');

      expect(mockProcessingService.processDocument).toHaveBeenCalledWith(
        mockJobData.taskId,
        mockJobData.filePath,
        {
          generateSummary: true,
          maxSummaryLength: 200,
          summaryType: 'extractive',
        },
      );
    });

    it('should log processing start and completion', async () => {
      // Arrange
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      mockProcessingService.processDocument.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      await processor.processDocument(
        mockJob as Job<DocumentProcessingJobData>,
      );

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Starting processing for task ${mockJobData.taskId}`,
        ),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Completed processing for task ${mockJobData.taskId}`,
        ),
      );
    });

    it('should log error when processing fails', async () => {
      // Arrange
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const error = new Error('Test error');
      mockProcessingService.processDocument.mockRejectedValue(error);

      // Act & Assert
      await expect(
        processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to process task ${mockJobData.taskId}`),
        error,
      );
    });

    it('should pass correct processing options to ProcessingService', async () => {
      // Arrange
      mockProcessingService.processDocument.mockResolvedValue(
        mockProcessingResult,
      );

      // Act
      await processor.processDocument(
        mockJob as Job<DocumentProcessingJobData>,
      );

      // Assert
      expect(mockProcessingService.processDocument).toHaveBeenCalledWith(
        mockJobData.taskId,
        mockJobData.filePath,
        expect.objectContaining({
          generateSummary: true,
          maxSummaryLength: 200,
          summaryType: 'extractive',
        }),
      );
    });

    describe('error handling scenarios', () => {
      it('should handle ProcessingException and re-throw', async () => {
        const processingError = new ProcessingException(
          'Document processing failed',
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(
          processingError,
        );

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(ProcessingException);

        expect(mockProcessingService.processDocument).toHaveBeenCalledWith(
          mockJobData.taskId,
          mockJobData.filePath,
          expect.objectContaining({
            generateSummary: true,
            maxSummaryLength: 200,
            summaryType: 'extractive',
          }),
        );
      });

      it('should handle AIModelException and re-throw', async () => {
        const aiError = new AIModelException(
          'AI model unavailable',
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(aiError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(AIModelException);
      });

      it('should handle TextExtractionException and re-throw', async () => {
        const extractionError = new TextExtractionException(
          'OCR failed to extract text',
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(
          extractionError,
        );

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(TextExtractionException);
      });

      it('should handle SummarizationException and re-throw', async () => {
        const summaryError = new SummarizationException(
          'Summarization failed',
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(summaryError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(SummarizationException);
      });

      it('should handle DocumentCorruptedException and re-throw', async () => {
        const corruptedError = new DocumentCorruptedException(
          mockJobData.fileName,
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(corruptedError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(DocumentCorruptedException);
      });

      it('should handle UnsupportedDocumentException and re-throw', async () => {
        const unsupportedError = new UnsupportedDocumentException(
          mockJobData.fileName,
          'Encrypted PDF not supported',
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(
          unsupportedError,
        );

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(UnsupportedDocumentException);
      });

      it('should handle FileSystemException and re-throw', async () => {
        const fsError = new FileSystemException(
          'read',
          mockJobData.filePath,
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(fsError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(FileSystemException);
      });

      it('should handle SystemException and re-throw', async () => {
        const systemError = new SystemException(
          'System resource exhausted',
          undefined,
          mockJobData.taskId,
        );
        mockProcessingService.processDocument.mockRejectedValue(systemError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow(SystemException);
      });

      it('should handle generic errors and re-throw', async () => {
        const genericError = new Error('Unexpected error occurred');
        mockProcessingService.processDocument.mockRejectedValue(genericError);

        await expect(
          processor.processDocument(mockJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow('Unexpected error occurred');
      });

      it('should handle malformed job data gracefully', async () => {
        const malformedJob = {
          ...mockJob,
          data: {
            taskId: '',
            filePath: '',
            fileName: '',
            fileType: '',
          },
        };

        const processingError = new ProcessingException('Invalid job data', '');
        mockProcessingService.processDocument.mockRejectedValue(
          processingError,
        );

        await expect(
          processor.processDocument(
            malformedJob as Job<DocumentProcessingJobData>,
          ),
        ).rejects.toThrow(ProcessingException);
      });

      it('should handle null/undefined job data', async () => {
        const nullJob = {
          ...mockJob,
          data: null as any,
        };

        await expect(
          processor.processDocument(nullJob as Job<DocumentProcessingJobData>),
        ).rejects.toThrow();
      });
    });
  });
});
