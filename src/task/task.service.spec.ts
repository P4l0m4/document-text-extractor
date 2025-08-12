import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import {
  TaskStatus,
  ProcessingResult,
} from '../common/interfaces/task.interface';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskService],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    service.clearAllTasks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    it('should create a new task with pending status', () => {
      const taskId = 'test-task-1';
      const fileName = 'test.pdf';
      const fileType = 'application/pdf';

      const task = service.createTask(taskId, fileName, fileType);

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
      expect(task.fileName).toBe(fileName);
      expect(task.fileType).toBe(fileType);
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.progress).toBeUndefined();
      expect(task.result).toBeUndefined();
      expect(task.error).toBeUndefined();
    });

    it('should store the task in memory', () => {
      const taskId = 'test-task-2';
      const fileName = 'test.png';
      const fileType = 'image/png';

      service.createTask(taskId, fileName, fileType);

      expect(service.taskExists(taskId)).toBe(true);
      expect(service.getTaskCount()).toBe(1);
    });
  });

  describe('getTask', () => {
    it('should return existing task', () => {
      const taskId = 'test-task-3';
      const fileName = 'test.jpg';
      const fileType = 'image/jpeg';

      const createdTask = service.createTask(taskId, fileName, fileType);
      const retrievedTask = service.getTask(taskId);

      expect(retrievedTask).toEqual(createdTask);
    });

    it('should throw NotFoundException for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      expect(() => service.getTask(nonExistentId)).toThrow(NotFoundException);
      expect(() => service.getTask(nonExistentId)).toThrow(
        `Task with ID ${nonExistentId} not found`,
      );
    });
  });

  describe('getAllTasks', () => {
    it('should return empty array when no tasks exist', () => {
      const tasks = service.getAllTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all created tasks', () => {
      const task1 = service.createTask(
        'task-1',
        'file1.pdf',
        'application/pdf',
      );
      const task2 = service.createTask('task-2', 'file2.png', 'image/png');

      const allTasks = service.getAllTasks();

      expect(allTasks).toHaveLength(2);
      expect(allTasks).toContain(task1);
      expect(allTasks).toContain(task2);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status and updatedAt timestamp', () => {
      const taskId = 'test-task-4';
      const task = service.createTask(taskId, 'test.pdf', 'application/pdf');
      const originalUpdatedAt = task.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        const updatedTask = service.updateTaskStatus(
          taskId,
          TaskStatus.PROCESSING,
        );

        expect(updatedTask.status).toBe(TaskStatus.PROCESSING);
        expect(updatedTask.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime(),
        );
      }, 1);
    });

    it('should update task status with progress', () => {
      const taskId = 'test-task-5';
      service.createTask(taskId, 'test.pdf', 'application/pdf');

      const updatedTask = service.updateTaskStatus(
        taskId,
        TaskStatus.PROCESSING,
        50,
      );

      expect(updatedTask.status).toBe(TaskStatus.PROCESSING);
      expect(updatedTask.progress).toBe(50);
    });

    it('should throw NotFoundException for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      expect(() =>
        service.updateTaskStatus(nonExistentId, TaskStatus.PROCESSING),
      ).toThrow(NotFoundException);
    });
  });

  describe('updateTaskResult', () => {
    it('should update task with processing result and set status to completed', () => {
      const taskId = 'test-task-6';
      service.createTask(taskId, 'test.pdf', 'application/pdf');

      const result: ProcessingResult = {
        extractedText: 'Sample extracted text',
        summary: 'Sample summary',
        metadata: {
          fileSize: 1024,
          processingTime: 5000,
          pageCount: 2,
          confidence: 0.95,
        },
      };

      const updatedTask = service.updateTaskResult(taskId, result);

      expect(updatedTask.status).toBe(TaskStatus.COMPLETED);
      expect(updatedTask.result).toEqual(result);
      expect(updatedTask.progress).toBe(100);
      expect(updatedTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for non-existent task', () => {
      const nonExistentId = 'non-existent-task';
      const result: ProcessingResult = {
        extractedText: 'text',
        summary: 'summary',
        metadata: { fileSize: 1024, processingTime: 1000 },
      };

      expect(() => service.updateTaskResult(nonExistentId, result)).toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTaskError', () => {
    it('should update task with error and set status to failed', () => {
      const taskId = 'test-task-7';
      service.createTask(taskId, 'test.pdf', 'application/pdf');

      const errorMessage = 'Processing failed due to corrupted file';
      const updatedTask = service.updateTaskError(taskId, errorMessage);

      expect(updatedTask.status).toBe(TaskStatus.FAILED);
      expect(updatedTask.error).toBe(errorMessage);
      expect(updatedTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for non-existent task', () => {
      const nonExistentId = 'non-existent-task';
      const errorMessage = 'Some error';

      expect(() =>
        service.updateTaskError(nonExistentId, errorMessage),
      ).toThrow(NotFoundException);
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task and return true', () => {
      const taskId = 'test-task-8';
      service.createTask(taskId, 'test.pdf', 'application/pdf');

      expect(service.taskExists(taskId)).toBe(true);

      const deleted = service.deleteTask(taskId);

      expect(deleted).toBe(true);
      expect(service.taskExists(taskId)).toBe(false);
      expect(service.getTaskCount()).toBe(0);
    });

    it('should return false for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      const deleted = service.deleteTask(nonExistentId);

      expect(deleted).toBe(false);
    });
  });

  describe('taskExists', () => {
    it('should return true for existing task', () => {
      const taskId = 'test-task-9';
      service.createTask(taskId, 'test.pdf', 'application/pdf');

      expect(service.taskExists(taskId)).toBe(true);
    });

    it('should return false for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      expect(service.taskExists(nonExistentId)).toBe(false);
    });
  });

  describe('getTaskCount', () => {
    it('should return 0 when no tasks exist', () => {
      expect(service.getTaskCount()).toBe(0);
    });

    it('should return correct count of tasks', () => {
      service.createTask('task-1', 'file1.pdf', 'application/pdf');
      service.createTask('task-2', 'file2.png', 'image/png');
      service.createTask('task-3', 'file3.jpg', 'image/jpeg');

      expect(service.getTaskCount()).toBe(3);
    });
  });

  describe('clearAllTasks', () => {
    it('should remove all tasks', () => {
      service.createTask('task-1', 'file1.pdf', 'application/pdf');
      service.createTask('task-2', 'file2.png', 'image/png');

      expect(service.getTaskCount()).toBe(2);

      service.clearAllTasks();

      expect(service.getTaskCount()).toBe(0);
      expect(service.getAllTasks()).toEqual([]);
    });
  });
});
