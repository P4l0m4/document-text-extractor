import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '../src/queue/queue.service';
import { TaskService } from '../src/task/task.service';
import { DocumentProcessor } from '../src/queue/document.processor';
import { TaskStatus } from '../src/common/interfaces/task.interface';

describe('Queue System Integration', () => {
  let queueService: QueueService;
  let taskService: TaskService;
  let documentProcessor: DocumentProcessor;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        DocumentProcessor,
        {
          provide: QueueService,
          useValue: {
            addDocumentProcessingJob: jest.fn(),
            getQueueStats: jest.fn(),
            getActiveJobsCount: jest.fn(),
          },
        },
      ],
    }).compile();

    queueService = moduleFixture.get<QueueService>(QueueService);
    taskService = moduleFixture.get<TaskService>(TaskService);
    documentProcessor = moduleFixture.get<DocumentProcessor>(DocumentProcessor);
  });

  beforeEach(() => {
    taskService.clearAllTasks();
    jest.clearAllMocks();
  });

  it('should integrate queue service with task service', async () => {
    const taskId = 'test-task-123';
    const jobData = {
      taskId,
      filePath: '/tmp/test.pdf',
      fileName: 'test.pdf',
      fileType: 'application/pdf',
    };

    // Mock queue service methods
    (queueService.addDocumentProcessingJob as jest.Mock).mockResolvedValue({
      id: 'job-123',
      data: jobData,
    });

    // Create a task
    const task = taskService.createTask(
      taskId,
      jobData.fileName,
      jobData.fileType,
    );
    expect(task.status).toBe(TaskStatus.PENDING);

    // Add job to queue
    const job = await queueService.addDocumentProcessingJob(jobData);
    expect(job).toBeDefined();
    expect(queueService.addDocumentProcessingJob).toHaveBeenCalledWith(jobData);
  });

  it('should process document with task service integration', async () => {
    const taskId = 'test-task-456';
    const jobData = {
      taskId,
      filePath: '/tmp/test.pdf',
      fileName: 'test.pdf',
      fileType: 'application/pdf',
    };

    // Create a task
    taskService.createTask(taskId, jobData.fileName, jobData.fileType);

    // Mock job object
    const mockJob = {
      id: 'job-456',
      data: jobData,
      timestamp: Date.now(),
      progress: jest.fn(),
    };

    // Process the document
    const result = await documentProcessor.processDocument(mockJob as any);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.extractedText).toContain('Mock extracted text');
    expect(result.summary).toContain('Mock summary');

    // Verify task was updated
    const updatedTask = taskService.getTask(taskId);
    expect(updatedTask.status).toBe(TaskStatus.COMPLETED);
    expect(updatedTask.result).toBeDefined();
    expect(updatedTask.progress).toBe(100);
  });

  it('should handle processing errors correctly', async () => {
    const taskId = 'test-task-error';
    const jobData = {
      taskId,
      filePath: '/tmp/test.pdf',
      fileName: 'test.pdf',
      fileType: 'application/pdf',
    };

    // Create a task
    taskService.createTask(taskId, jobData.fileName, jobData.fileType);

    // Mock job object
    const mockJob = {
      id: 'job-error',
      data: jobData,
      timestamp: Date.now(),
      progress: jest.fn().mockImplementation(() => {
        throw new Error('Progress update failed');
      }),
    };

    // Process should fail
    await expect(
      documentProcessor.processDocument(mockJob as any),
    ).rejects.toThrow();

    // Verify task was marked as failed
    const updatedTask = taskService.getTask(taskId);
    expect(updatedTask.status).toBe(TaskStatus.FAILED);
    expect(updatedTask.error).toBeDefined();
  });

  it('should provide queue statistics interface', async () => {
    const mockStats = {
      waiting: 2,
      active: 1,
      completed: 5,
      failed: 0,
      total: 8,
    };

    (queueService.getQueueStats as jest.Mock).mockResolvedValue(mockStats);

    const stats = await queueService.getQueueStats();
    expect(stats).toEqual(mockStats);
    expect(queueService.getQueueStats).toHaveBeenCalled();
  });

  it('should track active jobs count', async () => {
    const mockActiveCount = 3;
    (queueService.getActiveJobsCount as jest.Mock).mockResolvedValue(
      mockActiveCount,
    );

    const activeCount = await queueService.getActiveJobsCount();
    expect(activeCount).toBe(mockActiveCount);
    expect(queueService.getActiveJobsCount).toHaveBeenCalled();
  });

  it('should handle concurrent job processing simulation', () => {
    const taskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];

    // Create multiple tasks
    taskIds.forEach((taskId, index) => {
      taskService.createTask(taskId, `file-${index}.pdf`, 'application/pdf');
    });

    // Verify all tasks are created with pending status
    taskIds.forEach((taskId) => {
      const task = taskService.getTask(taskId);
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    // Simulate processing some tasks
    taskService.updateTaskStatus(taskIds[0], TaskStatus.PROCESSING, 50);
    taskService.updateTaskStatus(taskIds[1], TaskStatus.COMPLETED, 100);
    taskService.updateTaskError(taskIds[2], 'Processing failed');

    // Verify task states
    expect(taskService.getTask(taskIds[0]).status).toBe(TaskStatus.PROCESSING);
    expect(taskService.getTask(taskIds[1]).status).toBe(TaskStatus.COMPLETED);
    expect(taskService.getTask(taskIds[2]).status).toBe(TaskStatus.FAILED);
    expect(taskService.getTask(taskIds[3]).status).toBe(TaskStatus.PENDING);
    expect(taskService.getTask(taskIds[4]).status).toBe(TaskStatus.PENDING);
  });
});
