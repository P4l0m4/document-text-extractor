import { HttpStatus } from '@nestjs/common';
import {
  SecurityException,
  MaliciousFileException,
  UnauthorizedAccessException,
  RateLimitExceededException,
} from './security.exception';

describe('Security Exceptions', () => {
  describe('SecurityException', () => {
    it('should create a security exception with default status code', () => {
      const message = 'Security violation detected';
      const taskId = 'task-123';
      const exception = new SecurityException(message, undefined, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(response.message).toBe(message);
      expect(response.error).toBe('Security Error');
      expect(response.taskId).toBe(taskId);
      expect(response.timestamp).toBeDefined();
    });

    it('should create a security exception with custom status code', () => {
      const message = 'Authentication required';
      const statusCode = HttpStatus.UNAUTHORIZED;
      const exception = new SecurityException(message, statusCode);

      expect(exception.getStatus()).toBe(statusCode);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(statusCode);
      expect(response.message).toBe(message);
    });

    it('should create a security exception without taskId', () => {
      const message = 'Access denied';
      const exception = new SecurityException(message);

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toBe(message);
    });
  });

  describe('MaliciousFileException', () => {
    it('should create a malicious file exception', () => {
      const fileName = 'suspicious.exe';
      const reason = 'Contains executable code';
      const taskId = 'task-456';
      const exception = new MaliciousFileException(fileName, reason, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `File '${fileName}' rejected due to security concerns: ${reason}`,
      );
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it('should create a malicious file exception without taskId', () => {
      const fileName = 'virus.pdf';
      const reason = 'Malware detected';
      const exception = new MaliciousFileException(fileName, reason);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(fileName);
      expect(response.message).toContain(reason);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('UnauthorizedAccessException', () => {
    it('should create an unauthorized access exception', () => {
      const resource = '/admin/tasks';
      const taskId = 'task-789';
      const exception = new UnauthorizedAccessException(resource, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Unauthorized access attempt to resource: ${resource}`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create an unauthorized access exception without taskId', () => {
      const resource = '/api/internal';
      const exception = new UnauthorizedAccessException(resource);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(resource);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('RateLimitExceededException', () => {
    it('should create a rate limit exceeded exception', () => {
      const limit = 100;
      const window = '1 hour';
      const taskId = 'task-101';
      const exception = new RateLimitExceededException(limit, window, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Rate limit exceeded: ${limit} requests per ${window}`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create a rate limit exceeded exception without taskId', () => {
      const limit = 50;
      const window = '15 minutes';
      const exception = new RateLimitExceededException(limit, window);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(`${limit} requests per ${window}`);
      expect(response.taskId).toBeUndefined();
    });
  });
});
