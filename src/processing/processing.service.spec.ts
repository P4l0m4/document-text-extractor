import { Test, TestingModule } from '@nestjs/testing';
import { ProcessingService, ProcessingOptions } from './processing.service';
import { AiModelService } from '../ai/ai-model.service';
import { TaskService } from '../task/task.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import {
  TaskStatus,
  ProcessingResult,
} from '../common/interfaces/task.interface';
import {
  TextExtractionResult,
  SummarizationResult,
} from '../ai/interfaces/ai-model.interface';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ProcessingService', () => {
  let service: ProcessingService;
  let aiModelService: jest.Mocked<AiModelService>;
  let taskService: jest.Mocked<TaskService>;
  let fileCleanupService: jest.Mocked<FileCleanupService>;

  const mockTextExtractionResult: TextExtractionResult = {
    text: 'This is extracted text from the document.',
    confidence: 95,
    metadata: {
      processingTime: 1000,
      language: 'eng',
    },
  };

  const mockSummarizationResult: SummarizationResult = {
    summary: 'This is a summary of the extracted text.',
    originalLength: 42,
    summaryLength: 38,
    compressionRatio: 0.9,
  };

  beforeEach(async () => {
    const mockAiModelService = {
      extractTextFromImage: jest.fn(),
      extractTextFromPdf: jest.fn(),
      generateSummary: jest.fn(),
    };

    const mockTaskService = {
      updateTaskStatus: jest.fn(),
      updateTaskResult: jest.fn(),
      updateTaskError: jest.fn(),
      getTask: jest.fn(),
    };

    const mockFileCleanupService = {
      cleanupFile: jest.fn(),
      trackFile: jest.fn(),
      untrackFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingService,
        {
          provide: AiModelService,
          useValue: mockAiModelService,
        },
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: FileCleanupService,
          useValue: mockFileCleanupService,
        },
      ],
    }).compile();

    service = module.get<ProcessingService>(ProcessingService);
    aiModelService = module.get(AiModelService);
    taskService = module.get(TaskService);
    fileCleanupService = module.get(FileCleanupService);

    // Setup default mocks
    mockFs.statSync.mockReturnValue({
      size: 1024,
    } as fs.Stats);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processDocument', () => {
    const taskId = 'test-task-id';
    const imagePath = '/tmp/test-image.png';
    const pdfPath = '/tmp/test-document.pdf';

    it('should process an image file successfully', async () => {
      // Arrange
      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.generateSummary.mockResolvedValue(mockSummarizationResult);

      // Act
      const result = await service.processDocument(taskId, imagePath);

      // Assert
      expect(aiModelService.extractTextFromImage).toHaveBeenCalledWith(
        imagePath,
      );
      expect(aiModelService.generateSummary).toHaveBeenCalledWith(
        mockTextExtractionResult.text,
        {
          maxLength: 200,
          summaryType: 'extractive',
        },
      );

      expect(taskService.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        0,
      );
      expect(taskService.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        20,
      );
      expect(taskService.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        60,
      );
      expect(taskService.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        90,
      );

      expect(taskService.updateTaskResult).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          extractedText: mockTextExtractionResult.text,
          summary: mockSummarizationResult.summary,
          metadata: expect.objectContaining({
            fileSize: 1024,
            confidence: mockTextExtractionResult.confidence,
          }),
        }),
      );

      expect(result.extractedText).toBe(mockTextExtractionResult.text);
      expect(result.summary).toBe(mockSummarizationResult.summary);

      // Verify file cleanup after successful processing
      expect(fileCleanupService.cleanupFile).toHaveBeenCalledWith(imagePath);
    });

    it('should process a PDF file successfully', async () => {
      // Arrange
      const pdfExtractionResult = {
        ...mockTextExtractionResult,
        metadata: {
          ...mockTextExtractionResult.metadata,
          pageCount: 3,
        },
      };
      aiModelService.extractTextFromPdf.mockResolvedValue(pdfExtractionResult);
      aiModelService.generateSummary.mockResolvedValue(mockSummarizationResult);

      // Act
      const result = await service.processDocument(taskId, pdfPath);

      // Assert
      expect(aiModelService.extractTextFromPdf).toHaveBeenCalledWith(pdfPath);
      expect(result.metadata.pageCount).toBe(3);
    });

    it('should process without summary when generateSummary is false', async () => {
      // Arrange
      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      const options: ProcessingOptions = { generateSummary: false };

      // Act
      const result = await service.processDocument(taskId, imagePath, options);

      // Assert
      expect(aiModelService.generateSummary).not.toHaveBeenCalled();
      expect(result.summary).toBe('');
    });

    it('should process without summary when extracted text is empty', async () => {
      // Arrange
      const emptyTextResult = { ...mockTextExtractionResult, text: '' };
      aiModelService.extractTextFromImage.mockResolvedValue(emptyTextResult);

      // Act
      const result = await service.processDocument(taskId, imagePath);

      // Assert
      expect(aiModelService.generateSummary).not.toHaveBeenCalled();
      expect(result.summary).toBe('');
    });

    it('should use custom summary options', async () => {
      // Arrange
      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.generateSummary.mockResolvedValue(mockSummarizationResult);
      const options: ProcessingOptions = {
        maxSummaryLength: 100,
        summaryType: 'abstractive',
      };

      // Act
      await service.processDocument(taskId, imagePath, options);

      // Assert
      expect(aiModelService.generateSummary).toHaveBeenCalledWith(
        mockTextExtractionResult.text,
        {
          maxLength: 100,
          summaryType: 'abstractive',
        },
      );
    });

    it('should handle unsupported file types', async () => {
      // Arrange
      const unsupportedPath = '/tmp/test.txt';

      // Act & Assert
      await expect(
        service.processDocument(taskId, unsupportedPath),
      ).rejects.toThrow('Unsupported file type: .txt');

      expect(taskService.updateTaskError).toHaveBeenCalledWith(
        taskId,
        'Processing failed: Unsupported file type: .txt',
      );
    });

    it('should handle AI model extraction errors', async () => {
      // Arrange
      const error = new Error('OCR processing failed');
      aiModelService.extractTextFromImage.mockRejectedValue(error);

      // Act & Assert
      await expect(service.processDocument(taskId, imagePath)).rejects.toThrow(
        error,
      );

      expect(taskService.updateTaskError).toHaveBeenCalledWith(
        taskId,
        'Processing failed: OCR processing failed',
      );

      // Verify file cleanup after processing error
      expect(fileCleanupService.cleanupFile).toHaveBeenCalledWith(imagePath);
    });

    it('should handle summary generation errors gracefully', async () => {
      // Arrange
      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.generateSummary.mockRejectedValue(
        new Error('Summary failed'),
      );

      // Act & Assert
      await expect(service.processDocument(taskId, imagePath)).rejects.toThrow(
        'Summary failed',
      );

      expect(taskService.updateTaskError).toHaveBeenCalledWith(
        taskId,
        'Processing failed: Summary failed',
      );
    });
  });

  describe('processDocuments', () => {
    it('should process multiple documents concurrently', async () => {
      // Arrange
      const requests = [
        { taskId: 'task1', filePath: '/tmp/image1.png' },
        { taskId: 'task2', filePath: '/tmp/image2.jpg' },
        { taskId: 'task3', filePath: '/tmp/document.pdf' },
      ];

      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.extractTextFromPdf.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.generateSummary.mockResolvedValue(mockSummarizationResult);

      // Act
      const results = await service.processDocuments(requests);

      // Assert
      expect(results).toHaveLength(3);
      expect(aiModelService.extractTextFromImage).toHaveBeenCalledTimes(2);
      expect(aiModelService.extractTextFromPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in concurrent processing', async () => {
      // Arrange
      const requests = [
        { taskId: 'task1', filePath: '/tmp/image1.png' },
        { taskId: 'task2', filePath: '/tmp/invalid.txt' },
      ];

      aiModelService.extractTextFromImage.mockResolvedValue(
        mockTextExtractionResult,
      );
      aiModelService.generateSummary.mockResolvedValue(mockSummarizationResult);

      // Act & Assert
      await expect(service.processDocuments(requests)).rejects.toThrow();
    });
  });

  describe('getProcessingProgress', () => {
    it('should return task progress', () => {
      // Arrange
      const taskId = 'test-task';
      const mockTask = {
        id: taskId,
        status: TaskStatus.PROCESSING,
        progress: 50,
        fileName: 'test.png',
        fileType: 'image/png',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      taskService.getTask.mockReturnValue(mockTask);

      // Act
      const progress = service.getProcessingProgress(taskId);

      // Assert
      expect(progress).toEqual({
        status: TaskStatus.PROCESSING,
        progress: 50,
      });
    });

    it('should handle task not found errors', () => {
      // Arrange
      const taskId = 'non-existent-task';
      taskService.getTask.mockImplementation(() => {
        throw new Error('Task not found');
      });

      // Act & Assert
      expect(() => service.getProcessingProgress(taskId)).toThrow(
        'Task not found',
      );
    });
  });

  describe('file type validation', () => {
    it('should identify supported image file types', () => {
      expect(service.isSupportedFileType('/path/to/image.png')).toBe(true);
      expect(service.isSupportedFileType('/path/to/image.jpg')).toBe(true);
      expect(service.isSupportedFileType('/path/to/image.jpeg')).toBe(true);
    });

    it('should identify supported PDF file type', () => {
      expect(service.isSupportedFileType('/path/to/document.pdf')).toBe(true);
    });

    it('should reject unsupported file types', () => {
      expect(service.isSupportedFileType('/path/to/document.txt')).toBe(false);
      expect(service.isSupportedFileType('/path/to/document.docx')).toBe(false);
      expect(service.isSupportedFileType('/path/to/image.gif')).toBe(false);
    });

    it('should return supported extensions', () => {
      const extensions = service.getSupportedExtensions();
      expect(extensions).toEqual(['.png', '.jpg', '.jpeg', '.pdf']);
    });
  });
});
