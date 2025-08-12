import { HttpStatus } from '@nestjs/common';
import {
  SystemException,
  ResourceExhaustedException,
  FileSystemException,
  QueueException,
  TaskNotFoundException,
  ServiceUnavailableException,
} from './system.exception';

describe('System Exceptions', () => {
  describe('SystemException', () => {
    it('should create a system exception with default status code', () => {
      const message = 'System error occurred';
      const taskId = 'task-123';
      const exception = new SystemException(message, undefined, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).toBe(message);
      expect(response.error).toBe('System Error');
      expect(response.taskId).toBe(taskId);
      expect(response.timestamp).toBeDefined();
    });

    it('should create a system exception with custom status code', () => {
      const message = 'Service unavailable';
      const statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      const exception = new SystemException(message, statusCode);

      expect(exception.getStatus()).toBe(statusCode);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(statusCode);
      expect(response.message).toBe(message);
    });

    it('should create a system exception without taskId', () => {
      const message = 'System error';
      const exception = new SystemException(message);

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toBe(message);
    });
  });

  describe('ResourceExhaustedException', () => {
    it('should create a resource exhausted exception', () => {
      const resource = 'memory';
      const taskId = 'task-456';
      const exception = new ResourceExhaustedException(resource, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`System resource exhausted: ${resource}`);
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('should create a resource exhausted exception without taskId', () => {
      const resource = 'disk space';
      const exception = new ResourceExhaustedException(resource);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`System resource exhausted: ${resource}`);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('FileSystemException', () => {
    it('should create a file system exception with operation and path', () => {
      const operation = 'read';
      const path = '/tmp/document.pdf';
      const taskId = 'task-789';
      const exception = new FileSystemException(operation, path, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `File system error during ${operation} on path: ${path}`,
      );
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should create a file system exception without taskId', () => {
      const operation = 'write';
      const path = '/tmp/output.txt';
      const exception = new FileSystemException(operation, path);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(operation);
      expect(response.message).toContain(path);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('QueueException', () => {
    it('should create a queue exception', () => {
      const message = 'Queue connection lost';
      const taskId = 'task-101';
      const exception = new QueueException(message, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Queue system error: ${message}`);
      expect(response.taskId).toBe(taskId);
    });

    it('should create a queue exception without taskId', () => {
      const message = 'Queue is full';
      const exception = new QueueException(message);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Queue system error: ${message}`);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('TaskNotFoundException', () => {
    it('should create a task not found exception', () => {
      const taskId = 'nonexistent-task';
      const exception = new TaskNotFoundException(taskId);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Task with ID '${taskId}' not found`);
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('should handle empty taskId', () => {
      const taskId = '';
      const exception = new TaskNotFoundException(taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Task with ID '' not found`);
      expect(response.taskId).toBe(taskId);
    });
  });

  describe('ServiceUnavailableException', () => {
    it('should create a service unavailable exception', () => {
      const service = 'AI Model Service';
      const taskId = 'task-202';
      const exception = new ServiceUnavailableException(service, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Service '${service}' is currently unavailable`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create a service unavailable exception without taskId', () => {
      const service = 'Queue Service';
      const exception = new ServiceUnavailableException(service);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Service '${service}' is currently unavailable`,
      );
      expect(response.taskId).toBeUndefined();
    });
  });
});
