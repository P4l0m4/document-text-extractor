import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  ValidationException,
  ProcessingException,
  SystemException,
  TaskNotFoundException,
  SecurityException,
  MaliciousFileException,
  RateLimitExceededException,
} from '../exceptions';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/documents/upload',
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle ValidationException correctly', () => {
      const taskId = 'task-123';
      const message = 'Invalid file type';
      const exception = new ValidationException(message, taskId);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Validation Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId,
      });
    });

    it('should handle ProcessingException correctly', () => {
      const taskId = 'task-456';
      const message = 'AI model failed';
      const exception = new ProcessingException(message, taskId);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        error: 'Processing Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId,
      });
    });

    it('should handle TaskNotFoundException correctly', () => {
      const taskId = 'nonexistent-task';
      const exception = new TaskNotFoundException(taskId);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Task with ID '${taskId}' not found`,
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId,
      });
    });

    it('should handle SystemException correctly', () => {
      const message = 'Database connection failed';
      const exception = new SystemException(message);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        error: 'System Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId: undefined,
      });
    });

    it('should handle SecurityException correctly', () => {
      const message = 'Access denied';
      const exception = new SecurityException(message);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        message,
        error: 'Security Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId: undefined,
      });
    });

    it('should handle MaliciousFileException correctly', () => {
      const fileName = 'virus.exe';
      const reason = 'Contains malware';
      const taskId = 'task-security';
      const exception = new MaliciousFileException(fileName, reason, taskId);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        message: `File '${fileName}' rejected due to security concerns: ${reason}`,
        error: 'Security Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId,
      });
    });

    it('should handle RateLimitExceededException correctly', () => {
      const limit = 100;
      const window = '1 hour';
      const exception = new RateLimitExceededException(limit, window);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Rate limit exceeded: ${limit} requests per ${window}`,
        error: 'Security Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId: undefined,
      });
    });

    it('should handle generic HttpException correctly', () => {
      const message = 'Forbidden access';
      const exception = new HttpException(message, HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        message,
        error: 'Forbidden',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should handle validation errors from class-validator', () => {
      const validationError = new Error('Validation failed: field is required');
      validationError.name = 'ValidationError';

      filter.catch(validationError, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed: field is required',
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should handle file processing errors', () => {
      const processingError = new Error('OCR processing failed');

      filter.catch(processingError, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'OCR processing failed',
        error: 'Processing Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should handle system errors (file system)', () => {
      const systemError = new Error('ENOENT: no such file or directory');

      filter.catch(systemError, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error occurred during processing',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should handle unknown errors with default response', () => {
      const unknownError = { someProperty: 'unknown error' };

      filter.catch(unknownError, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should handle HttpException with structured response', () => {
      const structuredResponse = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Custom validation error',
        error: 'Custom Error',
        taskId: 'task-789',
      };
      const exception = new HttpException(
        structuredResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Custom validation error',
        error: 'Custom Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
        taskId: 'task-789',
      });
    });

    it('should handle different request paths correctly', () => {
      mockRequest.url = '/api/tasks/task-123/status';
      const exception = new ValidationException('Invalid task ID');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tasks/task-123/status',
        }),
      );
    });

    it('should include timestamp in ISO format', () => {
      const exception = new ValidationException('Test error');
      const beforeTime = new Date().toISOString();

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const afterTime = new Date().toISOString();
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      expect(responseCall.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(responseCall.timestamp >= beforeTime).toBe(true);
      expect(responseCall.timestamp <= afterTime).toBe(true);
    });
  });

  describe('error detection methods', () => {
    it('should detect validation errors correctly', () => {
      const validationErrors = [
        new Error('validation failed'),
        new Error('invalid input data'),
        { name: 'ValidationError', message: 'field required' },
      ];

      validationErrors.forEach((error) => {
        filter.catch(error, mockArgumentsHost as ArgumentsHost);
        expect(mockResponse.status).toHaveBeenCalledWith(
          HttpStatus.BAD_REQUEST,
        );
      });
    });

    it('should detect file processing errors correctly', () => {
      const processingErrors = [
        new Error('processing failed'),
        new Error('extraction error occurred'),
        new Error('AI model initialization failed'),
        new Error('OCR could not read text'),
        new Error('summarization timeout'),
      ];

      processingErrors.forEach((error) => {
        jest.clearAllMocks();
        filter.catch(error, mockArgumentsHost as ArgumentsHost);
        expect(mockResponse.status).toHaveBeenCalledWith(
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      });
    });

    it('should detect system errors correctly', () => {
      const systemErrors = [
        new Error('ENOENT: file not found'),
        new Error('EACCES: permission denied'),
        new Error('EMFILE: too many open files'),
        new Error('ENOMEM: out of memory'),
        { name: 'SystemError', message: 'system failure' },
      ];

      systemErrors.forEach((error) => {
        jest.clearAllMocks();
        filter.catch(error, mockArgumentsHost as ArgumentsHost);
        expect(mockResponse.status).toHaveBeenCalledWith(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    it('should detect security errors correctly', () => {
      const securityErrors = [
        new Error('security violation detected'),
        new Error('malicious file detected'),
        new Error('unauthorized access attempt'),
        new Error('rate limit exceeded'),
        new Error('forbidden operation'),
        { name: 'SecurityError', message: 'security breach' },
      ];

      securityErrors.forEach((error) => {
        jest.clearAllMocks();
        filter.catch(error, mockArgumentsHost as ArgumentsHost);
        const statusCall = (mockResponse.status as jest.Mock).mock.calls[0][0];
        expect([
          HttpStatus.FORBIDDEN,
          HttpStatus.UNAUTHORIZED,
          HttpStatus.TOO_MANY_REQUESTS,
        ]).toContain(statusCall);
      });
    });

    it('should determine correct security error status codes', () => {
      const testCases = [
        {
          error: new Error('unauthorized access'),
          expectedStatus: HttpStatus.UNAUTHORIZED,
        },
        {
          error: new Error('authentication required'),
          expectedStatus: HttpStatus.UNAUTHORIZED,
        },
        {
          error: new Error('rate limit exceeded'),
          expectedStatus: HttpStatus.TOO_MANY_REQUESTS,
        },
        {
          error: new Error('malicious content detected'),
          expectedStatus: HttpStatus.FORBIDDEN,
        },
        {
          error: new Error('security policy violation'),
          expectedStatus: HttpStatus.FORBIDDEN,
        },
      ];

      testCases.forEach(({ error, expectedStatus }) => {
        jest.clearAllMocks();
        filter.catch(error, mockArgumentsHost as ArgumentsHost);
        expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus);
      });
    });
  });

  describe('getErrorName', () => {
    it('should return correct error names for different status codes', () => {
      const testCases = [
        { status: HttpStatus.BAD_REQUEST, expected: 'Bad Request' },
        { status: HttpStatus.UNAUTHORIZED, expected: 'Unauthorized' },
        { status: HttpStatus.FORBIDDEN, expected: 'Forbidden' },
        { status: HttpStatus.NOT_FOUND, expected: 'Not Found' },
        { status: HttpStatus.CONFLICT, expected: 'Conflict' },
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          expected: 'Unprocessable Entity',
        },
        { status: HttpStatus.TOO_MANY_REQUESTS, expected: 'Too Many Requests' },
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          expected: 'Internal Server Error',
        },
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          expected: 'Service Unavailable',
        },
        { status: 999, expected: 'Error' }, // Unknown status code
      ];

      testCases.forEach(({ status, expected }) => {
        const exception = new HttpException('Test', status);
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);

        const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(responseCall.error).toBe(expected);

        jest.clearAllMocks();
      });
    });
  });
});
