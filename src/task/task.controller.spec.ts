import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import {
  TaskStatus,
  ProcessingResult,
} from '../common/interfaces/task.interface';

describe('TaskController', () => {
  let controller: TaskController;
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [TaskService],
    }).compile();

    controller = module.get<TaskController>(TaskController);
    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    service.clearAllTasks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTaskStatus', () => {
    it('should return task status for existing task', () => {
      const taskId = 'test-task-1';
      const fileName = 'test.pdf';
      const fileType = 'application/pdf';

      const task = service.createTask(taskId, fileName, fileType);
      service.updateTaskStatus(taskId, TaskStatus.PROCESSING, 50);

      const result = controller.getTaskStatus(taskId);

      expect(result).toEqual({
        id: task.id,
        status: TaskStatus.PROCESSING,
        progress: 50,
        createdAt: task.createdAt,
        updatedAt: expect.any(Date),
        fileName: task.fileName,
        fileType: task.fileType,
      });
    });

    it('should return task status without progress when not set', () => {
      const taskId = 'test-task-2';
      const fileName = 'test.png';
      const fileType = 'image/png';

      const task = service.createTask(taskId, fileName, fileType);

      const result = controller.getTaskStatus(taskId);

      expect(result).toEqual({
        id: task.id,
        status: TaskStatus.PENDING,
        progress: undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        fileName: task.fileName,
        fileType: task.fileType,
      });
    });

    it('should throw HttpException with 404 status for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      expect(() => controller.getTaskStatus(nonExistentId)).toThrow(
        HttpException,
      );

      try {
        controller.getTaskStatus(nonExistentId);
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: `Task with ID ${nonExistentId} not found`,
          error: 'Not Found',
          timestamp: expect.any(String),
          path: `/api/tasks/${nonExistentId}/status`,
          taskId: nonExistentId,
        });
      }
    });
  });

  describe('getTaskResult', () => {
    it('should return task result for completed task', () => {
      const taskId = 'test-task-3';
      const fileName = 'test.pdf';
      const fileType = 'application/pdf';

      const task = service.createTask(taskId, fileName, fileType);

      const processingResult: ProcessingResult = {
        extractedText: 'Sample extracted text from PDF',
        summary: 'This is a summary of the extracted content',
        metadata: {
          fileSize: 2048,
          processingTime: 3000,
          pageCount: 3,
          confidence: 0.92,
        },
      };

      service.updateTaskResult(taskId, processingResult);

      const result = controller.getTaskResult(taskId);

      expect(result).toEqual({
        id: task.id,
        status: TaskStatus.COMPLETED,
        result: processingResult,
        error: undefined,
        fileName: task.fileName,
        fileType: task.fileType,
        createdAt: task.createdAt,
        updatedAt: expect.any(Date),
      });
    });

    it('should return task result for failed task with error', () => {
      const taskId = 'test-task-4';
      const fileName = 'corrupted.pdf';
      const fileType = 'application/pdf';

      const task = service.createTask(taskId, fileName, fileType);
      const errorMessage = 'File is corrupted and cannot be processed';

      service.updateTaskError(taskId, errorMessage);

      const result = controller.getTaskResult(taskId);

      expect(result).toEqual({
        id: task.id,
        status: TaskStatus.FAILED,
        result: undefined,
        error: errorMessage,
        fileName: task.fileName,
        fileType: task.fileType,
        createdAt: task.createdAt,
        updatedAt: expect.any(Date),
      });
    });

    it('should return task result for pending task without result or error', () => {
      const taskId = 'test-task-5';
      const fileName = 'pending.jpg';
      const fileType = 'image/jpeg';

      const task = service.createTask(taskId, fileName, fileType);

      const result = controller.getTaskResult(taskId);

      expect(result).toEqual({
        id: task.id,
        status: TaskStatus.PENDING,
        result: undefined,
        error: undefined,
        fileName: task.fileName,
        fileType: task.fileType,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    });

    it('should throw HttpException with 404 status for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      expect(() => controller.getTaskResult(nonExistentId)).toThrow(
        HttpException,
      );

      try {
        controller.getTaskResult(nonExistentId);
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: `Task with ID ${nonExistentId} not found`,
          error: 'Not Found',
          timestamp: expect.any(String),
          path: `/api/tasks/${nonExistentId}/result`,
          taskId: nonExistentId,
        });
      }
    });
  });

  describe('error handling', () => {
    it('should re-throw non-404 errors from service', () => {
      const taskId = 'test-task-6';

      // Mock service to throw a different error
      jest.spyOn(service, 'getTask').mockImplementation(() => {
        throw new Error('Database connection error');
      });

      expect(() => controller.getTaskStatus(taskId)).toThrow(
        'Database connection error',
      );
      expect(() => controller.getTaskResult(taskId)).toThrow(
        'Database connection error',
      );
    });
  });
});
