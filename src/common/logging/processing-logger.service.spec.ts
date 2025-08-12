import { Test, TestingModule } from '@nestjs/testing';
import { ProcessingLoggerService } from './processing-logger.service';

describe('ProcessingLoggerService', () => {
  let service: ProcessingLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessingLoggerService],
    }).compile();

    service = module.get<ProcessingLoggerService>(ProcessingLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logProcessingStart', () => {
    it('should log processing start', () => {
      const taskId = 'task-123';
      const fileName = 'test.pdf';
      const fileSize = 1024;

      service.logProcessingStart(taskId, fileName, fileSize);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'document_processing',
        status: 'started',
        fileName,
        fileSize,
      });
      expect(logs[0].timestamp).toBeDefined();
    });
  });

  describe('logProcessingComplete', () => {
    it('should log processing completion', () => {
      const taskId = 'task-123';
      const duration = 2000;

      service.logProcessingComplete(taskId, duration);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'document_processing',
        status: 'completed',
        duration,
      });
    });
  });

  describe('logProcessingError', () => {
    it('should log processing error', () => {
      const taskId = 'task-123';
      const error = 'Processing failed';
      const duration = 1500;

      service.logProcessingError(taskId, error, duration);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'document_processing',
        status: 'failed',
        error,
        duration,
      });
    });

    it('should log processing error without duration', () => {
      const taskId = 'task-123';
      const error = 'Processing failed';

      service.logProcessingError(taskId, error);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'document_processing',
        status: 'failed',
        error,
      });
      expect(logs[0].duration).toBeUndefined();
    });
  });

  describe('logUpload', () => {
    it('should log file upload', () => {
      const taskId = 'task-123';
      const fileName = 'test.pdf';
      const fileSize = 1024;

      service.logUpload(taskId, fileName, fileSize);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'file_upload',
        status: 'completed',
        fileName,
        fileSize,
      });
    });
  });

  describe('logCleanup', () => {
    it('should log file cleanup with filename', () => {
      const taskId = 'task-123';
      const fileName = 'test.pdf';

      service.logCleanup(taskId, fileName);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'file_cleanup',
        status: 'completed',
        fileName,
      });
    });

    it('should log file cleanup without filename', () => {
      const taskId = 'task-123';

      service.logCleanup(taskId);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId,
        operation: 'file_cleanup',
        status: 'completed',
      });
      expect(logs[0].fileName).toBeUndefined();
    });
  });

  describe('getRecentLogs', () => {
    it('should return recent logs with default limit', () => {
      // Add multiple logs
      for (let i = 0; i < 150; i++) {
        service.logUpload(`task-${i}`, `file-${i}.pdf`, 1024);
      }

      const recentLogs = service.getRecentLogs();
      expect(recentLogs).toHaveLength(100); // Default limit
    });

    it('should return recent logs with custom limit', () => {
      // Add multiple logs
      for (let i = 0; i < 50; i++) {
        service.logUpload(`task-${i}`, `file-${i}.pdf`, 1024);
      }

      const recentLogs = service.getRecentLogs(20);
      expect(recentLogs).toHaveLength(20);
    });
  });

  describe('getLogsByTaskId', () => {
    it('should return logs for specific task', () => {
      const taskId = 'task-123';

      service.logProcessingStart(taskId, 'test.pdf', 1024);
      service.logProcessingComplete(taskId, 2000);
      service.logCleanup(taskId, 'test.pdf');

      // Add logs for different task
      service.logProcessingStart('task-456', 'other.pdf', 2048);

      const logs = service.getLogsByTaskId(taskId);
      expect(logs).toHaveLength(3);
      expect(logs.every((log) => log.taskId === taskId)).toBe(true);
    });

    it('should return empty array for non-existent task', () => {
      const logs = service.getLogsByTaskId('non-existent');
      expect(logs).toHaveLength(0);
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', () => {
      // Add various processing logs
      service.logProcessingStart('task-1', 'file1.pdf', 1024);
      service.logProcessingComplete('task-1', 2000);

      service.logProcessingStart('task-2', 'file2.pdf', 2048);
      service.logProcessingComplete('task-2', 3000);

      service.logProcessingStart('task-3', 'file3.pdf', 1536);
      service.logProcessingError('task-3', 'Processing failed', 1000);

      const stats = service.getProcessingStats();

      expect(stats.totalProcessed).toBe(3); // 3 processing operations started
      expect(stats.successfulProcessing).toBe(2); // 2 completed
      expect(stats.failedProcessing).toBe(1); // 1 failed
      expect(stats.averageProcessingTime).toBe(2500); // (2000 + 3000) / 2
      expect(stats.recentActivity).toHaveLength(6); // All 6 log entries (3 starts + 2 completes + 1 error)
    });

    it('should handle empty processing logs', () => {
      const stats = service.getProcessingStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.successfulProcessing).toBe(0);
      expect(stats.failedProcessing).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.recentActivity).toHaveLength(0);
    });
  });

  describe('log entry management', () => {
    it('should maintain maximum log entries', () => {
      const maxEntries = 1000;

      // Add more than max entries
      for (let i = 0; i < maxEntries + 100; i++) {
        service.logUpload(`task-${i}`, `file-${i}.pdf`, 1024);
      }

      const allLogs = service.getRecentLogs(maxEntries + 200);
      expect(allLogs).toHaveLength(maxEntries);

      // Should keep the most recent entries
      expect(allLogs[allLogs.length - 1].taskId).toBe(
        `task-${maxEntries + 99}`,
      );
    });
  });
});
