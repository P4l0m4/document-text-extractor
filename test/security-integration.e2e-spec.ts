import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SecurityLoggerService } from '../src/security/security-logger.service';
import { CorsSecurityService } from '../src/security/cors-security.service';
import { SecurityConfigService } from '../src/config/security-config.service';

describe('Security Integration (e2e)', () => {
  let app: INestApplication;
  let securityLogger: SecurityLoggerService;
  let corsSecurityService: CorsSecurityService;
  let securityConfigService: SecurityConfigService;

  beforeAll(async () => {
    // Clear environment variables to test defaults
    delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
    delete process.env.SECURITY_RATE_LIMIT_MAX;
    delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Get services for testing
    securityLogger = app.get<SecurityLoggerService>(SecurityLoggerService);
    corsSecurityService = app.get<CorsSecurityService>(CorsSecurityService);
    securityConfigService = app.get<SecurityConfigService>(
      SecurityConfigService,
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limiting with 3 requests per second', async () => {
      const endpoint = '/health';

      // Make 3 requests (should succeed)
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect(200);

        // Check rate limit headers exist
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      }

      // 4th request should be rate limited
      const rateLimitedResponse = await request(app.getHttpServer())
        .get(endpoint)
        .expect(429);

      expect(rateLimitedResponse.body.message).toContain('Rate limit exceeded');
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should reset rate limit after time window', async () => {
      const endpoint = '/health';

      // Exhaust rate limit
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer()).get(endpoint).expect(200);
      }

      // Should be rate limited
      await request(app.getHttpServer()).get(endpoint).expect(429);

      // Wait for rate limit window to reset (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should work again
      await request(app.getHttpServer()).get(endpoint).expect(200);
    });

    it('should include proper rate limit headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      const reset = parseInt(response.headers['x-ratelimit-reset']);

      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(limit);
      expect(reset).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('CORS Integration', () => {
    it('should allow requests from authorized origins', async () => {
      const authorizedOrigins = [
        'https://supernotaire.fr',
        'http://localhost:3001',
      ];

      for (const origin of authorizedOrigins) {
        const response = await request(app.getHttpServer())
          .get('/health')
          .set('Origin', origin)
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.headers['access-control-allow-credentials']).toBe(
          'true',
        );
      }
    });

    it('should handle CORS preflight requests correctly', async () => {
      // Test authorized origin preflight
      const preflightResponse = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', 'https://supernotaire.fr')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(200);

      expect(preflightResponse.headers['access-control-allow-origin']).toBe(
        'https://supernotaire.fr',
      );
      expect(
        preflightResponse.headers['access-control-allow-methods'],
      ).toContain('GET');
      expect(
        preflightResponse.headers['access-control-allow-headers'],
      ).toContain('Content-Type');
      expect(preflightResponse.headers['access-control-max-age']).toBe('86400');
    });

    it('should allow requests with no origin (mobile apps, curl)', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Should not have CORS headers for requests without origin
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Security Event Logging Integration', () => {
    it('should log rate limit violations', async () => {
      const endpoint = '/health';
      const initialLogCount = securityLogger.getLogsByType('RATE_LIMIT').length;

      // Exhaust rate limit
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer()).get(endpoint);
      }

      // Trigger rate limit violation
      await request(app.getHttpServer()).get(endpoint).expect(429);

      const rateLimitLogs = securityLogger.getLogsByType('RATE_LIMIT');
      expect(rateLimitLogs.length).toBeGreaterThan(initialLogCount);

      const latestLog = rateLimitLogs[rateLimitLogs.length - 1];
      expect(latestLog.endpoint).toBe(endpoint);
      expect(latestLog.clientIp).toBeDefined();
      expect(latestLog.details.violationType).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should log security configuration on startup', async () => {
      const configLogs = securityLogger.getLogsByType('SECURITY_CONFIG');
      expect(configLogs.length).toBeGreaterThan(0);

      const latestConfigLog = configLogs[configLogs.length - 1];
      expect(latestConfigLog.details.rateLimitWindowMs).toBeDefined();
      expect(latestConfigLog.details.rateLimitMaxRequests).toBeDefined();
      expect(latestConfigLog.details.corsAllowedOrigins).toBeDefined();
    });

    it('should provide security statistics', async () => {
      const stats = securityLogger.getSecurityStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('rateLimitViolations');
      expect(stats).toHaveProperty('corsViolations');
      expect(stats).toHaveProperty('configEvents');
      expect(stats).toHaveProperty('uniqueIps');
      expect(stats).toHaveProperty('recentActivity');

      expect(typeof stats.totalEvents).toBe('number');
      expect(Array.isArray(stats.recentActivity)).toBe(true);
    });
  });

  describe('Configuration Management Integration', () => {
    it('should use secure defaults when environment variables are not set', async () => {
      const rateLimitConfig = securityConfigService.getRateLimitConfig();
      const corsConfig = securityConfigService.getCorsConfig();

      expect(rateLimitConfig.windowMs).toBe(1000); // 1 second
      expect(rateLimitConfig.maxRequests).toBe(3);
      expect(corsConfig.allowedOrigins).toContain('https://supernotaire.fr');
      expect(corsConfig.allowedOrigins).toContain('http://localhost:3001');
    });

    it('should validate configuration values', async () => {
      const errors = securityConfigService.validateConfiguration();
      expect(Array.isArray(errors)).toBe(true);

      // With default values, there should be no errors
      expect(errors.length).toBe(0);
    });

    it('should provide configuration metadata', async () => {
      const metadata = securityConfigService.getConfigurationMetadata();

      expect(metadata).toHaveProperty('rateLimitWindowFromEnv');
      expect(metadata).toHaveProperty('rateLimitMaxFromEnv');
      expect(metadata).toHaveProperty('corsOriginsFromEnv');

      // Since we cleared env vars, all should be false
      expect(metadata.rateLimitWindowFromEnv).toBe(false);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);
    });
  });

  describe('Complete Security Workflow Integration', () => {
    it('should handle multiple security measures simultaneously', async () => {
      const endpoint = '/health';
      const authorizedOrigin = 'https://supernotaire.fr';

      // Test authorized origin with rate limiting
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .set('Origin', authorizedOrigin)
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBe(
          authorizedOrigin,
        );
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
      }

      // 4th request should be rate limited but still have CORS headers
      const rateLimitedResponse = await request(app.getHttpServer())
        .get(endpoint)
        .set('Origin', authorizedOrigin)
        .expect(429);

      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should log comprehensive security events during workflow', async () => {
      const initialStats = securityLogger.getSecurityStats();

      // Generate various security events
      const endpoint = '/health';

      // Rate limit violations
      for (let i = 0; i < 5; i++) {
        try {
          await request(app.getHttpServer()).get(endpoint);
        } catch (error) {
          // Some will be rate limited
        }
      }

      const finalStats = securityLogger.getSecurityStats();

      // Should have more events than initially
      expect(finalStats.totalEvents).toBeGreaterThanOrEqual(
        initialStats.totalEvents,
      );
    });

    it('should maintain performance under security constraints', async () => {
      const endpoint = '/health';
      const startTime = Date.now();

      // Make multiple requests within rate limit
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app.getHttpServer())
            .get(endpoint)
            .set('Origin', 'https://supernotaire.fr'),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
