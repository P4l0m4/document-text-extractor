import { HttpStatus } from '@nestjs/common';
import {
  ValidationException,
  FileValidationException,
  FileSizeException,
  FileTypeException,
} from './validation.exception';

describe('Validation Exceptions', () => {
  describe('ValidationException', () => {
    it('should create a validation exception with correct properties', () => {
      const message = 'Invalid input data';
      const taskId = 'task-123';
      const exception = new ValidationException(message, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(response.message).toBe(message);
      expect(response.error).toBe('Validation Error');
      expect(response.taskId).toBe(taskId);
      expect(response.timestamp).toBeDefined();
    });

    it('should create a validation exception without taskId', () => {
      const message = 'Invalid input data';
      const exception = new ValidationException(message);

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toBe(message);
    });
  });

  describe('FileValidationException', () => {
    it('should create a file validation exception with filename', () => {
      const message = 'Invalid file format';
      const fileName = 'document.txt';
      const taskId = 'task-456';
      const exception = new FileValidationException(message, fileName, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`File '${fileName}': ${message}`);
      expect(response.taskId).toBe(taskId);
    });

    it('should create a file validation exception without filename', () => {
      const message = 'Invalid file format';
      const exception = new FileValidationException(message);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(message);
    });
  });

  describe('FileSizeException', () => {
    it('should create a file size exception with correct message', () => {
      const fileName = 'large-file.pdf';
      const actualSize = 15728640; // 15MB
      const maxSize = 10485760; // 10MB
      const taskId = 'task-789';

      const exception = new FileSizeException(
        fileName,
        actualSize,
        maxSize,
        taskId,
      );

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `File '${fileName}': File size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes`,
      );
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should create a file size exception without taskId', () => {
      const fileName = 'large-file.pdf';
      const actualSize = 15728640;
      const maxSize = 10485760;

      const exception = new FileSizeException(fileName, actualSize, maxSize);

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toContain('exceeds maximum allowed size');
    });
  });

  describe('FileTypeException', () => {
    it('should create a file type exception with allowed types', () => {
      const fileName = 'document.txt';
      const actualType = 'text/plain';
      const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      const taskId = 'task-101';

      const exception = new FileTypeException(
        fileName,
        actualType,
        allowedTypes,
        taskId,
      );

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `File '${fileName}': File type '${actualType}' is not supported. Allowed types: ${allowedTypes.join(', ')}`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create a file type exception without taskId', () => {
      const fileName = 'document.txt';
      const actualType = 'text/plain';
      const allowedTypes = ['image/png', 'application/pdf'];

      const exception = new FileTypeException(
        fileName,
        actualType,
        allowedTypes,
      );

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toContain('is not supported');
      expect(response.message).toContain(allowedTypes.join(', '));
    });
  });
});
