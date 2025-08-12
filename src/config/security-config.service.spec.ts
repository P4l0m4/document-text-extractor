import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityConfigService } from './security-config.service';

describe('SecurityConfigService', () => {
  let service: SecurityConfigService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SecurityConfigService>(SecurityConfigService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRateLimitConfig', () => {
    it('should return default values when environment variables are not set', () => {
      configService.get.mockImplementation((key, defaultValue) => defaultValue);

      const config = service.getRateLimitConfig();

      expect(config).toEqual({
        windowMs: 1000,
        maxRequests: 3,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        standardHeaders: true,
        legacyHeaders: false,
      });
      expect(configService.get).toHaveBeenCalledWith(
        'SECURITY_RATE_LIMIT_WINDOW_MS',
        '1000',
      );
      expect(configService.get).toHaveBeenCalledWith(
        'SECURITY_RATE_LIMIT_MAX',
        '3',
      );
    });

    it('should return environment values when set', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'SECURITY_RATE_LIMIT_WINDOW_MS') return '2000';
        if (key === 'SECURITY_RATE_LIMIT_MAX') return '5';
        return undefined;
      });

      const config = service.getRateLimitConfig();

      expect(config.windowMs).toBe(2000);
      expect(config.maxRequests).toBe(5);
    });
  });

  describe('getCorsConfig', () => {
    it('should return default origins when environment variable is not set', () => {
      configService.get.mockImplementation((key, defaultValue) => defaultValue);

      const config = service.getCorsConfig();

      expect(config.allowedOrigins).toEqual([
        'https://supernotaire.fr',
        'http://localhost:3001',
      ]);
      expect(config.credentials).toBe(true);
      expect(config.methods).toEqual([
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS',
      ]);
    });

    it('should parse comma-separated origins from environment variable', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') {
          return 'https://example.com,http://localhost:3000,https://test.com';
        }
        return undefined;
      });

      const config = service.getCorsConfig();

      expect(config.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
        'https://test.com',
      ]);
    });

    it('should handle origins with extra whitespace', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') {
          return ' https://example.com , http://localhost:3000 , https://test.com ';
        }
        return undefined;
      });

      const config = service.getCorsConfig();

      expect(config.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
        'https://test.com',
      ]);
    });

    it('should filter out empty origins', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') {
          return 'https://example.com,,http://localhost:3000,';
        }
        return undefined;
      });

      const config = service.getCorsConfig();

      expect(config.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
      ]);
    });
  });

  describe('getSecurityConfig', () => {
    it('should return complete security configuration', () => {
      configService.get.mockImplementation((key, defaultValue) => defaultValue);

      const config = service.getSecurityConfig();

      expect(config).toEqual({
        rateLimit: {
          windowMs: 1000,
          maxRequests: 3,
        },
        cors: {
          allowedOrigins: ['https://supernotaire.fr', 'http://localhost:3001'],
        },
        logging: {
          enabled: true,
          level: 'info',
        },
      });
    });
  });

  describe('getConfigurationMetadata', () => {
    it('should indicate which values came from environment variables', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'SECURITY_RATE_LIMIT_WINDOW_MS') return '2000';
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS')
          return 'https://example.com';
        return undefined;
      });

      const metadata = service.getConfigurationMetadata();

      expect(metadata).toEqual({
        rateLimitWindowFromEnv: true,
        rateLimitMaxFromEnv: false,
        corsOriginsFromEnv: true,
      });
    });

    it('should indicate when no environment variables are set', () => {
      configService.get.mockReturnValue(undefined);

      const metadata = service.getConfigurationMetadata();

      expect(metadata).toEqual({
        rateLimitWindowFromEnv: false,
        rateLimitMaxFromEnv: false,
        corsOriginsFromEnv: false,
      });
    });
  });

  describe('validateConfiguration', () => {
    it('should return no errors for valid configuration', () => {
      configService.get.mockImplementation((key, defaultValue) => defaultValue);

      const errors = service.validateConfiguration();

      expect(errors).toEqual([]);
    });

    it('should return error for invalid rate limit window', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_RATE_LIMIT_WINDOW_MS') return '500';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_WINDOW_MS must be at least 1000ms',
      );
    });

    it('should return error for invalid rate limit max (too low)', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_RATE_LIMIT_MAX') return '0';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_MAX must be between 1 and 100',
      );
    });

    it('should return error for invalid rate limit max (too high)', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_RATE_LIMIT_MAX') return '150';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_MAX must be between 1 and 100',
      );
    });

    it('should return error for empty origins list', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') return '';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toContain(
        'SECURITY_CORS_ALLOWED_ORIGINS must contain at least one origin',
      );
    });

    it('should return error for invalid origin format', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS')
          return 'invalid-origin,https://valid.com';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toContain('Invalid origin at index 0: invalid-origin');
    });

    it('should accept localhost origins', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') {
          return 'http://localhost:3000,https://localhost:3001';
        }
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toEqual([]);
    });

    it('should return multiple errors when multiple validations fail', () => {
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'SECURITY_RATE_LIMIT_WINDOW_MS') return '500';
        if (key === 'SECURITY_RATE_LIMIT_MAX') return '0';
        if (key === 'SECURITY_CORS_ALLOWED_ORIGINS') return 'invalid-origin';
        return defaultValue;
      });

      const errors = service.validateConfiguration();

      expect(errors).toHaveLength(3);
      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_WINDOW_MS must be at least 1000ms',
      );
      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_MAX must be between 1 and 100',
      );
      expect(errors).toContain('Invalid origin at index 0: invalid-origin');
    });
  });
});
