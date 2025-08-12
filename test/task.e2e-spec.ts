import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { TaskModule } from '../src/task/task.module';
import { TaskService } from '../src/task/task.service';
import {
  TaskStatus,
  ProcessingResult,
} from '../src/common/interfaces/task.interface';

describe('TaskController (e2e)', () => {
  let app: INestApplication;
  let taskService: TaskService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TaskModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    taskService = moduleFixture.get<TaskService>(TaskService);

    await app.init();
  });

  afterEach(async () => {
    taskService.clearAllTasks();
    await app.close();
  });

  describe('/api/tasks/:taskId/status (GET)', () => {
    it('should return task status for existing task', () => {
      const taskId = 'test-task-1';
      const fileName = 'test.pdf';
      const fileType = 'application/pdf';

      const task = taskService.createTask(taskId, fileName, fileType);
      taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 75);

      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            id: taskId,
            status: TaskStatus.PROCESSING,
            progress: 75,
            createdAt: task.createdAt.toISOString(),
            updatedAt: expect.any(String),
            fileName: fileName,
            fileType: fileType,
          });
        });
    });

    it('should return 404 for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      return request(app.getHttpServer())
        .get(`/api/tasks/${nonExistentId}/status`)
        .expect(HttpStatus.NOT_FOUND)
        .expect((res) => {
          expect(res.body).toEqual({
            statusCode: HttpStatus.NOT_FOUND,
            message: `Task with ID ${nonExistentId} not found`,
            error: 'Not Found',
            timestamp: expect.any(String),
            path: `/api/tasks/${nonExistentId}/status`,
            taskId: nonExistentId,
          });
        });
    });

    it('should return pending status for newly created task', () => {
      const taskId = 'test-task-2';
      const fileName = 'new-task.png';
      const fileType = 'image/png';

      const task = taskService.createTask(taskId, fileName, fileType);

      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            id: taskId,
            status: TaskStatus.PENDING,
            progress: undefined,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            fileName: fileName,
            fileType: fileType,
          });
        });
    });
  });

  describe('/api/tasks/:taskId/result (GET)', () => {
    it('should return task result for completed task', () => {
      const taskId = 'test-task-3';
      const fileName = 'completed.pdf';
      const fileType = 'application/pdf';

      const task = taskService.createTask(taskId, fileName, fileType);

      const processingResult: ProcessingResult = {
        extractedText: 'This is the extracted text from the document',
        summary: 'Document contains important information about contracts',
        metadata: {
          fileSize: 1024,
          processingTime: 2500,
          pageCount: 2,
          confidence: 0.95,
        },
      };

      taskService.updateTaskResult(taskId, processingResult);

      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            id: taskId,
            status: TaskStatus.COMPLETED,
            result: processingResult,
            error: undefined,
            fileName: fileName,
            fileType: fileType,
            createdAt: task.createdAt.toISOString(),
            updatedAt: expect.any(String),
          });
        });
    });

    it('should return task result for failed task with error', () => {
      const taskId = 'test-task-4';
      const fileName = 'failed.pdf';
      const fileType = 'application/pdf';

      const task = taskService.createTask(taskId, fileName, fileType);
      const errorMessage = 'Processing failed due to unsupported format';

      taskService.updateTaskError(taskId, errorMessage);

      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            id: taskId,
            status: TaskStatus.FAILED,
            result: undefined,
            error: errorMessage,
            fileName: fileName,
            fileType: fileType,
            createdAt: task.createdAt.toISOString(),
            updatedAt: expect.any(String),
          });
        });
    });

    it('should return task result for processing task without result', () => {
      const taskId = 'test-task-5';
      const fileName = 'processing.jpg';
      const fileType = 'image/jpeg';

      const task = taskService.createTask(taskId, fileName, fileType);
      taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 50);

      return request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            id: taskId,
            status: TaskStatus.PROCESSING,
            result: undefined,
            error: undefined,
            fileName: fileName,
            fileType: fileType,
            createdAt: task.createdAt.toISOString(),
            updatedAt: expect.any(String),
          });
        });
    });

    it('should return 404 for non-existent task', () => {
      const nonExistentId = 'non-existent-task';

      return request(app.getHttpServer())
        .get(`/api/tasks/${nonExistentId}/result`)
        .expect(HttpStatus.NOT_FOUND)
        .expect((res) => {
          expect(res.body).toEqual({
            statusCode: HttpStatus.NOT_FOUND,
            message: `Task with ID ${nonExistentId} not found`,
            error: 'Not Found',
            timestamp: expect.any(String),
            path: `/api/tasks/${nonExistentId}/result`,
            taskId: nonExistentId,
          });
        });
    });
  });

  describe('Task lifecycle integration', () => {
    it('should track task through complete lifecycle', async () => {
      const taskId = 'lifecycle-task';
      const fileName = 'lifecycle.pdf';
      const fileType = 'application/pdf';

      // Create task
      const task = taskService.createTask(taskId, fileName, fileType);

      // Check initial status
      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe(TaskStatus.PENDING);
        });

      // Update to processing
      taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 25);

      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe(TaskStatus.PROCESSING);
          expect(res.body.progress).toBe(25);
        });

      // Complete with result
      const result: ProcessingResult = {
        extractedText: 'Final extracted text',
        summary: 'Final summary',
        metadata: {
          fileSize: 512,
          processingTime: 1000,
        },
      };

      taskService.updateTaskResult(taskId, result);

      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe(TaskStatus.COMPLETED);
          expect(res.body.result).toEqual(result);
          expect(res.body.error).toBeUndefined();
        });
    });
  });
});
