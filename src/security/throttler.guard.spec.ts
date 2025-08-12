import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage, ThrottlerException } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './throttler.guard';
import { SecurityLoggerService } from './security-logger.service';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let mockStorage: any;
  let mockReflector: jest.Mocked<Reflector>;
  let mockSecurityLogger: jest.Mocked<SecurityLoggerService>;

  beforeEach(async () => {
    mockStorage = {
      getRecord: jest.fn(),
      addRecord: jest.fn(),
    };

    mockReflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
    } as any;

    mockSecurityLogger = {
      logRateLimitViolation: jest.fn(),
      checkSuspiciousPatterns: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CustomThrottlerGuard,
          useFactory: (
            options: any,
            storage: any,
            reflector: any,
            logger: any,
          ) => {
            return new CustomThrottlerGuard(
              options,
              storage,
              reflector,
              logger,
            );
          },
          inject: [
            'THROTTLER:MODULE_OPTIONS',
            ThrottlerStorage,
            Reflector,
            SecurityLoggerService,
          ],
        },
        { provide: ThrottlerStorage, useValue: mockStorage },
        { provide: Reflector, useValue: mockReflector },
        { provide: SecurityLoggerService, useValue: mockSecurityLogger },
        {
          provide: 'THROTTLER:MODULE_OPTIONS',
          useValue: [{ limit: 3, ttl: 1 }],
        },
      ],
    }).compile();

    guard = module.get<CustomThrottlerGuard>(CustomThrottlerGuard);
  });

  describe('getTracker', () => {
    it('should return IP address from req.ip', async () => {
      const req = { ip: '192.168.1.1' };
      const result = await guard['getTracker'](req);
      expect(result).toBe('192.168.1.1');
    });

    it('should return IP address from req.connection.remoteAddress', async () => {
      const req = { connection: { remoteAddress: '192.168.1.2' } };
      const result = await guard['getTracker'](req);
      expect(result).toBe('192.168.1.2');
    });

    it('should return IP address from req.socket.remoteAddress', async () => {
      const req = { socket: { remoteAddress: '192.168.1.3' } };
      const result = await guard['getTracker'](req);
      expect(result).toBe('192.168.1.3');
    });

    it('should prioritize req.ip over other sources', async () => {
      const req = {
        ip: '192.168.1.1',
        connection: { remoteAddress: '192.168.1.2' },
        socket: { remoteAddress: '192.168.1.3' },
      };
      const result = await guard['getTracker'](req);
      expect(result).toBe('192.168.1.1');
    });

    it('should handle missing IP information gracefully', async () => {
      const req = {};
      const result = await guard['getTracker'](req);
      expect(result).toBe('unknown');
    });
  });

  describe('generateKey', () => {
    it('should generate unique key with class name, method name, and tracker', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({ name: 'uploadDocument' }),
        getClass: jest.fn().mockReturnValue({ name: 'UploadController' }),
      } as any;

      const suffix = '192.168.1.1';
      const name = 'throttler';

      const result = guard['generateKey'](mockContext, suffix, name);
      expect(result).toBe('UploadController-uploadDocument-192.168.1.1');
    });

    it('should handle different controller and method names', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({ name: 'getTaskStatus' }),
        getClass: jest.fn().mockReturnValue({ name: 'TaskController' }),
      } as any;

      const suffix = '10.0.0.1';
      const name = 'throttler';

      const result = guard['generateKey'](mockContext, suffix, name);
      expect(result).toBe('TaskController-getTaskStatus-10.0.0.1');
    });

    it('should create different keys for different trackers', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({ name: 'uploadDocument' }),
        getClass: jest.fn().mockReturnValue({ name: 'UploadController' }),
      } as any;

      const suffix1 = '192.168.1.1';
      const suffix2 = '192.168.1.2';
      const name = 'throttler';

      const result1 = guard['generateKey'](mockContext, suffix1, name);
      const result2 = guard['generateKey'](mockContext, suffix2, name);

      expect(result1).toBe('UploadController-uploadDocument-192.168.1.1');
      expect(result2).toBe('UploadController-uploadDocument-192.168.1.2');
      expect(result1).not.toBe(result2);
    });

    it('should create different keys for different methods', () => {
      const mockContext1 = {
        getHandler: jest.fn().mockReturnValue({ name: 'uploadDocument' }),
        getClass: jest.fn().mockReturnValue({ name: 'UploadController' }),
      } as any;

      const mockContext2 = {
        getHandler: jest.fn().mockReturnValue({ name: 'getTaskStatus' }),
        getClass: jest.fn().mockReturnValue({ name: 'TaskController' }),
      } as any;

      const suffix = '192.168.1.1';
      const name = 'throttler';

      const result1 = guard['generateKey'](mockContext1, suffix, name);
      const result2 = guard['generateKey'](mockContext2, suffix, name);

      expect(result1).toBe('UploadController-uploadDocument-192.168.1.1');
      expect(result2).toBe('TaskController-getTaskStatus-192.168.1.1');
      expect(result1).not.toBe(result2);
    });

    it('should handle undefined handler or class names gracefully', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({ name: undefined }),
        getClass: jest.fn().mockReturnValue({ name: undefined }),
      } as any;

      const suffix = '192.168.1.1';
      const name = 'throttler';

      const result = guard['generateKey'](mockContext, suffix, name);
      expect(result).toBe('undefined-undefined-192.168.1.1');
    });
  });

  describe('canActivate', () => {
    let mockResponse: any;
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ ip: '192.168.1.1' }),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
        getHandler: jest.fn().mockReturnValue({ name: 'testMethod' }),
        getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
      } as any;

      // Mock the storageService property
      (guard as any).storageService = mockStorage;

      // Mock the reflector property
      (guard as any).reflector = mockReflector;
    });

    it('should set rate limit headers when within limit', async () => {
      // Mock parent canActivate to return true
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Mock reflector to return throttler config
      mockReflector.getAllAndOverride.mockReturnValue([{ limit: 3, ttl: 1 }]);

      // Mock empty record (no previous requests)
      mockStorage.getRecord.mockResolvedValue([]);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '3',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '2',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String),
      );
    });

    it('should handle ThrottlerException and add appropriate headers', async () => {
      // Mock parent canActivate to throw ThrottlerException
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockRejectedValue(new ThrottlerException('Rate limit exceeded'));

      // Mock reflector to return throttler config
      mockReflector.getAllAndOverride.mockReturnValue([{ limit: 3, ttl: 1 }]);

      // Mock storage to return some requests in the current window
      const now = Date.now();
      mockStorage.getRecord.mockResolvedValue([now - 500, now - 200]); // 2 requests in window

      // Mock request with URL
      const mockRequest = { ip: '192.168.1.1', url: '/api/upload' };
      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ThrottlerException,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '1');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '3',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '0',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String),
      );

      // Verify security logging
      expect(mockSecurityLogger.logRateLimitViolation).toHaveBeenCalledWith({
        type: 'RATE_LIMIT_EXCEEDED',
        clientIp: '192.168.1.1',
        endpoint: '/api/upload',
        requestCount: 3, // 2 in window + current request
        windowStart: expect.any(Date),
        timestamp: expect.any(Date),
      });

      // Verify suspicious pattern check
      expect(mockSecurityLogger.checkSuspiciousPatterns).toHaveBeenCalledWith(
        '192.168.1.1',
      );
    });

    it('should use default throttler config when none provided', async () => {
      // Mock parent canActivate to return true
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Mock reflector to return null (no config)
      mockReflector.getAllAndOverride.mockReturnValue(null);

      // Mock empty record
      mockStorage.getRecord.mockResolvedValue([]);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '3',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '2',
      );
    });

    it('should calculate remaining requests correctly based on time window', async () => {
      // Mock parent canActivate to return true
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Mock reflector to return throttler config
      mockReflector.getAllAndOverride.mockReturnValue([{ limit: 3, ttl: 1 }]);

      const now = Date.now();
      // Mock record with one recent request
      mockStorage.getRecord.mockResolvedValue([now - 500]); // 0.5 seconds ago

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '1',
      ); // 3 - 2 (current + 1 within window)
    });

    it('should filter out old requests outside time window', async () => {
      // Mock parent canActivate to return true
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(true);

      // Mock reflector to return throttler config
      mockReflector.getAllAndOverride.mockReturnValue([{ limit: 3, ttl: 1 }]);

      const now = Date.now();
      // Mock record with old and recent requests
      mockStorage.getRecord.mockResolvedValue([
        now - 2000, // 2 seconds ago (outside window)
        now - 500, // 0.5 seconds ago (within window)
      ]);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '1',
      ); // 3 - 2 (current + 1 within window)
    });

    it('should rethrow non-ThrottlerException errors', async () => {
      const customError = new Error('Custom error');

      // Mock parent canActivate to throw custom error
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockRejectedValue(customError);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Custom error',
      );
    });
  });

  describe('Integration behavior', () => {
    it('should use custom tracker and key generation methods', async () => {
      const mockRequest = {
        ip: '192.168.1.100',
        connection: { remoteAddress: '192.168.1.101' },
      };

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
        getHandler: jest.fn().mockReturnValue({ name: 'testMethod' }),
        getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
      } as any;

      // Test that our custom methods would be called
      const tracker = await guard['getTracker'](mockRequest);
      const key = guard['generateKey'](mockContext, tracker, 'throttler');

      expect(tracker).toBe('192.168.1.100');
      expect(key).toBe('TestController-testMethod-192.168.1.100');
    });
  });
});
