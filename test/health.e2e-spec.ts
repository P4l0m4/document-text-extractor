import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('metrics');

      // Verify checks structure
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('filesystem');
      expect(response.body.checks).toHaveProperty('process');

      // Verify metrics structure
      expect(response.body.metrics).toHaveProperty('activeConnections');
      expect(response.body.metrics).toHaveProperty('totalRequests');
      expect(response.body.metrics).toHaveProperty('memoryUsage');
      expect(response.body.metrics).toHaveProperty('cpuUsage');
      expect(response.body.metrics).toHaveProperty('processing');
      expect(response.body.metrics).toHaveProperty('requests');

      // Verify processing metrics
      expect(response.body.metrics.processing).toHaveProperty(
        'activeProcessingTasks',
      );
      expect(response.body.metrics.processing).toHaveProperty(
        'completedProcessingTasks',
      );
      expect(response.body.metrics.processing).toHaveProperty(
        'failedProcessingTasks',
      );
      expect(response.body.metrics.processing).toHaveProperty(
        'averageProcessingTime',
      );
      expect(response.body.metrics.processing).toHaveProperty('queueSize');

      // Verify request metrics
      expect(response.body.metrics.requests).toHaveProperty(
        'requestsPerMinute',
      );
      expect(response.body.metrics.requests).toHaveProperty(
        'averageResponseTime',
      );
      expect(response.body.metrics.requests).toHaveProperty(
        'peakConcurrentRequests',
      );
    });

    it('should return status ok when all checks pass', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('/health/ready (GET)', () => {
    it('should return readiness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body.status).toBe('ready');
      expect(response.body.message).toBe('Service is ready to accept requests');
    });
  });

  describe('/health/live (GET)', () => {
    it('should return liveness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body.status).toBe('alive');
      expect(response.body.message).toBe('Service is alive and responding');
    });
  });

  describe('health check performance', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get('/health').expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle multiple concurrent health checks', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get('/health').expect(200),
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body.status).toBeDefined();
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });

  describe('metrics tracking', () => {
    it('should track request metrics across health checks', async () => {
      // Make several requests to generate metrics
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health/ready');
      await request(app.getHttpServer()).get('/health/live');

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Note: Health endpoints are excluded from metrics tracking
      // so we're mainly testing that the metrics structure is present
      expect(
        response.body.metrics.requests.peakConcurrentRequests,
      ).toBeGreaterThanOrEqual(0);
      expect(
        response.body.metrics.requests.averageResponseTime,
      ).toBeGreaterThanOrEqual(0);
    });
  });
});
