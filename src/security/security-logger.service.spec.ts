import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  SecurityLoggerService,
  RateLimitEvent,
  CorsViolationEvent,
  SecurityLogEntry,
} from './security-logger.service';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityLoggerService],
    }).compile();

    service = module.get<SecurityLoggerService>(SecurityLoggerService);
    loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logRateLimitViolation', () => {
    it('should log rate limit violation with correct details', () => {
      const event: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 5,
        windowStart: new Date('2023-01-01T10:00:00Z'),
        timestamp: new Date('2023-01-01T10:00:01Z'),
      };

      service.logRateLimitViolation(event);

      const logs = service.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'RATE_LIMIT',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        details: {
          requestCount: 5,
          windowStart: new Date('2023-01-01T10:00:00Z'),
          violationType: 'RATE_LIMIT_EXCEEDED',
        },
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded for IP 192.168.1.1'),
      );
    });

    it('should store timestamp correctly', () => {
      const timestamp = new Date('2023-01-01T10:00:01Z');
      const event: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3,
        windowStart: new Date('2023-01-01T10:00:00Z'),
        timestamp,
      };

      service.logRateLimitViolation(event);

      const logs = service.getRecentLogs(1);
      expect(logs[0].timestamp).toEqual(timestamp);
    });
  });

  describe('logCorsViolation', () => {
    it('should log CORS violation with correct details', () => {
      const event: CorsViolationEvent = {
        type: 'CORS_VIOLATION',
        origin: 'https://malicious-site.com',
        clientIp: '192.168.1.2',
        endpoint: '/api/process',
        method: 'POST',
        timestamp: new Date('2023-01-01T10:00:02Z'),
      };

      service.logCorsViolation(event);

      const logs = service.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'CORS_VIOLATION',
        clientIp: '192.168.1.2',
        origin: 'https://malicious-site.com',
        endpoint: '/api/process',
        details: {
          method: 'POST',
          violationType: 'CORS_VIOLATION',
        },
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'CORS violation from origin https://malicious-site.com',
        ),
      );
    });
  });

  describe('logSecurityConfiguration', () => {
    it('should log security configuration initialization', () => {
      const config = {
        rateLimit: { windowMs: 1000, maxRequests: 3 },
        cors: {
          allowedOrigins: ['https://supernotaire.fr', 'http://localhost:3001'],
        },
      };

      service.logSecurityConfiguration(config);

      const logs = service.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'SECURITY_CONFIG',
        clientIp: 'system',
        endpoint: 'configuration',
        details: {
          rateLimitWindowMs: 1000,
          rateLimitMaxRequests: 3,
          corsAllowedOrigins: [
            'https://supernotaire.fr',
            'http://localhost:3001',
          ],
          configType: 'INITIALIZATION',
        },
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Security configuration initialized'),
      );
    });
  });

  describe('logSecurityAlert', () => {
    it('should log security alert with custom details', () => {
      const details = {
        violationCount: 5,
        timeWindow: '1 minute',
        endpoints: ['/api/upload', '/api/process'],
      };

      service.logSecurityAlert(
        '192.168.1.1',
        'MULTIPLE_RATE_LIMIT_VIOLATIONS',
        details,
      );

      const logs = service.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'RATE_LIMIT',
        clientIp: '192.168.1.1',
        endpoint: 'multiple',
        details: {
          alertType: 'MULTIPLE_RATE_LIMIT_VIOLATIONS',
          ...details,
        },
      });

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Security alert for IP 192.168.1.1'),
      );
    });
  });

  describe('getLogsByIp', () => {
    it('should return logs filtered by IP address', () => {
      const event1: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      const event2: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.2',
        endpoint: '/api/process',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      service.logRateLimitViolation(event1);
      service.logRateLimitViolation(event2);

      const logsForIp1 = service.getLogsByIp('192.168.1.1');
      expect(logsForIp1).toHaveLength(1);
      expect(logsForIp1[0].clientIp).toBe('192.168.1.1');

      const logsForIp2 = service.getLogsByIp('192.168.1.2');
      expect(logsForIp2).toHaveLength(1);
      expect(logsForIp2[0].clientIp).toBe('192.168.1.2');
    });
  });

  describe('getLogsByType', () => {
    it('should return logs filtered by type', () => {
      const rateLimitEvent: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      const corsEvent: CorsViolationEvent = {
        type: 'CORS_VIOLATION',
        origin: 'https://malicious-site.com',
        clientIp: '192.168.1.2',
        endpoint: '/api/process',
        method: 'POST',
        timestamp: new Date(),
      };

      service.logRateLimitViolation(rateLimitEvent);
      service.logCorsViolation(corsEvent);

      const rateLimitLogs = service.getLogsByType('RATE_LIMIT');
      expect(rateLimitLogs).toHaveLength(1);
      expect(rateLimitLogs[0].type).toBe('RATE_LIMIT');

      const corsLogs = service.getLogsByType('CORS_VIOLATION');
      expect(corsLogs).toHaveLength(1);
      expect(corsLogs[0].type).toBe('CORS_VIOLATION');
    });
  });

  describe('getSecurityStats', () => {
    it('should return correct security statistics', () => {
      const rateLimitEvent: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      const corsEvent: CorsViolationEvent = {
        type: 'CORS_VIOLATION',
        origin: 'https://malicious-site.com',
        clientIp: '192.168.1.2',
        endpoint: '/api/process',
        method: 'POST',
        timestamp: new Date(),
      };

      const config = {
        rateLimit: { windowMs: 1000, maxRequests: 3 },
        cors: { allowedOrigins: ['https://supernotaire.fr'] },
      };

      service.logRateLimitViolation(rateLimitEvent);
      service.logCorsViolation(corsEvent);
      service.logSecurityConfiguration(config);

      const stats = service.getSecurityStats();
      expect(stats).toMatchObject({
        totalEvents: 3,
        rateLimitViolations: 1,
        corsViolations: 1,
        configEvents: 1,
        uniqueIps: 2,
      });
      expect(stats.recentActivity).toHaveLength(3);
    });

    it('should count unique IPs correctly excluding system', () => {
      const event1: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      const event2: RateLimitEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1', // Same IP
        endpoint: '/api/process',
        requestCount: 4,
        windowStart: new Date(),
        timestamp: new Date(),
      };

      const config = {
        rateLimit: { windowMs: 1000, maxRequests: 3 },
        cors: { allowedOrigins: ['https://supernotaire.fr'] },
      };

      service.logRateLimitViolation(event1);
      service.logRateLimitViolation(event2);
      service.logSecurityConfiguration(config);

      const stats = service.getSecurityStats();
      expect(stats.uniqueIps).toBe(1); // Only one unique IP (system excluded)
    });
  });

  describe('checkSuspiciousPatterns', () => {
    it('should detect multiple rate limit violations and log alert', () => {
      const clientIp = '192.168.1.1';
      const now = new Date();

      // Create 5 rate limit violations within the last minute
      for (let i = 0; i < 5; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp,
          endpoint: `/api/endpoint${i}`,
          requestCount: 3,
          windowStart: new Date(now.getTime() - 30000), // 30 seconds ago
          timestamp: new Date(now.getTime() - i * 1000), // Spread over last 5 seconds
        };
        service.logRateLimitViolation(event);
      }

      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      service.checkSuspiciousPatterns(clientIp);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security alert for IP 192.168.1.1'),
      );

      const logs = service.getRecentLogs();
      const alertLog = logs.find(
        (log) => log.details?.alertType === 'MULTIPLE_RATE_LIMIT_VIOLATIONS',
      );
      expect(alertLog).toBeDefined();
      expect(alertLog?.details?.violationCount).toBe(5);
    });

    it('should not log alert for violations older than 1 minute', () => {
      const clientIp = '192.168.1.1';
      const oldTimestamp = new Date(Date.now() - 120000); // 2 minutes ago

      // Create 5 old rate limit violations
      for (let i = 0; i < 5; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp,
          endpoint: `/api/endpoint${i}`,
          requestCount: 3,
          windowStart: oldTimestamp,
          timestamp: oldTimestamp,
        };
        service.logRateLimitViolation(event);
      }

      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      service.checkSuspiciousPatterns(clientIp);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should not log alert for less than 5 violations', () => {
      const clientIp = '192.168.1.1';
      const now = new Date();

      // Create only 3 rate limit violations
      for (let i = 0; i < 3; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp,
          endpoint: `/api/endpoint${i}`,
          requestCount: 3,
          windowStart: new Date(now.getTime() - 30000),
          timestamp: new Date(now.getTime() - i * 1000),
        };
        service.logRateLimitViolation(event);
      }

      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      service.checkSuspiciousPatterns(clientIp);

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('log entry management', () => {
    it('should limit log entries to maxLogEntries', () => {
      // Access private property for testing
      const maxEntries = 1000;

      // Create more than maxLogEntries
      for (let i = 0; i < maxEntries + 100; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp: `192.168.1.${i % 255}`,
          endpoint: '/api/test',
          requestCount: 3,
          windowStart: new Date(),
          timestamp: new Date(),
        };
        service.logRateLimitViolation(event);
      }

      const allLogs = service.getRecentLogs(maxEntries + 200);
      expect(allLogs.length).toBe(maxEntries);
    });
  });

  describe('getRecentLogs', () => {
    it('should return limited number of recent logs', () => {
      // Create 20 log entries
      for (let i = 0; i < 20; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp: '192.168.1.1',
          endpoint: `/api/endpoint${i}`,
          requestCount: 3,
          windowStart: new Date(),
          timestamp: new Date(),
        };
        service.logRateLimitViolation(event);
      }

      const recentLogs = service.getRecentLogs(10);
      expect(recentLogs).toHaveLength(10);

      // Should return the most recent entries
      expect(recentLogs[9].endpoint).toBe('/api/endpoint19');
    });

    it('should return all logs if limit is greater than total', () => {
      // Create 5 log entries
      for (let i = 0; i < 5; i++) {
        const event: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp: '192.168.1.1',
          endpoint: `/api/endpoint${i}`,
          requestCount: 3,
          windowStart: new Date(),
          timestamp: new Date(),
        };
        service.logRateLimitViolation(event);
      }

      const recentLogs = service.getRecentLogs(10);
      expect(recentLogs).toHaveLength(5);
    });
  });
});
