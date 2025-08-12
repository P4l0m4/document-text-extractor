import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { QueueService, DocumentProcessingJobData } from './queue.service';
import { Job, Queue } from 'bull';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: jest.Mocked<Queue<DocumentProcessingJobData>>;

  const mockJob: Partial<Job<DocumentProcessingJobData>> = {
    id: 'job-123',
    data: {
      taskId: 'task-123',
      filePath: '/tmp/test.pdf',
      fileName: 'test.pdf',
      fileType: 'application/pdf',
    },
    opts: {},
    progress: jest.fn(),
  };

  beforeEach(async () => {
    const mockQueueMethods = {
      add: jest.fn(),
      getJob: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('document-processing'),
          useValue: mockQueueMethods,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    mockQueue = module.get(getQueueToken('document-processing'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addDocumentProcessingJob', () => {
    it('should add a job to the queue', async () => {
      const jobData: DocumentProcessingJobData = {
        taskId: 'task-123',
        filePath: '/tmp/test.pdf',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
      };

      mockQueue.add.mockResolvedValue(
        mockJob as Job<DocumentProcessingJobData>,
      );

      const result = await service.addDocumentProcessingJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('process-document', jobData, {
        priority: 1,
        delay: 0,
      });
      expect(result).toBe(mockJob);
    });
  });

  describe('getJob', () => {
    it('should return a job by ID', async () => {
      const jobId = 'job-123';
      mockQueue.getJob.mockResolvedValue(
        mockJob as Job<DocumentProcessingJobData>,
      );

      const result = await service.getJob(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBe(mockJob);
    });

    it('should return null if job not found', async () => {
      const jobId = 'non-existent';
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJob(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockWaiting = [mockJob, mockJob];
      const mockActive = [mockJob];
      const mockCompleted = [mockJob, mockJob, mockJob];
      const mockFailed = [mockJob];

      mockQueue.getWaiting.mockResolvedValue(
        mockWaiting as Job<DocumentProcessingJobData>[],
      );
      mockQueue.getActive.mockResolvedValue(
        mockActive as Job<DocumentProcessingJobData>[],
      );
      mockQueue.getCompleted.mockResolvedValue(
        mockCompleted as Job<DocumentProcessingJobData>[],
      );
      mockQueue.getFailed.mockResolvedValue(
        mockFailed as Job<DocumentProcessingJobData>[],
      );

      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 1,
        total: 7,
      });
    });
  });

  describe('getActiveJobsCount', () => {
    it('should return the count of active jobs', async () => {
      const mockActive = [mockJob, mockJob, mockJob];
      mockQueue.getActive.mockResolvedValue(
        mockActive as Job<DocumentProcessingJobData>[],
      );

      const result = await service.getActiveJobsCount();

      expect(result).toBe(3);
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      mockQueue.pause.mockResolvedValue();

      await service.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      mockQueue.resume.mockResolvedValue();

      await service.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('cleanCompletedJobs', () => {
    it('should clean completed jobs with default grace period', async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanCompletedJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(0, 'completed');
    });

    it('should clean completed jobs with custom grace period', async () => {
      const grace = 5000;
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanCompletedJobs(grace);

      expect(mockQueue.clean).toHaveBeenCalledWith(grace, 'completed');
    });
  });

  describe('cleanFailedJobs', () => {
    it('should clean failed jobs with default grace period', async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanFailedJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(0, 'failed');
    });

    it('should clean failed jobs with custom grace period', async () => {
      const grace = 3000;
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanFailedJobs(grace);

      expect(mockQueue.clean).toHaveBeenCalledWith(grace, 'failed');
    });
  });

  describe('error handling scenarios', () => {
    it('should handle queue connection errors when adding jobs', async () => {
      const jobData: DocumentProcessingJobData = {
        taskId: 'task-123',
        filePath: '/tmp/test.pdf',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
      };

      const connectionError = new Error('Redis connection failed');
      mockQueue.add.mockRejectedValue(connectionError);

      await expect(service.addDocumentProcessingJob(jobData)).rejects.toThrow(
        'Redis connection failed',
      );
    });

    it('should handle queue errors when getting job statistics', async () => {
      const queueError = new Error('Queue unavailable');
      mockQueue.getWaiting.mockRejectedValue(queueError);

      await expect(service.getQueueStats()).rejects.toThrow(
        'Queue unavailable',
      );
    });

    it('should handle errors when pausing queue', async () => {
      const pauseError = new Error('Failed to pause queue');
      mockQueue.pause.mockRejectedValue(pauseError);

      await expect(service.pauseQueue()).rejects.toThrow(
        'Failed to pause queue',
      );
    });

    it('should handle errors when resuming queue', async () => {
      const resumeError = new Error('Failed to resume queue');
      mockQueue.resume.mockRejectedValue(resumeError);

      await expect(service.resumeQueue()).rejects.toThrow(
        'Failed to resume queue',
      );
    });

    it('should handle errors when cleaning jobs', async () => {
      const cleanError = new Error('Failed to clean jobs');
      mockQueue.clean.mockRejectedValue(cleanError);

      await expect(service.cleanCompletedJobs()).rejects.toThrow(
        'Failed to clean jobs',
      );
    });

    it('should handle null/undefined job data gracefully', async () => {
      const invalidJobData = null as any;

      await expect(
        service.addDocumentProcessingJob(invalidJobData),
      ).rejects.toThrow();
    });

    it('should handle malformed job data', async () => {
      const malformedJobData = {
        taskId: '',
        filePath: '',
        fileName: '',
        fileType: '',
      };

      mockQueue.add.mockResolvedValue(
        mockJob as Job<DocumentProcessingJobData>,
      );

      // Should still attempt to add the job, validation happens elsewhere
      const result = await service.addDocumentProcessingJob(malformedJobData);
      expect(result).toBe(mockJob);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-document',
        malformedJobData,
        {
          priority: 1,
          delay: 0,
        },
      );
    });
  });
});
