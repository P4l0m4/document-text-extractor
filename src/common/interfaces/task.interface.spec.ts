import { Task, TaskStatus, ProcessingResult } from './task.interface';

describe('Task Interface', () => {
  describe('TaskStatus Enum', () => {
    it('should have correct enum values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.PROCESSING).toBe('processing');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
    });

    it('should contain all expected status values', () => {
      const statusValues = Object.values(TaskStatus);
      expect(statusValues).toHaveLength(4);
      expect(statusValues).toContain('pending');
      expect(statusValues).toContain('processing');
      expect(statusValues).toContain('completed');
      expect(statusValues).toContain('failed');
    });
  });

  describe('Task Interface', () => {
    it('should create a valid task object', () => {
      const task: Task = {
        id: 'test-task-123',
        status: TaskStatus.PENDING,
        fileName: 'test-document.pdf',
        fileType: 'application/pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(task.id).toBe('test-task-123');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.fileName).toBe('test-document.pdf');
      expect(task.fileType).toBe('application/pdf');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should support optional properties', () => {
      const task: Task = {
        id: 'test-task-456',
        status: TaskStatus.COMPLETED,
        fileName: 'image.png',
        fileType: 'image/png',
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 100,
        result: {
          extractedText: 'Sample extracted text',
          summary: 'Sample summary',
          metadata: {
            fileSize: 1024,
            processingTime: 5000,
            confidence: 0.95,
          },
        },
      };

      expect(task.progress).toBe(100);
      expect(task.result).toBeDefined();
      expect(task.result?.extractedText).toBe('Sample extracted text');
    });

    it('should support error property for failed tasks', () => {
      const task: Task = {
        id: 'test-task-789',
        status: TaskStatus.FAILED,
        fileName: 'corrupted.pdf',
        fileType: 'application/pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
        error: 'File is corrupted and cannot be processed',
      };

      expect(task.status).toBe(TaskStatus.FAILED);
      expect(task.error).toBe('File is corrupted and cannot be processed');
    });
  });

  describe('ProcessingResult Interface', () => {
    it('should create a valid processing result', () => {
      const result: ProcessingResult = {
        extractedText: 'This is the extracted text from the document.',
        summary: 'Document contains information about...',
        metadata: {
          fileSize: 2048,
          processingTime: 3000,
        },
      };

      expect(result.extractedText).toBe(
        'This is the extracted text from the document.',
      );
      expect(result.summary).toBe('Document contains information about...');
      expect(result.metadata.fileSize).toBe(2048);
      expect(result.metadata.processingTime).toBe(3000);
    });

    it('should support optional metadata properties', () => {
      const result: ProcessingResult = {
        extractedText: 'Text from PDF',
        summary: 'PDF summary',
        metadata: {
          pageCount: 5,
          fileSize: 4096,
          processingTime: 7500,
          confidence: 0.88,
        },
      };

      expect(result.metadata.pageCount).toBe(5);
      expect(result.metadata.confidence).toBe(0.88);
    });
  });
});
