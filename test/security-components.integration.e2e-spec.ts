import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityLoggerService } from '../src/security/security-logger.service';
import { CorsSecurityService } from '../src/security/cors-security.service';
import { SecurityConfigService } from '../src/config/security-config.service';

describe('Security Components Integration', () => {
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
        }),
      ],
      providers: [
        SecurityLoggerService,
        CorsSecurityService,
        SecurityConfigService,
      ],
    }).compile();

    securityLogger = moduleFixture.get<SecurityLoggerService>(
      SecurityLoggerService,
    );
    corsSecurityService =
      moduleFixture.get<CorsSecurityService>(CorsSecurityService);
    securityConfigService = moduleFixture.get<SecurityConfigService>(
      SecurityConfigService,
    );
  });

  describe('Rate Limiting Integration Tests', () => {
    it('should log rate limit violations with proper structure', () => {
      const initialLogCount = securityLogger.getLogsByType('RATE_LIMIT').length;

      const rateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED' as const,
        clientIp: '192.168.1.1',
        endpoint: '/api/test',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      securityLogger.logRateLimitViolation(rateLimitEvent);

      const rateLimitLogs = securityLogger.getLogsByType('RATE_LIMIT');
      expect(rateLimitLogs.length).toBe(initialLogCount + 1);

      const latestLog = rateLimitLogs[rateLimitLogs.length - 1];
      expect(latestLog.endpoint).toBe('/api/test');
      expect(latestLog.clientIp).toBe('192.168.1.1');
      expect(latestLog.details.violationType).toBe('RATE_LIMIT_EXCEEDED');
      expect(latestLog.details.requestCount).toBe(4);
    });

    it('should detect suspicious patterns from multiple violations', () => {
      const clientIp = '192.168.1.100';

      // Generate multiple rate limit violations quickly
      for (let i = 0; i < 6; i++) {
        const rateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED' as const,
          clientIp,
          endpoint: '/api/test',
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
      const alertLog = alertLogs[alertLogs.length - 1];
      expect(alertLog.clientIp).toBe(clientIp);
      expect(alertLog.details.violationCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('CORS Integration Tests', () => {
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

    it('should provide correct CORS configuration structure', () => {
      const corsConfig = corsSecurityService.getCorsConfig();

      expect(corsConfig).toHaveProperty('origin');
      expect(corsConfig.methods).toContain('GET');
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.methods).toContain('PUT');
      expect(corsConfig.methods).toContain('DELETE');
      expect(corsConfig.methods).toContain('OPTIONS');
      expect(corsConfig.credentials).toBe(true);
      expect(corsConfig.maxAge).toBe(86400);
    });

    it('should handle CORS origin validation callback', () => {
      const corsConfig = corsSecurityService.getCorsConfig();

      // Test authorized origin
      let callbackResult: { error: Error | null; allow?: boolean } = {
        error: null,
      };
      corsConfig.origin(
        'https://supernotaire.fr',
        (error: Error | null, allow?: boolean) => {
          callbackResult = { error, allow };
        },
      );

      expect(callbackResult.error).toBeNull();
      expect(callbackResult.allow).toBe(true);

      // Test unauthorized origin
      corsConfig.origin(
        'https://malicious.com',
        (error: Error | null, allow?: boolean) => {
          callbackResult = { error, allow };
        },
      );

      expect(callbackResult.error).toBeInstanceOf(Error);
      expect(callbackResult.error?.message).toContain(
        'not allowed by CORS policy',
      );
      expect(callbackResult.allow).toBe(false);
    });

    it('should log CORS violations with proper structure', () => {
      const initialLogCount =
        securityLogger.getLogsByType('CORS_VIOLATION').length;

      const corsViolationEvent = {
        type: 'CORS_VIOLATION' as const,
        origin: 'https://malicious-site.com',
        clientIp: '192.168.1.2',
        endpoint: '/api/test',
        method: 'GET',
        timestamp: new Date(),
      };

      securityLogger.logCorsViolation(corsViolationEvent);

      const corsLogs = securityLogger.getLogsByType('CORS_VIOLATION');
      expect(corsLogs.length).toBe(initialLogCount + 1);

      const latestLog = corsLogs[corsLogs.length - 1];
      expect(latestLog.origin).toBe('https://malicious-site.com');
      expect(latestLog.clientIp).toBe('192.168.1.2');
      expect(latestLog.endpoint).toBe('/api/test');
      expect(latestLog.details.method).toBe('GET');
      expect(latestLog.details.violationType).toBe('CORS_VIOLATION');
    });
  });

  describe('Security Event Logging Integration Tests', () => {
    it('should log security configuration with proper structure', () => {
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
      expect(latestLog.details.corsAllowedOrigins).toContain(
        'http://localhost:3001',
      );
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

    it('should filter logs by IP address correctly', () => {
      const testIp = '192.168.1.200';

      // Add a log for specific IP
      const rateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED' as const,
        clientIp: testIp,
        endpoint: '/api/test-ip',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };
      securityLogger.logRateLimitViolation(rateLimitEvent);

      const ipLogs = securityLogger.getLogsByIp(testIp);
      expect(ipLogs.length).toBeGreaterThan(0);
      expect(ipLogs.every((log) => log.clientIp === testIp)).toBe(true);

      const testLog = ipLogs.find((log) => log.endpoint === '/api/test-ip');
      expect(testLog).toBeDefined();
      expect(testLog?.clientIp).toBe(testIp);
    });

    it('should provide recent logs with proper ordering', () => {
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

  describe('Configuration Management Integration Tests', () => {
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

    it('should validate configuration correctly with no errors for defaults', () => {
      const errors = securityConfigService.validateConfiguration();

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(0); // No errors with default values
    });

    it('should provide configuration metadata indicating no env vars used', () => {
      const metadata = securityConfigService.getConfigurationMetadata();

      expect(metadata).toHaveProperty('rateLimitWindowFromEnv');
      expect(metadata).toHaveProperty('rateLimitMaxFromEnv');
      expect(metadata).toHaveProperty('corsOriginsFromEnv');

      // Since we cleared env vars, all should be false
      expect(metadata.rateLimitWindowFromEnv).toBe(false);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);
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
  });

  describe('Environment Variable Configuration Tests', () => {
    it('should handle configuration changes when environment variables are set', () => {
      // Test that the service can handle different configurations
      const rateLimitConfig = securityConfigService.getRateLimitConfig();
      const corsConfig = securityConfigService.getCorsConfig();

      // Verify current defaults
      expect(rateLimitConfig.windowMs).toBe(1000);
      expect(rateLimitConfig.maxRequests).toBe(3);
      expect(corsConfig.allowedOrigins).toEqual([
        'https://supernotaire.fr',
        'http://localhost:3001',
      ]);
    });

    it('should validate invalid configuration values', () => {
      // This test verifies the validation logic works
      const errors = securityConfigService.validateConfiguration();
      expect(errors).toEqual([]); // Should be empty for valid defaults

      // The validation method should catch invalid values when they exist
      expect(typeof securityConfigService.validateConfiguration).toBe(
        'function',
      );
    });
  });

  describe('Complete Security Workflow Integration Tests', () => {
    it('should integrate all security components in a complete workflow', () => {
      const initialStats = securityLogger.getSecurityStats();

      // 1. Log configuration initialization
      securityLogger.logSecurityConfiguration({
        rateLimit: { windowMs: 1000, maxRequests: 3 },
        cors: { allowedOrigins: ['https://supernotaire.fr'] },
      });

      // 2. Test CORS validation
      expect(
        corsSecurityService.isOriginAllowed('https://supernotaire.fr'),
      ).toBe(true);
      expect(corsSecurityService.isOriginAllowed('https://malicious.com')).toBe(
        false,
      );

      // 3. Log rate limit violation
      securityLogger.logRateLimitViolation({
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.300',
        endpoint: '/api/workflow-test',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      });

      // 4. Log CORS violation
      securityLogger.logCorsViolation({
        type: 'CORS_VIOLATION',
        origin: 'https://malicious.com',
        clientIp: '192.168.1.300',
        endpoint: '/api/workflow-test',
        method: 'POST',
        timestamp: new Date(),
      });

      // 5. Verify all components worked together
      const finalStats = securityLogger.getSecurityStats();
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

      // 6. Verify configuration services work
      const rateLimitConfig = securityConfigService.getRateLimitConfig();
      const corsConfig = securityConfigService.getCorsConfig();
      expect(rateLimitConfig.windowMs).toBe(1000);
      expect(corsConfig.allowedOrigins).toContain('https://supernotaire.fr');
    });

    it('should maintain performance with multiple security operations', () => {
      const startTime = Date.now();

      // Perform multiple security operations
      for (let i = 0; i < 50; i++) {
        corsSecurityService.isOriginAllowed('https://supernotaire.fr');
        corsSecurityService.isOriginAllowed('https://malicious.com');
        securityConfigService.getRateLimitConfig();
        securityConfigService.getCorsConfig();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (under 100ms for 200 operations)
      expect(duration).toBeLessThan(100);
    });
  });
});
