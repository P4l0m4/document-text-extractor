import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { TaskService } from '../task/task.service';
import { QueueService } from '../queue/queue.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { FileUploadOptionsDto } from '../common/dto/file-upload.dto';
import { Task, TaskStatus } from '../common/interfaces/task.interface';

describe('UploadService', () => {
  let service: UploadService;
  let mockTaskService: jest.Mocked<TaskService>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockFileCleanupService: jest.Mocked<FileCleanupService>;

  beforeEach(async () => {
    const mockTaskServiceMethods = {
      createTask: jest.fn(),
    };

    const mockQueueServiceMethods = {
      addDocumentProcessingJob: jest.fn(),
    };

    const mockFileCleanupServiceMethods = {
      trackFile: jest.fn(),
      untrackFile: jest.fn(),
      cleanupFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: TaskService,
          useValue: mockTaskServiceMethods,
        },
        {
          provide: QueueService,
          useValue: mockQueueServiceMethods,
        },
        {
          provide: FileCleanupService,
          useValue: mockFileCleanupServiceMethods,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    mockTaskService = module.get(TaskService);
    mockQueueService = module.get(QueueService);
    mockFileCleanupService = module.get(FileCleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processUpload', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      destination: '/tmp',
      filename: 'test.png',
      path: '/tmp/test.png',
      buffer: Buffer.from('test'),
      stream: {} as any,
    };

    const mockTask: Task = {
      id: 'test-task-id',
      status: TaskStatus.PENDING,
      fileName: 'test.png',
      fileType: 'image/png',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockTaskService.createTask.mockReturnValue(mockTask);
      mockQueueService.addDocumentProcessingJob.mockResolvedValue({} as any);
    });

    it('should create a task and queue it for processing', async () => {
      const taskId = await service.processUpload(mockFile);

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      // Check if it's a valid UUID v4 format
      expect(taskId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // Verify file is tracked for cleanup
      expect(mockFileCleanupService.trackFile).toHaveBeenCalledWith(
        mockFile.path,
      );

      // Verify task creation
      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        taskId,
        mockFile.originalname,
        mockFile.mimetype,
      );

      // Verify job queuing
      expect(mockQueueService.addDocumentProcessingJob).toHaveBeenCalledWith({
        taskId,
        filePath: mockFile.path,
        fileName: mockFile.originalname,
        fileType: mockFile.mimetype,
      });
    });

    it('should generate unique task IDs for different uploads', async () => {
      const taskId1 = await service.processUpload(mockFile);
      const taskId2 = await service.processUpload(mockFile);

      expect(taskId1).not.toBe(taskId2);
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(2);
      expect(mockQueueService.addDocumentProcessingJob).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should handle upload with options', async () => {
      const options: FileUploadOptionsDto = {
        generateSummary: true,
        maxSummaryLength: 300,
      };

      const taskId = await service.processUpload(mockFile, options);

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(taskId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        taskId,
        mockFile.originalname,
        mockFile.mimetype,
      );
      expect(mockQueueService.addDocumentProcessingJob).toHaveBeenCalled();
    });

    it('should handle upload without options', async () => {
      const taskId = await service.processUpload(mockFile);

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(mockTaskService.createTask).toHaveBeenCalled();
      expect(mockQueueService.addDocumentProcessingJob).toHaveBeenCalled();
    });

    it('should handle different file types', async () => {
      const pdfFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      };

      const taskId = await service.processUpload(pdfFile);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        taskId,
        'document.pdf',
        'application/pdf',
      );

      expect(mockQueueService.addDocumentProcessingJob).toHaveBeenCalledWith({
        taskId,
        filePath: pdfFile.path,
        fileName: 'document.pdf',
        fileType: 'application/pdf',
      });
    });

    it('should propagate queue service errors', async () => {
      const error = new Error('Queue service error');
      mockQueueService.addDocumentProcessingJob.mockRejectedValue(error);

      await expect(service.processUpload(mockFile)).rejects.toThrow(
        'Queue service error',
      );
    });
  });
});
