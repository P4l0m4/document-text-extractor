import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  ValidationException,
  FileValidationException,
  FileSizeException,
  FileTypeException,
  ProcessingException,
  AIModelException,
  TextExtractionException,
  SummarizationException,
  DocumentCorruptedException,
  UnsupportedDocumentException,
  SystemException,
  ResourceExhaustedException,
  FileSystemException,
  QueueException,
  TaskNotFoundException,
  ServiceUnavailableException,
  SecurityException,
  MaliciousFileException,
  UnauthorizedAccessException,
  RateLimitExceededException,
} from '../exceptions';

describe('Comprehensive Error Handling Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Validation Error Scenarios', () => {
    it('should handle ValidationException with proper HTTP status and format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: expect.stringMatching(/Validation Error|Bad Request/),
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
      expect(response.body.message).toBeTruthy();
    });

    it('should handle file size validation errors', async () => {
      // Create a buffer larger than the configured limit (assuming 10MB limit)
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', largeBuffer, 'large-file.pdf')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: expect.stringMatching(/Validation Error|Bad Request/),
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
      expect(response.body.message).toContain('size');
    });

    it('should handle file type validation errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('fake content'), 'test.txt')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: expect.stringMatching(/Validation Error|Bad Request/),
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
      expect(response.body.message).toContain('type');
    });
  });

  describe('Task Management Error Scenarios', () => {
    it('should handle TaskNotFoundException with 404 status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/nonexistent-task-id/status')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('not found'),
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/tasks/nonexistent-task-id/status',
        taskId: 'nonexistent-task-id',
      });
    });

    it('should handle TaskNotFoundException for result endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/missing-task/result')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('not found'),
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/tasks/missing-task/result',
        taskId: 'missing-task',
      });
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should always include required error response fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-task/status')
        .expect(404);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path');

      // Verify field types
      expect(typeof response.body.statusCode).toBe('number');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.path).toBe('string');

      // Verify timestamp format (ISO 8601)
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should include taskId when available in error context', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-task-with-id/status')
        .expect(404);

      expect(response.body).toHaveProperty('taskId', 'test-task-with-id');
    });

    it('should not expose sensitive system information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test/status')
        .expect(404);

      // Should not contain file paths, stack traces, or internal details
      expect(response.body.message).not.toContain('/src/');
      expect(response.body.message).not.toContain('node_modules');
      expect(response.body.message).not.toContain('at ');
      expect(response.body.message).not.toContain('Error:');
      expect(response.body.message).not.toContain('stack');
    });
  });

  describe('HTTP Status Code Correctness', () => {
    const testCases = [
      {
        description: 'should return 400 for validation errors',
        request: () =>
          request(app.getHttpServer()).post('/api/documents/upload'),
        expectedStatus: 400,
      },
      {
        description: 'should return 404 for not found errors',
        request: () =>
          request(app.getHttpServer()).get('/api/tasks/missing/status'),
        expectedStatus: 404,
      },
      {
        description: 'should return 404 for non-existent endpoints',
        request: () => request(app.getHttpServer()).get('/api/nonexistent'),
        expectedStatus: 404,
      },
    ];

    testCases.forEach(
      ({ description, request: makeRequest, expectedStatus }) => {
        it(description, async () => {
          await makeRequest().expect(expectedStatus);
        });
      },
    );
  });

  describe('Error Message Quality', () => {
    it('should provide clear and actionable error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(400);

      expect(response.body.message).toBeTruthy();
      expect(response.body.message.length).toBeGreaterThan(0);
      expect(response.body.message).not.toContain('undefined');
      expect(response.body.message).not.toContain('null');
      expect(typeof response.body.message).toBe('string');
    });

    it('should handle different request paths correctly', async () => {
      const testPaths = [
        '/api/documents/upload',
        '/api/tasks/test/status',
        '/api/tasks/test/result',
      ];

      for (const path of testPaths) {
        const response = await request(app.getHttpServer()).get(path);

        expect(response.body.path).toBe(path);
      }
    });
  });

  describe('Exception Class Integration', () => {
    // These tests verify that our custom exception classes work properly
    // when thrown in the application context

    it('should handle custom validation exceptions properly', () => {
      const validationError = new ValidationException(
        'Custom validation error',
        'task-123',
      );

      expect(validationError.getStatus()).toBe(400);
      const response = validationError.getResponse() as any;
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Custom validation error');
      expect(response.error).toBe('Validation Error');
      expect(response.taskId).toBe('task-123');
    });

    it('should handle file validation exceptions with proper formatting', () => {
      const fileError = new FileValidationException(
        'Invalid format',
        'test.txt',
        'task-456',
      );

      const response = fileError.getResponse() as any;
      expect(response.message).toBe("File 'test.txt': Invalid format");
      expect(response.taskId).toBe('task-456');
    });

    it('should handle file size exceptions with detailed information', () => {
      const sizeError = new FileSizeException(
        'large.pdf',
        15728640, // 15MB
        10485760, // 10MB
        'task-789',
      );

      const response = sizeError.getResponse() as any;
      expect(response.message).toContain('15728640 bytes');
      expect(response.message).toContain('10485760 bytes');
      expect(response.message).toContain('large.pdf');
    });

    it('should handle file type exceptions with allowed types', () => {
      const typeError = new FileTypeException(
        'document.txt',
        'text/plain',
        ['image/png', 'application/pdf'],
        'task-101',
      );

      const response = typeError.getResponse() as any;
      expect(response.message).toContain('text/plain');
      expect(response.message).toContain('image/png, application/pdf');
    });

    it('should handle processing exceptions with proper status codes', () => {
      const processingError = new ProcessingException(
        'Processing failed',
        'task-202',
      );

      expect(processingError.getStatus()).toBe(422); // UNPROCESSABLE_ENTITY
      const response = processingError.getResponse() as any;
      expect(response.error).toBe('Processing Error');
    });

    it('should handle AI model exceptions as processing errors', () => {
      const aiError = new AIModelException('Model unavailable', 'task-303');

      const response = aiError.getResponse() as any;
      expect(response.message).toBe('AI model error: Model unavailable');
      expect(response.statusCode).toBe(422);
    });

    it('should handle system exceptions with appropriate status codes', () => {
      const systemError = new SystemException(
        'System failure',
        500,
        'task-404',
      );

      expect(systemError.getStatus()).toBe(500);
      const response = systemError.getResponse() as any;
      expect(response.error).toBe('System Error');
    });

    it('should handle security exceptions with forbidden status', () => {
      const securityError = new SecurityException(
        'Access denied',
        403,
        'task-505',
      );

      expect(securityError.getStatus()).toBe(403);
      const response = securityError.getResponse() as any;
      expect(response.error).toBe('Security Error');
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should not expose internal error details in production-like responses', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(400);

      // Should not contain stack traces or internal paths
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('at Object.');
      expect(responseString).not.toContain('node_modules');
      expect(responseString).not.toContain(__dirname);
      expect(responseString).not.toContain('src/');
    });

    it('should maintain consistent error format across different error types', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).post('/api/documents/upload'),
        request(app.getHttpServer()).get('/api/tasks/missing/status'),
        request(app.getHttpServer()).get('/api/nonexistent'),
      ]);

      responses.forEach((response) => {
        expect(response.body).toHaveProperty('statusCode');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('path');
      });
    });
  });
});
