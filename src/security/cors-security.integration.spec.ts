import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ConfigService } from '@nestjs/config';

describe('CORS and Security Integration Tests', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get<ConfigService>(ConfigService);

    // Apply the same configuration as in main.ts
    const helmet = require('helmet');
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );

    app.enableCors({
      origin: configService.get<string>('app.frontendUrl'),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      credentials: true,
      optionsSuccessStatus: 200,
      maxAge: 86400,
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('CORS Configuration', () => {
    it('should allow requests from configured frontend URL', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

      const response = await request(app.getHttpServer())
        .options('/api/documents/upload')
        .set('Origin', frontendUrl)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(frontendUrl);
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type',
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/documents/upload')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow all configured HTTP methods', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

      for (const method of allowedMethods) {
        const response = await request(app.getHttpServer())
          .options('/api/tasks/test-id/status')
          .set('Origin', frontendUrl)
          .set('Access-Control-Request-Method', method);

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-methods']).toContain(
          method,
        );
      }
    });

    it('should allow all configured headers', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
      const allowedHeaders = [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ];

      const response = await request(app.getHttpServer())
        .options('/api/documents/upload')
        .set('Origin', frontendUrl)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', allowedHeaders.join(', '));

      expect(response.status).toBe(200);
      allowedHeaders.forEach((header) => {
        expect(response.headers['access-control-allow-headers']).toContain(
          header,
        );
      });
    });

    it('should set appropriate cache control for preflight requests', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

      const response = await request(app.getHttpServer())
        .options('/api/documents/upload')
        .set('Origin', frontendUrl)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-max-age']).toBe('86400');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-id/status')
        .expect(404); // Task not found, but headers should be present

      // Check for Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['strict-transport-security']).toContain(
        'max-age=31536000',
      );
    });

    it('should include Content Security Policy headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-id/status')
        .expect(404);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(response.headers['content-security-policy']).toContain(
        "object-src 'none'",
      );
    });

    it('should include HSTS headers for HTTPS security', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-id/status')
        .expect(404);

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain(
        'max-age=31536000',
      );
      expect(response.headers['strict-transport-security']).toContain(
        'includeSubDomains',
      );
      expect(response.headers['strict-transport-security']).toContain(
        'preload',
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to upload endpoint', async () => {
      const requests = [];

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/api/documents/upload')
            .attach('file', Buffer.from('test'), 'test.txt'),
        );
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to task status endpoint', async () => {
      const requests = [];

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 35; i++) {
        requests.push(
          request(app.getHttpServer()).get('/api/tasks/test-id/status'),
        );
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/tasks/test-id/status',
      );

      // Check for rate limiting headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize task ID parameters', async () => {
      const maliciousTaskId = '<script>alert("xss")</script>test-id';

      const response = await request(app.getHttpServer()).get(
        `/api/tasks/${maliciousTaskId}/status`,
      );

      // Should not find task with malicious ID (sanitized)
      expect(response.status).toBe(404);
      expect(response.body.message).not.toContain('<script>');
    });

    it('should handle path traversal attempts in task IDs', async () => {
      const maliciousTaskId = '../../../etc/passwd';

      const response = await request(app.getHttpServer()).get(
        `/api/tasks/${maliciousTaskId}/status`,
      );

      expect(response.status).toBe(404);
      // Sanitized ID should not contain path separators
      expect(response.body.message).not.toContain('../');
    });
  });

  describe('Error Handling with Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/tasks/non-existent-task/status',
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBeDefined();
      expect(response.body.statusCode).toBe(404);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.path).toBeDefined();

      // Should not expose internal system details
      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
    });

    it('should handle validation errors securely', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .send({ invalidData: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBeDefined();
      expect(response.body.statusCode).toBe(400);

      // Should not expose internal validation details
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('CORS with Actual Requests', () => {
    it('should handle actual POST request with CORS headers', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Origin', frontendUrl)
        .attach('file', Buffer.from('test'), 'test.txt');

      // Should include CORS headers in actual response
      expect(response.headers['access-control-allow-origin']).toBe(frontendUrl);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle actual GET request with CORS headers', async () => {
      const frontendUrl =
        configService.get<string>('app.frontendUrl') || 'http://localhost:3000';

      const response = await request(app.getHttpServer())
        .get('/api/tasks/test-id/status')
        .set('Origin', frontendUrl);

      // Should include CORS headers in actual response
      expect(response.headers['access-control-allow-origin']).toBe(frontendUrl);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
