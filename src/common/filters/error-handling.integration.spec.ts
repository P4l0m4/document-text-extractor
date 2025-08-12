import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('Error Handling Integration', () => {
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

  describe('File Upload Error Scenarios', () => {
    it('should return 400 for missing file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: 'No file provided',
        error: 'Validation Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });

    it('should return 400 for invalid file type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('fake content'), 'test.txt')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Validation Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
      expect(response.body.message).toContain('File type');
    });

    it('should return 400 for file too large', async () => {
      // Create a buffer larger than the configured limit
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', largeBuffer, 'large-file.pdf')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Validation Error',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
      expect(response.body.message).toContain('size');
    });
  });

  describe('Task Error Scenarios', () => {
    it('should return 404 for non-existent task status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/nonexistent-task/status')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: "Task with ID 'nonexistent-task' not found",
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/tasks/nonexistent-task/status',
        taskId: 'nonexistent-task',
      });
    });

    it('should return 404 for non-existent task result', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/nonexistent-task/result')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: "Task with ID 'nonexistent-task' not found",
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/tasks/nonexistent-task/result',
        taskId: 'nonexistent-task',
      });
    });
  });

  describe('Validation Error Scenarios', () => {
    it('should return 400 for invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .send({ invalidField: 'invalid value' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/documents/upload',
      });
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should always include required error response fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/invalid-task/status')
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

    it('should include taskId when available', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-task-id/status')
        .expect(404);

      expect(response.body).toHaveProperty('taskId', 'test-task-id');
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
    });

    it('should not expose sensitive system information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test/status')
        .expect(404);

      // Should not contain file paths, stack traces, or internal details
      expect(response.body.message).not.toContain('/src/');
      expect(response.body.message).not.toContain('node_modules');
      expect(response.body.message).not.toContain('at ');
      expect(response.body.message).not.toContain('Error:');
    });
  });
});
