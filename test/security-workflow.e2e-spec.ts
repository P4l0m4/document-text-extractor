import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { SecurityLoggerService } from '../src/security/security-logger.service';
import { CorsSecurityService } from '../src/security/cors-security.service';
import { SecurityConfigService } from '../src/config/security-config.service';
import { SecurityModule } from '../src/security/security.module';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '../src/health/health.module';
import configuration from '../src/config/configuration';
import securityConfig from '../src/config/security.config';

describe('Security Workflow Integration (e2e)', () => {
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
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration, securityConfig],
        }),
        SecurityModule,
        HealthModule,
      ],
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

  describe('CORS Security Service Integration', () => {
    it('should validate authorized origins correctly', () => {
      const authorizedOrigins = [
        'https://supernotaire.fr',
        'http://localhost:3001',
      ];

      authorizedOrigins.forEach((origin) => {
        expect(corsSecurityService.isOriginAllowed(origin)).toBe(true);
      });
    });

    it('should reject unauthorized origins', () => {
      const unauthorizedOrigins = [
        'https://malicious-site.com',
        'http://localhost:3000',
        'https://evil.com',
      ];

      unauthorizedOrigins.forEach((origin) => {
        expect(corsSecurityService.isOriginAllowed(origin)).toBe(false);
      });
    });

    it('should provide correct CORS configuration', () => {
      const corsConfig = corsSecurityService.getCorsConfig();

      expect(corsConfig).toHaveProperty('origin');
      expect(corsConfig.methods).toContain('GET');
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.credentials).toBe(true);
      expect(corsConfig.maxAge).toBe(86400);
    });

    it('should return allowed origins list', () => {
      const allowedOrigins = corsSecurityService.getAllowedOrigins();

      expect(allowedOrigins).toContain('https://supernotaire.fr');
      expect(allowedOrigins).toContain('http://localhost:3001');
      expect(allowedOrigins.length).toBe(2);
    });
  });

  describe('Security Logger Service Integration', () => {
    it('should log rate limit violations', () => {
      const initialLogCount = securityLogger.getLogsByType('RATE_LIMIT').length;

      const rateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED' as const,
        clientIp: '192.168.1.1',
        endpoint: '/test',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      securityLogger.logRateLimitViolation(rateLimitEvent);

      const rateLimitLogs = securityLogger.getLogsByType('RATE_LIMIT');
      expect(rateLimitLogs.length).toBe(initialLogCount + 1);

      const latestLog = rateLimitLogs[rateLimitLogs.length - 1];
      expect(latestLog.endpoint).toBe('/test');
      expect(latestLog.clientIp).toBe('192.168.1.1');
      expect(latestLog.details.violationType).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should log CORS violations', () => {
      const initialLogCount =
        securityLogger.getLogsByType('CORS_VIOLATION').length;

      const corsViolationEvent = {
        type: 'CORS_VIOLATION' as const,
        origin: 'https://malicious-site.com',
        clientIp: '192.168.1.2',
        endpoint: '/test',
        method: 'GET',
        timestamp: new Date(),
      };

      securityLogger.logCorsViolation(corsViolationEvent);

      const corsLogs = securityLogger.getLogsByType('CORS_VIOLATION');
      expect(corsLogs.length).toBe(initialLogCount + 1);

      const latestLog = corsLogs[corsLogs.length - 1];
      expect(latestLog.origin).toBe('https://malicious-site.com');
      expect(latestLog.clientIp).toBe('192.168.1.2');
      expect(latestLog.details.violationType).toBe('CORS_VIOLATION');
    });

    it('should log security configuration', () => {
      const initialLogCount =
        securityLogger.getLogsByType('SECURITY_CONFIG').length;

      securityLogger.logSecurityConfiguration({
        rateLimit: {
          windowMs: 1000,
          maxRequests: 3,
        },
        cors: {
          allowedOrigins: ['https://supernotaire.fr', 'http://localhost:3001'],
        },
      });

      const configLogs = securityLogger.getLogsByType('SECURITY_CONFIG');
      expect(configLogs.length).toBe(initialLogCount + 1);

      const latestLog = configLogs[configLogs.length - 1];
      expect(latestLog.details.rateLimitWindowMs).toBe(1000);
      expect(latestLog.details.rateLimitMaxRequests).toBe(3);
      expect(latestLog.details.corsAllowedOrigins).toContain(
        'https://supernotaire.fr',
      );
    });

    it('should detect suspicious patterns and log alerts', () => {
      const clientIp = '192.168.1.100';

      // Generate multiple rate limit violations quickly
      for (let i = 0; i < 6; i++) {
        const rateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED' as const,
          clientIp,
          endpoint: '/test',
          requestCount: i + 4,
          windowStart: new Date(),
          timestamp: new Date(),
        };
        securityLogger.logRateLimitViolation(rateLimitEvent);
      }

      // Check if suspicious pattern alert was logged
      const rateLimitLogs = securityLogger.getLogsByType('RATE_LIMIT');
      const alertLogs = rateLimitLogs.filter(
        (log) => log.details.alertType === 'MULTIPLE_RATE_LIMIT_VIOLATIONS',
      );

      expect(alertLogs.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive security statistics', () => {
      const stats = securityLogger.getSecurityStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('rateLimitViolations');
      expect(stats).toHaveProperty('corsViolations');
      expect(stats).toHaveProperty('configEvents');
      expect(stats).toHaveProperty('uniqueIps');
      expect(stats).toHaveProperty('recentActivity');

      expect(typeof stats.totalEvents).toBe('number');
      expect(typeof stats.rateLimitViolations).toBe('number');
      expect(typeof stats.corsViolations).toBe('number');
      expect(typeof stats.configEvents).toBe('number');
      expect(typeof stats.uniqueIps).toBe('number');
      expect(Array.isArray(stats.recentActivity)).toBe(true);

      // Should have events from previous tests
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.rateLimitViolations).toBeGreaterThan(0);
      expect(stats.corsViolations).toBeGreaterThan(0);
      expect(stats.configEvents).toBeGreaterThan(0);
    });

    it('should filter logs by IP address', () => {
      const testIp = '192.168.1.200';

      // Add a log for specific IP
      const rateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED' as const,
        clientIp: testIp,
        endpoint: '/test-ip',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };
      securityLogger.logRateLimitViolation(rateLimitEvent);

      const ipLogs = securityLogger.getLogsByIp(testIp);
      expect(ipLogs.length).toBeGreaterThan(0);
      expect(ipLogs.every((log) => log.clientIp === testIp)).toBe(true);
    });

    it('should provide recent logs with limit', () => {
      const recentLogs = securityLogger.getRecentLogs(5);

      expect(Array.isArray(recentLogs)).toBe(true);
      expect(recentLogs.length).toBeLessThanOrEqual(5);

      // Should be sorted by most recent first
      if (recentLogs.length > 1) {
        for (let i = 1; i < recentLogs.length; i++) {
          expect(recentLogs[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
            recentLogs[i].timestamp.getTime(),
          );
        }
      }
    });
  });

  describe('Security Configuration Service Integration', () => {
    it('should provide secure default rate limit configuration', () => {
      const rateLimitConfig = securityConfigService.getRateLimitConfig();

      expect(rateLimitConfig.windowMs).toBe(1000); // 1 second
      expect(rateLimitConfig.maxRequests).toBe(3);
      expect(rateLimitConfig.skipSuccessfulRequests).toBe(false);
      expect(rateLimitConfig.skipFailedRequests).toBe(false);
      expect(rateLimitConfig.standardHeaders).toBe(true);
      expect(rateLimitConfig.legacyHeaders).toBe(false);
    });

    it('should provide secure default CORS configuration', () => {
      const corsConfig = securityConfigService.getCorsConfig();

      expect(corsConfig.allowedOrigins).toContain('https://supernotaire.fr');
      expect(corsConfig.allowedOrigins).toContain('http://localhost:3001');
      expect(corsConfig.credentials).toBe(true);
      expect(corsConfig.methods).toContain('GET');
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.methods).toContain('PUT');
      expect(corsConfig.methods).toContain('DELETE');
      expect(corsConfig.methods).toContain('OPTIONS');
      expect(corsConfig.maxAge).toBe(86400);
    });

    it('should provide complete security configuration', () => {
      const securityConfig = securityConfigService.getSecurityConfig();

      expect(securityConfig).toHaveProperty('rateLimit');
      expect(securityConfig).toHaveProperty('cors');
      expect(securityConfig).toHaveProperty('logging');

      expect(securityConfig.rateLimit.windowMs).toBe(1000);
      expect(securityConfig.rateLimit.maxRequests).toBe(3);
      expect(securityConfig.cors.allowedOrigins).toContain(
        'https://supernotaire.fr',
      );
      expect(securityConfig.logging.enabled).toBe(true);
      expect(securityConfig.logging.level).toBe('info');
    });

    it('should validate configuration correctly', () => {
      const errors = securityConfigService.validateConfiguration();

      expect(Array.isArray(errors)).toBe(true);
      // With default values, there should be no errors
      expect(errors.length).toBe(0);
    });

    it('should provide configuration metadata', () => {
      const metadata = securityConfigService.getConfigurationMetadata();

      expect(metadata).toHaveProperty('rateLimitWindowFromEnv');
      expect(metadata).toHaveProperty('rateLimitMaxFromEnv');
      expect(metadata).toHaveProperty('corsOriginsFromEnv');

      expect(typeof metadata.rateLimitWindowFromEnv).toBe('boolean');
      expect(typeof metadata.rateLimitMaxFromEnv).toBe('boolean');
      expect(typeof metadata.corsOriginsFromEnv).toBe('boolean');

      // Since we cleared env vars, all should be false
      expect(metadata.rateLimitWindowFromEnv).toBe(false);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);
    });
  });

  describe('Complete Security Workflow Integration', () => {
    it('should integrate all security components correctly', () => {
      // Test that all services are properly initialized and working together
      const corsConfig = corsSecurityService.getCorsConfig();
      const rateLimitConfig = securityConfigService.getRateLimitConfig();
      const stats = securityLogger.getSecurityStats();

      // CORS service should be configured correctly
      expect(corsConfig.origin).toBeDefined();
      expect(corsConfig.credentials).toBe(true);

      // Rate limit config should have secure defaults
      expect(rateLimitConfig.windowMs).toBe(1000);
      expect(rateLimitConfig.maxRequests).toBe(3);

      // Logger should have captured events from previous tests
      expect(stats.totalEvents).toBeGreaterThan(0);
    });

    it('should handle security event logging workflow', () => {
      const initialStats = securityLogger.getSecurityStats();

      // Simulate a complete security workflow
      const clientIp = '192.168.1.300';

      // 1. Log configuration initialization
      securityLogger.logSecurityConfiguration({
        rateLimit: { windowMs: 1000, maxRequests: 3 },
        cors: { allowedOrigins: ['https://supernotaire.fr'] },
      });

      // 2. Log rate limit violation
      securityLogger.logRateLimitViolation({
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp,
        endpoint: '/api/test',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      });

      // 3. Log CORS violation
      securityLogger.logCorsViolation({
        type: 'CORS_VIOLATION',
        origin: 'https://malicious.com',
        clientIp,
        endpoint: '/api/test',
        method: 'POST',
        timestamp: new Date(),
      });

      const finalStats = securityLogger.getSecurityStats();

      // Should have more events than initially
      expect(finalStats.totalEvents).toBeGreaterThan(initialStats.totalEvents);
      expect(finalStats.rateLimitViolations).toBeGreaterThan(
        initialStats.rateLimitViolations,
      );
      expect(finalStats.corsViolations).toBeGreaterThan(
        initialStats.corsViolations,
      );
      expect(finalStats.configEvents).toBeGreaterThan(
        initialStats.configEvents,
      );
    });

    it('should maintain performance with multiple security operations', () => {
      const startTime = Date.now();

      // Perform multiple security operations
      for (let i = 0; i < 10; i++) {
        corsSecurityService.isOriginAllowed('https://supernotaire.fr');
        corsSecurityService.isOriginAllowed('https://malicious.com');
        securityConfigService.getRateLimitConfig();
        securityConfigService.getCorsConfig();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (under 100ms for 40 operations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle configuration validation workflow', () => {
      // Test the complete configuration validation workflow
      const rateLimitConfig = securityConfigService.getRateLimitConfig();
      const corsConfig = securityConfigService.getCorsConfig();
      const securityConfig = securityConfigService.getSecurityConfig();
      const metadata = securityConfigService.getConfigurationMetadata();
      const errors = securityConfigService.validateConfiguration();

      // All configurations should be valid and consistent
      expect(rateLimitConfig.windowMs).toBe(securityConfig.rateLimit.windowMs);
      expect(rateLimitConfig.maxRequests).toBe(
        securityConfig.rateLimit.maxRequests,
      );
      expect(corsConfig.allowedOrigins).toEqual(
        securityConfig.cors.allowedOrigins,
      );

      // Metadata should reflect that no env vars were used
      expect(metadata.rateLimitWindowFromEnv).toBe(false);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);

      // No validation errors with defaults
      expect(errors.length).toBe(0);
    });
  });
});
